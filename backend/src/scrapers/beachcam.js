const brightData = require('../integrations/brightData');
const { parseBeachCam, getBeachCamURL } = require('../parsers/beachcam');
const logger = require('../utils/logger');

/**
 * Scrape beachcam.co.il for Israeli beach conditions via Bright Data MCP
 * Israeli-specific site with local forecasts for Herzliya/Netanya area
 */

async function scrapeBeachCam(spotId) {
  const url = getBeachCamURL(spotId);

  logger.info(`[BeachCam] Scraping ${url} via Bright Data`);

  const markdown = await brightData.scrapeAsMarkdown(url);
  return parseBeachCam(markdown, spotId);
}

module.exports = { scrapeBeachCam };
