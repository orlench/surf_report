const express = require('express');
const router = express.Router();
const {
  upsertSubscription,
  removeSubscription,
  getSubscriptionsByEndpoint
} = require('../services/pushSubscriptions');
const logger = require('../utils/logger');

const MAX_SPOTS_PER_USER = 2;
const VALID_THRESHOLDS = [50, 65, 75, 85];

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key for the frontend to use when subscribing.
 */
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(500).json({ success: false, error: 'VAPID key not configured' });
  }
  res.json({ success: true, key });
});

/**
 * POST /api/push/subscribe
 * Subscribe to push notifications for a spot.
 * Body: { subscription: { endpoint, keys }, spotId, threshold }
 */
router.post('/subscribe', (req, res) => {
  try {
    const { subscription, spotId, threshold } = req.body;

    // Validate subscription object
    if (!subscription || !subscription.endpoint || !subscription.keys ||
        !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({ success: false, error: 'Invalid subscription object' });
    }

    // Validate spotId
    if (!spotId || typeof spotId !== 'string' || spotId.length > 100) {
      return res.status(400).json({ success: false, error: 'Invalid spotId' });
    }

    // Validate threshold
    if (!VALID_THRESHOLDS.includes(threshold)) {
      return res.status(400).json({
        success: false,
        error: `Invalid threshold. Must be one of: ${VALID_THRESHOLDS.join(', ')}`
      });
    }

    // Check max spots per user
    const existingSubs = getSubscriptionsByEndpoint(subscription.endpoint);
    const alreadySubscribed = existingSubs.some(s => s.spotId === spotId);
    if (!alreadySubscribed && existingSubs.length >= MAX_SPOTS_PER_USER) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_SPOTS_PER_USER} spots per user. Remove one to add another.`
      });
    }

    const { id, count } = upsertSubscription(subscription, spotId, threshold);
    logger.info(`[Push] Subscription upserted: ${id} for ${spotId} (threshold: ${threshold}, total: ${count})`);

    res.json({ success: true, id, count });
  } catch (error) {
    logger.error(`[Push] Subscribe error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to subscribe' });
  }
});

/**
 * POST /api/push/unsubscribe
 * Unsubscribe from push notifications for a spot.
 * Body: { endpoint, spotId }
 */
router.post('/unsubscribe', (req, res) => {
  try {
    const { endpoint, spotId } = req.body;

    if (!endpoint || !spotId) {
      return res.status(400).json({ success: false, error: 'Missing endpoint or spotId' });
    }

    const removed = removeSubscription(endpoint, spotId);
    logger.info(`[Push] Unsubscribed: ${spotId} (removed: ${removed})`);

    res.json({ success: true, removed });
  } catch (error) {
    logger.error(`[Push] Unsubscribe error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to unsubscribe' });
  }
});

module.exports = router;
