const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { requireAdmin } = require('../services/adminAuth');
const { isConfigured: isMetaConfigured } = require('../services/instagram/tokenManager');
const { setup, createAd, activateCampaign, pauseCampaign, resumeCampaign, getCampaignStatus } = require('../services/instagram/campaignManager');
const { uploadImage, createCreative, generateLocationAdContent } = require('../services/instagram/creativeUploader');
const { refreshCreatives } = require('../services/instagram/scheduler');
const analytics = require('../services/analyticsClient');

function requireMeta(req, res, next) {
  if (!isMetaConfigured()) {
    return res.status(503).json({ error: 'Meta credentials not configured. Set META_ACCESS_TOKEN.' });
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
    const validRanges = ['today', 'yesterday', 'last7days', 'last28days', 'last90days'];
    if (!validRanges.includes(range)) {
      return res.status(400).json({ error: `Invalid range. Must be one of: ${validRanges.join(', ')}` });
    }
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
    const validRanges = ['today', 'yesterday', 'last7days', 'last28days', 'last90days'];
    if (!validRanges.includes(range)) {
      return res.status(400).json({ error: `Invalid range. Must be one of: ${validRanges.join(', ')}` });
    }
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
    const validRanges = ['today', 'yesterday', 'last7days', 'last28days', 'last90days'];
    if (!validRanges.includes(range)) {
      return res.status(400).json({ error: `Invalid range. Must be one of: ${validRanges.join(', ')}` });
    }
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
    const force = req.query.force === 'true' || req.body?.force === true;
    const report = await runAndEmail({ force });
    res.json({ success: true, ...(report || { message: 'Report generated and emailed' }) });
  } catch (err) {
    logger.error(`[DailyReport] Manual generation failed: ${err.message}`);
    res.status(err.statusCode || 500).json({ error: 'Failed to generate report', detail: err.message });
  }
});

// --- Search Console routes ---

const searchConsole = require('../services/searchConsole');

/**
 * GET /api/marketing/search-console/indexing
 * Sitemap indexing status (submitted vs indexed counts)
 */
router.get('/search-console/indexing', async (req, res) => {
  try {
    const data = await searchConsole.getIndexingStatus();
    res.json({ success: true, ...data });
  } catch (err) {
    logger.error(`[SearchConsole] Indexing status failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load indexing status', detail: err.message });
  }
});

/**
 * GET /api/marketing/search-console/queries
 * Top search queries — clicks, impressions, CTR, position
 * Query params: ?days=7&limit=20
 */
router.get('/search-console/queries', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const data = await searchConsole.getSearchAnalytics({ dimension: 'query', days, limit });
    res.json({ success: true, ...data });
  } catch (err) {
    logger.error(`[SearchConsole] Queries failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load search queries' });
  }
});

/**
 * GET /api/marketing/search-console/pages
 * Top pages by search performance
 * Query params: ?days=7&limit=20
 */
router.get('/search-console/pages', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const data = await searchConsole.getSearchAnalytics({ dimension: 'page', days, limit });
    res.json({ success: true, ...data });
  } catch (err) {
    logger.error(`[SearchConsole] Pages failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to load page data' });
  }
});

/**
 * GET /api/marketing/search-console/inspect?url=https://shouldigo.surf/...
 * Inspect a specific URL's indexing status
 */
router.get('/search-console/inspect', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'url query param required' });
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: 'URL must use http or https protocol' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    const data = await searchConsole.inspectUrl(url);
    res.json({ success: true, ...data });
  } catch (err) {
    logger.error(`[SearchConsole] URL inspection failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to inspect URL' });
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
    const { primaryTexts, headlines, descriptions } = generateLocationAdContent();

    const creativeId = await createCreative({
      imageHashes: [imageHash],
      primaryTexts,
      headlines,
      descriptions,
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
    res.status(500).json({ error: 'Campaign setup failed', detail: metaError.message || err.message });
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
    const detail = err.response?.data?.error?.message || err.message;
    res.status(500).json({ error: 'Failed to get campaign status', detail });
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
