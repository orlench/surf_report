const logger = require('../../utils/logger');
const { isConfigured: isMetaConfigured } = require('./tokenManager');
const { uploadImage, createCreative, generateLocationAdContent } = require('./creativeUploader');
const { createAd, activateCampaign, getCampaignId } = require('./campaignManager');

const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    const imageUrl = 'https://shouldigo.surf/logo512.png';
    const imageHash = await uploadImage(imageUrl);
    if (!imageHash) {
      logger.error('[Marketing] Failed to upload seed image — aborting');
      return;
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
