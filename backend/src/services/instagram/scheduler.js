const axios = require('axios');
const logger = require('../../utils/logger');
const { isConfigured } = require('./tokenManager');
const { uploadImage, createCreative, generateAdContent } = require('./creativeUploader');
const { createAd, activateCampaign, getCampaignId } = require('./campaignManager');

// Known popular spots to feature in ads
const FEATURED_SPOTS = [
  'pipeline', 'teahupoo', 'nazare', 'bells-beach', 'jeffreys-bay',
  'hossegor', 'mundaka', 'uluwatu', 'snapper-rocks', 'trestles'
];

const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const API_BASE = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5001';

/**
 * Fetch conditions for a spot from our own API
 */
async function fetchSpotConditions(spotId) {
  try {
    const { data } = await axios.get(`${API_BASE}/api/conditions/${spotId}`, {
      timeout: 30000
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
 * Refresh creatives with fresh surf data
 * Called weekly by the scheduler
 */
async function refreshCreatives() {
  if (!isConfigured()) {
    logger.info('[Marketing] Meta not configured — skipping creative refresh');
    return;
  }

  if (!getCampaignId()) {
    logger.info('[Marketing] No campaign set up — skipping creative refresh. Run POST /api/marketing/setup first.');
    return;
  }

  logger.info('[Marketing] Starting weekly creative refresh...');

  try {
    // Find the best spot right now
    const best = await findBestSpot();
    if (!best) {
      logger.warn('[Marketing] Could not fetch conditions for any featured spot — skipping');
      return;
    }

    const spotName = best.data.spotName || best.spotId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    logger.info(`[Marketing] Best spot: ${spotName} (score: ${best.score})`);

    // Generate ad content from conditions
    const { primaryTexts, headline } = generateAdContent(best.data, spotName);

    // Upload the app logo as seed image (Meta AI will create variations)
    const logoUrl = 'https://shouldigo.surf/logo512.png';
    const imageHash = await uploadImage(logoUrl);
    if (!imageHash) {
      logger.error('[Marketing] Failed to upload seed image — aborting');
      return;
    }

    // Create Advantage+ creative
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

    // Create ad with the new creative
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
 * Start the weekly creative refresh scheduler
 */
function startMarketingScheduler() {
  if (!isConfigured()) {
    logger.info('[Marketing] Meta credentials not configured — marketing scheduler disabled');
    return;
  }

  logger.info('[Marketing] Marketing scheduler started — refreshes creatives weekly');

  // First refresh after 5 minutes (let server fully boot)
  setTimeout(() => {
    refreshCreatives().catch(err => logger.error(`[Marketing] Scheduled refresh failed: ${err.message}`));
  }, 5 * 60 * 1000);

  // Then every 7 days
  setInterval(() => {
    refreshCreatives().catch(err => logger.error(`[Marketing] Scheduled refresh failed: ${err.message}`));
  }, WEEKLY_INTERVAL_MS);
}

module.exports = { startMarketingScheduler, refreshCreatives };
