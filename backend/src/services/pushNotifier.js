const webpush = require('web-push');
let apn;
let apnProvider;
let firebaseAdmin;
let fcmInitialised = false;

function initApn() {
  if (apnProvider) return apnProvider;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyP8 = process.env.APNS_KEY_P8;
  if (!keyId || !teamId || !keyP8) return null;
  try {
    apn = require('node-apn');
    apnProvider = new apn.Provider({
      token: { key: Buffer.from(keyP8, 'base64'), keyId, teamId },
      production: process.env.APNS_PRODUCTION === 'true'
    });
    return apnProvider;
  } catch (e) {
    logger.warn('[Push] node-apn not installed — APNs notifications disabled');
    return null;
  }
}

function initFcm() {
  if (fcmInitialised) return !!firebaseAdmin;
  fcmInitialised = true;
  const { loadServiceAccount } = require('../utils/googleServiceAccount');
  let serviceAccount;
  try {
    serviceAccount = loadServiceAccount('FCM_SERVICE_ACCOUNT', {
      fallbackEnv: 'FIREBASE_SERVICE_ACCOUNT',
      required: false,
    });
  } catch (e) {
    logger.warn(`[Push] Firebase Admin credentials invalid: ${e.message}`);
    return false;
  }

  if (!serviceAccount) {
    logger.warn('[Push] FCM_SERVICE_ACCOUNT not set — FCM notifications disabled');
    return false;
  }
  try {
    firebaseAdmin = require('firebase-admin');
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
    logger.info('[Push] Firebase Admin SDK initialised');
    return true;
  } catch (e) {
    logger.warn(`[Push] Firebase Admin init failed: ${e.message}`);
    firebaseAdmin = null;
    return false;
  }
}
const { fetchSurfData, aggregateData, aggregateHourlyData } = require('./scraper');
const { calculateSurfScore } = require('./scoring');
const { generateTrend } = require('./trend');
const { getSpotName, isValidSpot } = require('../config/spots');
const cache = require('./cache');
const {
  getSubscriptionsGroupedBySpot,
  markNotified,
  removeById
} = require('./pushSubscriptions');
const logger = require('../utils/logger');

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

let intervalHandle = null;

/**
 * Configure web-push with VAPID keys from environment.
 */
function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@shouldigo.surf';

  if (!publicKey || !privateKey) {
    logger.warn('[Push] VAPID keys not configured — push notifications disabled');
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  logger.info('[Push] VAPID configured');
  return true;
}

/**
 * Get conditions + trend for a spot. Uses cache first, falls back to fresh scrape.
 */
async function getConditionsForSpot(spotId) {
  // Check cache first
  const cached = cache.get(`conditions:${spotId}`);
  if (cached && cached.trend && cached.trend.blocks) {
    return { score: cached.score.overall, trend: cached.trend };
  }

  // Fresh scrape
  if (!isValidSpot(spotId)) {
    logger.warn(`[Push] Spot ${spotId} is not valid, skipping`);
    return null;
  }

  try {
    const rawData = await fetchSurfData(spotId);
    const aggregated = aggregateData(rawData);
    const score = calculateSurfScore(aggregated, spotId, rawData.length);
    const hourlyTimeline = aggregateHourlyData(rawData);
    const trend = generateTrend(hourlyTimeline, spotId, score.overall);

    // Cache for other consumers
    const response = {
      spotId,
      spotName: getSpotName(spotId),
      timestamp: new Date().toISOString(),
      score,
      conditions: aggregated,
      trend,
      fromCache: false
    };
    cache.set(`conditions:${spotId}`, response, 600);

    return { score: score.overall, trend };
  } catch (e) {
    logger.error(`[Push] Failed to fetch conditions for ${spotId}: ${e.message}`);
    return null;
  }
}

/**
 * Run one notification check cycle.
 */
