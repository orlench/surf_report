const webpush = require('web-push');
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
  const subject = process.env.VAPID_SUBJECT || 'mailto:orlench@gmail.com';

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
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
        markNotified(sub.id, qualifyingBlock.label);
        logger.info(`[Push] Sent notification to ${sub.id} for ${spotId}: ${qualifyingBlock.label} (${qualifyingBlock.score})`);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          logger.info(`[Push] Subscription expired (${err.statusCode}), removing ${sub.id}`);
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
