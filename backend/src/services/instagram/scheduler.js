const axios = require('axios');
const logger = require('../../utils/logger');
const { isConfigured: isMetaConfigured } = require('./tokenManager');
const { uploadImage, createCreative, generateAdContent } = require('./creativeUploader');
const { createAd, activateCampaign, getCampaignId } = require('./campaignManager');

// Known popular spots to feature in ads
const FEATURED_SPOTS = [
  'pipeline', 'teahupoo', 'nazare', 'bells-beach', 'jeffreys-bay',
  'hossegor', 'mundaka', 'uluwatu', 'snapper-rocks', 'trestles'
];

const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
 * Refresh Meta Advantage+ creatives with fresh surf data
 * Called weekly by the scheduler
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

    const imageUrl = 'https://shouldigo.surf/logo512.png';
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
 * Refreshes ad creatives weekly when Meta is configured
 */
function startMarketingScheduler() {
  if (!isMetaConfigured()) {
    logger.info('[Marketing] Meta not configured — scheduler disabled');
    return;
  }

  logger.info('[Marketing] Scheduler started — refreshes creatives weekly');

  setTimeout(() => {
    refreshCreatives().catch(err => logger.error(`[Marketing] Refresh failed: ${err.message}`));
  }, 10 * 60 * 1000);

  setInterval(() => {
    refreshCreatives().catch(err => logger.error(`[Marketing] Refresh failed: ${err.message}`));
  }, WEEKLY_INTERVAL_MS);
}

module.exports = { startMarketingScheduler, refreshCreatives };
