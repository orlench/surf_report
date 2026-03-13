const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const logger = require('../utils/logger');
const { isConfigured: isMetaConfigured } = require('../services/instagram/tokenManager');
const { setup, createAd, activateCampaign, pauseCampaign, resumeCampaign, getCampaignStatus } = require('../services/instagram/campaignManager');
const { uploadImage, createCreative } = require('../services/instagram/creativeUploader');
const { refreshCreatives } = require('../services/instagram/scheduler');
const analytics = require('../services/analyticsClient');

// Admin auth middleware with timing-safe comparison
function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'ADMIN_SECRET not configured' });
  }
  const provided = req.headers['x-admin-secret'];
  if (!provided || typeof provided !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireMeta(req, res, next) {
  if (!isMetaConfigured()) {
    return res.status(503).json({ error: 'Meta credentials not configured. Set META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN.' });
  }
  next();
}

router.use(requireAdmin);

// --- Analytics routes (no Meta required) ---

/**
 * GET /api/marketing/analytics
 * Full analytics dashboard (overview, sources, pages, campaigns, devices, countries)
 * Query params: ?range=last7days (today|yesterday|last7days|last28days|last90days)
 */
router.get('/analytics', async (req, res) => {
  try {
    const range = req.query.range || 'last7days';
    const data = await analytics.getDashboard(range);
    res.json({ success: true, range, ...data });
  } catch (err) {
    logger.error(`[Analytics] Dashboard failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

/**
 * GET /api/marketing/analytics/trend
 * Daily trend data
 * Query params: ?range=last28days
 */
router.get('/analytics/trend', async (req, res) => {
  try {
    const range = req.query.range || 'last28days';
    const data = await analytics.getDailyTrend(range);
    res.json({ success: true, range, ...data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load trend data' });
  }
});

/**
 * GET /api/marketing/analytics/errors
 * JS errors from users
 * Query params: ?range=last7days
 */
router.get('/analytics/errors', async (req, res) => {
  try {
    const range = req.query.range || 'last7days';
    const data = await analytics.getErrors(range);
    res.json({ success: true, range, ...data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load error data' });
  }
});

// --- Daily report routes (no Meta required — degrades gracefully) ---

const { generateReport, getLatestReport, runAndEmail } = require('../services/dailyReport');

router.get('/daily-report', (req, res) => {
  const report = getLatestReport();
  if (!report) return res.status(404).json({ error: 'No report generated yet. POST /daily-report/generate to create one.' });
  res.json({ success: true, ...report });
});

router.post('/daily-report/generate', async (req, res) => {
  try {
    const report = await runAndEmail();
    res.json({ success: true, ...(report || { message: 'Report generated and emailed' }) });
  } catch (err) {
    logger.error(`[DailyReport] Manual generation failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// --- Meta routes (require Meta credentials) ---
router.use(requireMeta);

/**
 * POST /api/marketing/setup
 * One-time: create campaign + ad set + initial ad
 */
router.post('/setup', async (req, res) => {
  try {
    logger.info('[Marketing] Running one-time setup...');

    const { campaignId, adSetId } = await setup();

    const logoUrl = 'https://shouldigo.surf/logo512.png';
    const imageHash = await uploadImage(logoUrl);
    if (!imageHash) {
      return res.status(500).json({ error: 'Failed to upload seed image' });
    }

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

    const adId = await createAd(creativeId);
    await activateCampaign();

    res.json({
      success: true,
      campaignId, adSetId, creativeId, adId,
      message: 'Campaign is live! Ad goes through Meta review (~15-30 min).'
    });
  } catch (err) {
    const metaError = err.response?.data?.error || {};
    logger.error(`[Marketing] Setup failed: ${metaError.message || err.message}`);
    res.status(500).json({ error: 'Campaign setup failed' });
  }
});

/**
 * POST /api/marketing/refresh-creatives
 */
router.post('/refresh-creatives', async (req, res) => {
  try {
    await refreshCreatives();
    res.json({ success: true, message: 'Creatives refreshed with latest surf data' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh creatives' });
  }
});

/**
 * GET /api/marketing/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getCampaignStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get campaign status' });
  }
});

/**
 * POST /api/marketing/pause
 */
router.post('/pause', async (req, res) => {
  try {
    await pauseCampaign();
    res.json({ success: true, message: 'Campaign paused' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

/**
 * POST /api/marketing/resume
 */
router.post('/resume', async (req, res) => {
  try {
    await resumeCampaign();
    res.json({ success: true, message: 'Campaign resumed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resume campaign' });
  }
});

module.exports = router;