async function checkAndNotify() {
  const grouped = getSubscriptionsGroupedBySpot();
  const spotIds = Object.keys(grouped);

  if (spotIds.length === 0) {
    logger.debug('[Push] No subscriptions, skipping cycle');
    return;
  }

  logger.info(`[Push] Starting notification check cycle — ${spotIds.length} spot(s)`);

  for (const spotId of spotIds) {
    const subscribers = grouped[spotId];
    const data = await getConditionsForSpot(spotId);

    if (!data || !data.trend || !data.trend.blocks || data.trend.blocks.length === 0) {
      logger.debug(`[Push] No trend data for ${spotId}, skipping`);
      continue;
    }

    const spotName = getSpotName(spotId);

    for (const sub of subscribers) {
      // Cooldown check
      if (sub.lastNotifiedAt) {
        const elapsed = Date.now() - new Date(sub.lastNotifiedAt).getTime();
        if (elapsed < COOLDOWN_MS) {
          logger.debug(`[Push] Cooldown active for ${sub.id} (${Math.round(elapsed / 60000)}min ago)`);
          continue;
        }
      }

      // Find first upcoming block that meets threshold and wasn't already notified
      const qualifyingBlock = data.trend.blocks.find(
        block => block.score >= sub.threshold && block.label !== sub.lastNotifiedBlock
      );

      if (!qualifyingBlock) continue;

      // Build notification payload
      const payload = JSON.stringify({
        title: `${qualifyingBlock.rating} conditions coming!`,
        body: `${spotName}: ${qualifyingBlock.label} — ${qualifyingBlock.score}/100`,
        icon: '/logo192.png',
        data: { url: `/?spot=${spotId}` }
      });

      try {
        if (sub.type === 'apns' && sub.token) {
          // Native iOS push via APNs
          const provider = initApn();
          if (provider) {
            const parsedPayload = JSON.parse(payload);
            const note = new apn.Notification();
            note.expiry = Math.floor(Date.now() / 1000) + 3600;
            note.badge = 1;
            note.sound = 'default';
            note.alert = { title: parsedPayload.title, body: parsedPayload.body };
            note.topic = 'surf.shouldigo.app';
            note.payload = parsedPayload.data || {};
            const result = await provider.send(note, sub.token);
            if (result.failed && result.failed.length > 0) {
              const reason = result.failed[0]?.response?.reason;
              if (reason === 'Unregistered' || reason === 'BadDeviceToken') {
                logger.info(`[Push] APNs token invalid (${reason}), removing ${sub.id}`);
                removeById(sub.id);
              } else {
                logger.error(`[Push] APNs failed for ${sub.id}: ${reason}`);
              }
            } else {
              markNotified(sub.id, qualifyingBlock.label);
              logger.info(`[Push] Sent APNs notification to ${sub.id} for ${spotId}: ${qualifyingBlock.label}`);
            }
          }
        } else if (sub.type === 'fcm' && sub.token) {
          // Android push via FCM
          if (initFcm()) {
            const parsedPayload = JSON.parse(payload);
            const result = await firebaseAdmin.messaging().send({
              token: sub.token,
              notification: {
                title: parsedPayload.title,
                body: parsedPayload.body
              },
              data: { url: parsedPayload.data?.url || `/?spot=${spotId}` },
              android: {
                notification: {
                  sound: 'default',
                  channelId: 'surf_alerts'
                }
              }
            });
            markNotified(sub.id, qualifyingBlock.label);
            logger.info(`[Push] Sent FCM notification to ${sub.id} for ${spotId}: ${qualifyingBlock.label} (msgId: ${result})`);
          }
        } else {
          // Web push
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload
          );
          markNotified(sub.id, qualifyingBlock.label);
          logger.info(`[Push] Sent web notification to ${sub.id} for ${spotId}: ${qualifyingBlock.label} (${qualifyingBlock.score})`);
        }
      } catch (err) {
        const fcmInvalid = err.code === 'messaging/registration-token-not-registered' ||
                           err.code === 'messaging/invalid-registration-token';
        if (err.statusCode === 410 || err.statusCode === 404 || fcmInvalid) {
          logger.info(`[Push] Subscription expired/invalid (${err.statusCode || err.code}), removing ${sub.id}`);
          removeById(sub.id);
        } else {
          logger.error(`[Push] Failed to send to ${sub.id}: ${err.message}`);
        }
      }
    }
  }

  logger.info('[Push] Notification check cycle complete');
}

/**
 * Start the notification scheduler.
 */
function startNotificationScheduler() {
  if (!configureVapid()) return;

  logger.info(`[Push] Scheduler started (interval: ${CHECK_INTERVAL_MS / 60000}min)`);

  // Run first check after 2 minutes (let server warm up)
  setTimeout(() => {
    checkAndNotify().catch(e => logger.error(`[Push] Cycle error: ${e.message}`));
  }, 2 * 60 * 1000);

  // Then run every 30 minutes
  intervalHandle = setInterval(() => {
    checkAndNotify().catch(e => logger.error(`[Push] Cycle error: ${e.message}`));
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the scheduler (for graceful shutdown).
 */
function stopNotificationScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('[Push] Scheduler stopped');
  }
}

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
  checkAndNotify
};
