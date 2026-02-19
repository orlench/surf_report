const brightData = require('../integrations/brightData');
const { parseBeachCam, getBeachCamURL } = require('../parsers/beachcam');
const { getSpotById } = require('../config/spots');
const logger = require('../utils/logger');

/**
 * Scrape beachcam.co.il for Israeli beach conditions via Bright Data MCP
 * Israeli-specific site - only works for Israeli spots
 */

async function scrapeBeachCam(spotId) {
  const spot = getSpotById(spotId);
  if (!spot || spot.country !== 'Israel') {
    logger.debug(`[BeachCam] Skipping non-Israeli spot: ${spotId}`);
    return null;
  }

  const url = getBeachCamURL(spotId);

  logger.info(`[BeachCam] Scraping ${url} via Bright Data`);

  const markdown = await brightData.scrapeAsMarkdown(url);
  return parseBeachCam(markdown, spotId);
}

module.exports = { scrapeBeachCam };
