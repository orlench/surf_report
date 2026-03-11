const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { isConfigured: isMetaConfigured } = require('../services/instagram/tokenManager');
const { setup, createAd, activateCampaign, pauseCampaign, resumeCampaign, getCampaignStatus } = require('../services/instagram/campaignManager');
const { uploadImage, createCreative, generateAdContent } = require('../services/instagram/creativeUploader');
const { refreshCreatives, generatePredisPost, findBestSpot } = require('../services/instagram/scheduler');
const predis = require('../services/instagram/predisClient');

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

// ═══════════════════════════════════════════════════
// PREDIS WEBHOOK (no auth — called by Predis servers)
// ═══════════════════════════════════════════════════

/**
 * POST /api/marketing/webhook/predis
 * Webhook endpoint for Predis.ai post completion notifications
 */
router.post('/webhook/predis', (req, res) => {
  const { status, post_id, caption, generated_media } = req.body;

  if (status === 'completed') {
    const imageUrls = (generated_media || []).map(m => m.url).filter(Boolean);
    logger.info(`[Predis Webhook] Post ${post_id} completed — ${imageUrls.length} image(s)`);
    logger.info(`[Predis Webhook] Caption: ${caption?.slice(0, 100)}...`);
    logger.info(`[Predis Webhook] Images: ${imageUrls.join(', ')}`);
  } else if (status === 'error') {
    logger.error(`[Predis Webhook] Post ${post_id} failed`);
  }

  res.json({ received: true });
});

// All remaining routes require admin auth
router.use(requireAdmin);

// ═══════════════════════════════════════════════════
// PREDIS.AI ENDPOINTS (work without Meta)
// ═══════════════════════════════════════════════════

/**
 * POST /api/marketing/generate
 * Generate a post via Predis.ai using live surf data
 * Returns image URL(s) + caption ready to download and upload to Instagram
 */
router.post('/generate', async (req, res) => {
  if (!predis.isConfigured()) {
    return res.status(503).json({ error: 'Set PREDIS_API_KEY and PREDIS_BRAND_ID in env' });
  }

  try {
    // Allow custom prompt or auto-generate from surf data
    let prompt = req.body?.prompt;

    if (!prompt) {
      const best = await findBestSpot();
      if (!best) {
        return res.status(500).json({ error: 'Could not fetch conditions for any spot' });
      }
      const spotName = best.data.spotName || best.spotId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      prompt = predis.buildSurfPrompt(spotName, best.data);
    }

    logger.info(`[Marketing] Generating Predis post — prompt: ${prompt.slice(0, 100)}...`);

    const post = await predis.createAndWait(prompt, {
      mediaType: req.body?.mediaType || 'single_image'
    });

    if (!post) {
      return res.status(504).json({ error: 'Post generation timed out (2 min). Check /api/marketing/posts later.' });
    }

    res.json({
      success: true,
      post_id: post.post_id,
      images: post.urls,
      caption: post.caption,
      media_type: post.media_type,
      message: 'Post ready! Download the image(s) and upload to Instagram. Images expire in 1 hour.'
    });
  } catch (err) {
    logger.error(`[Marketing] Generate failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/marketing/posts
 * Get recently generated Predis posts
 */
router.get('/posts', async (req, res) => {
  if (!predis.isConfigured()) {
    return res.status(503).json({ error: 'Predis not configured' });
  }

  try {
    const result = await predis.getPosts({
      mediaType: req.query.type || 'single_image',
      page: parseInt(req.query.page) || 1,
      items: parseInt(req.query.items) || 10
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// META ADS ENDPOINTS (require Meta credentials)
// ═══════════════════════════════════════════════════

function requireMeta(req, res, next) {
  if (!isMetaConfigured()) {
    return res.status(503).json({ error: 'Meta credentials not configured. Set META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN.' });
  }
  next();
}

/**
 * POST /api/marketing/setup
 * One-time: create campaign + ad set + initial ad
 */
router.post('/setup', requireMeta, async (req, res) => {
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
    logger.error(`[Marketing] Setup failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/marketing/refresh-creatives
 */
router.post('/refresh-creatives', requireMeta, async (req, res) => {
  try {
    await refreshCreatives();
    res.json({ success: true, message: 'Creatives refreshed with latest surf data' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/marketing/status
 */
router.get('/status', requireMeta, async (req, res) => {
  try {
    const status = await getCampaignStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/marketing/pause
 */
router.post('/pause', requireMeta, async (req, res) => {
  try {
    await pauseCampaign();
    res.json({ success: true, message: 'Campaign paused' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/marketing/resume
 */
router.post('/resume', requireMeta, async (req, res) => {
  try {
    await resumeCampaign();
    res.json({ success: true, message: 'Campaign resumed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
