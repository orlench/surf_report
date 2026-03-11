const axios = require('axios');
const logger = require('../../utils/logger');
const { isConfigured: isMetaConfigured } = require('./tokenManager');
const { uploadImage, createCreative, generateAdContent } = require('./creativeUploader');
const { createAd, activateCampaign, getCampaignId } = require('./campaignManager');
const predis = require('./predisClient');

// Known popular spots to feature in ads
const FEATURED_SPOTS = [
  'pipeline', 'teahupoo', 'nazare', 'bells-beach', 'jeffreys-bay',
  'hossegor', 'mundaka', 'uluwatu', 'snapper-rocks', 'trestles'
];

const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Fetch conditions for a spot from our own API
 */
async function fetchSpotConditions(spotId) {
  try {
    const port = process.env.PORT || 5000;
    const { data } = await axios.get(`http://localhost:${port}/api/conditions/${spotId}`, {
      timeout: 60000
    });
    return data;
  } catch {
    return null;
  }
}

/**
 * Find the best-scoring spot from the featured list
 */
async function findBestSpot() {
  const results = [];

  for (const spotId of FEATURED_SPOTS) {
    const data = await fetchSpotConditions(spotId);
    if (data?.score?.overall) {
      results.push({ spotId, data, score: data.score.overall });
    }
    if (results.length >= 3) break; // Don't hammer our own API
  }

  results.sort((a, b) => b.score - a.score);
  return results[0] || null;
}

/**
 * Generate a post via Predis.ai using live surf data
 * Returns the generated post (image URLs + caption) or null
 */
async function generatePredisPost() {
  if (!predis.isConfigured()) {
    logger.info('[Marketing] Predis not configured — skipping post generation');
    return null;
  }

  logger.info('[Marketing] Generating post via Predis.ai...');

  const best = await findBestSpot();
  if (!best) {
    logger.warn('[Marketing] Could not fetch conditions for any spot — skipping');
    return null;
  }

  const spotName = best.data.spotName || best.spotId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  logger.info(`[Marketing] Using spot: ${spotName} (score: ${best.score})`);

  const prompt = predis.buildSurfPrompt(spotName, best.data);
  const post = await predis.createAndWait(prompt);

  if (post) {
    logger.info(`[Marketing] Predis post ready — caption: ${post.caption?.slice(0, 80)}...`);
  }

  return post;
}

/**
 * Refresh Meta Advantage+ creatives with fresh surf data
 * Called weekly by the scheduler (only when Meta is configured)
 */
async function refreshCreatives() {
  if (!isMetaConfigured()) {
    logger.info('[Marketing] Meta not configured — skipping creative refresh');
    return;
  }

  if (!getCampaignId()) {
    logger.info('[Marketing] No campaign set up — skipping. Run POST /api/marketing/setup first.');
    return;
  }

  logger.info('[Marketing] Starting weekly creative refresh...');

  try {
    const best = await findBestSpot();
    if (!best) {
      logger.warn('[Marketing] Could not fetch conditions — skipping');
      return;
    }

    const spotName = best.data.spotName || best.spotId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    logger.info(`[Marketing] Best spot: ${spotName} (score: ${best.score})`);

    // If Predis is configured, use its generated image as seed
    let imageUrl = 'https://shouldigo.surf/logo512.png';
    if (predis.isConfigured()) {
      const predisPost = await generatePredisPost();
      if (predisPost?.urls?.[0]) {
        imageUrl = predisPost.urls[0];
      }
    }

    const { primaryTexts, headline } = generateAdContent(best.data, spotName);
    const imageHash = await uploadImage(imageUrl);
    if (!imageHash) {
      logger.error('[Marketing] Failed to upload seed image — aborting');
      return;
    }

    const linkUrl = process.env.META_AD_URL || 'https://shouldigo.surf?utm_source=instagram&utm_medium=paid&utm_campaign=advantage_plus';
    const creativeId = await createCreative({
      imageHashes: [imageHash],
      primaryTexts,
      headline,
      linkUrl
    });

    if (!creativeId) {
      logger.error('[Marketing] Failed to create creative — aborting');
      return;
    }

    const adId = await createAd(creativeId);
    if (adId) {
      await activateCampaign();
      logger.info(`[Marketing] Creative refresh complete — new ad ${adId} is live`);
    }
  } catch (err) {
    logger.error(`[Marketing] Creative refresh failed: ${err.message}`);
  }
}

/**
 * Start the marketing scheduler
 * - Predis only: generates posts daily (user uploads manually)
 * - Meta configured: refreshes ad creatives weekly
 */
function startMarketingScheduler() {
  const hasPredis = predis.isConfigured();
  const hasMeta = isMetaConfigured();

  if (!hasPredis && !hasMeta) {
    logger.info('[Marketing] Neither Predis nor Meta configured — scheduler disabled');
    return;
  }

  if (hasPredis) {
    logger.info('[Marketing] Predis scheduler started — generates posts daily');
    // Generate first post after 5 minutes
    setTimeout(() => {
      generatePredisPost().catch(err => logger.error(`[Marketing] Predis generation failed: ${err.message}`));
    }, 5 * 60 * 1000);

    // Then daily
    setInterval(() => {
      generatePredisPost().catch(err => logger.error(`[Marketing] Predis generation failed: ${err.message}`));
    }, DAILY_INTERVAL_MS);
  }

  if (hasMeta) {
    logger.info('[Marketing] Meta scheduler started — refreshes creatives weekly');
    setTimeout(() => {
      refreshCreatives().catch(err => logger.error(`[Marketing] Meta refresh failed: ${err.message}`));
    }, 10 * 60 * 1000);

    setInterval(() => {
      refreshCreatives().catch(err => logger.error(`[Marketing] Meta refresh failed: ${err.message}`));
    }, WEEKLY_INTERVAL_MS);
  }
}

module.exports = { startMarketingScheduler, refreshCreatives, generatePredisPost, findBestSpot };
