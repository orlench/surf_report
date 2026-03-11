const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { isConfigured } = require('../services/instagram/tokenManager');
const { setup, createAd, activateCampaign, pauseCampaign, resumeCampaign, getCampaignStatus } = require('../services/instagram/campaignManager');
const { uploadImage, createCreative, generateAdContent } = require('../services/instagram/creativeUploader');
const { refreshCreatives } = require('../services/instagram/scheduler');

// Simple admin auth middleware
function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'ADMIN_SECRET not configured' });
  }
  const provided = req.headers['x-admin-secret'] || req.query.secret;
  if (provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Check Meta is configured
function requireMeta(req, res, next) {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Meta credentials not configured. Set META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN in env.' });
  }
  next();
}

router.use(requireAdmin);
router.use(requireMeta);

/**
 * POST /api/marketing/setup
 * One-time: create campaign + ad set + initial ad
 */
router.post('/setup', async (req, res) => {
  try {
    logger.info('[Marketing] Running one-time setup...');

    // 1. Create campaign + ad set
    const { campaignId, adSetId } = await setup();

    // 2. Upload seed image
    const logoUrl = 'https://shouldigo.surf/logo512.png';
    const imageHash = await uploadImage(logoUrl);
    if (!imageHash) {
      return res.status(500).json({ error: 'Failed to upload seed image' });
    }

    // 3. Create initial creative
    const linkUrl = process.env.META_AD_URL || 'https://shouldigo.surf?utm_source=instagram&utm_medium=paid&utm_campaign=advantage_plus';
    const primaryTexts = [
      'Should you go surf today? Get real-time conditions for any beach.',
      'Check surf scores instantly. Wave height, period, wind — all in one place.',
      'Know before you go. Real-time surf conditions scored 0-100.'
    ];

    const creativeId = await createCreative({
      imageHashes: [imageHash],
      primaryTexts,
      headline: 'Should I Go Surf?',
      linkUrl
    });

    if (!creativeId) {
      return res.status(500).json({ error: 'Failed to create ad creative', campaignId, adSetId });
    }

    // 4. Create ad and activate
    const adId = await createAd(creativeId);
    await activateCampaign();

    res.json({
      success: true,
      campaignId,
      adSetId,
      creativeId,
      adId,
      message: 'Campaign is live! Ad will go through Meta review (~15-30 min).'
    });
  } catch (err) {
    logger.error(`[Marketing] Setup failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/marketing/refresh-creatives
 * Manually trigger a creative refresh with fresh surf data
 */
router.post('/refresh-creatives', async (req, res) => {
  try {
    await refreshCreatives();
    res.json({ success: true, message: 'Creatives refreshed with latest surf data' });
  } catch (err) {
    logger.error(`[Marketing] Manual refresh failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/marketing/status
 * Get campaign status, spend, and performance
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getCampaignStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/marketing/pause
 * Pause the campaign
 */
router.post('/pause', async (req, res) => {
  try {
    await pauseCampaign();
    res.json({ success: true, message: 'Campaign paused' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/marketing/resume
 * Resume the campaign
 */
router.post('/resume', async (req, res) => {
  try {
    await resumeCampaign();
    res.json({ success: true, message: 'Campaign resumed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
