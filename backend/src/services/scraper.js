const brightData = require('../integrations/brightData');
const { parseBeachCam, getBeachCamURL } = require('../parsers/beachcam');
const logger = require('../utils/logger');

/**
 * Fetch surf data from all available sources
 * Scrapes multiple websites in parallel and aggregates results
 *
 * @param {string} spotId - Spot identifier
 * @returns {Promise<Array>} - Array of scraped data from different sources
 */
async function fetchSurfData(spotId) {
  logger.info(`[Scraper] Fetching surf data for ${spotId}`);

  const scrapers = [
    scrapeBeachCam(spotId),
    // Add more scrapers here later:
    // scrapeSurfForecast(spotId),
    // scrapeIMS(spotId),
  ];

  // Execute all scrapers in parallel
  const results = await Promise.allSettled(scrapers);

  // Filter successful results
  const successfulData = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  // Log failures
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    logger.warn(`[Scraper] ${failures.length} source(s) failed:`,
      failures.map((r, i) => `${i}: ${r.reason}`)
    );
  }

  if (successfulData.length === 0) {
    logger.error(`[Scraper] All data sources failed for ${spotId}`);
    throw new Error('All data sources failed');
  }

  logger.info(`[Scraper] Successfully fetched data from ${successfulData.length}/${scrapers.length} source(s)`);
  return successfulData;
}

/**
 * Scrape BeachCam.co.il
 */
async function scrapeBeachCam(spotId) {
  try {
    logger.info(`[Scraper] Scraping BeachCam for ${spotId}`);

    const url = getBeachCamURL(spotId);
    const markdown = await brightData.scrapeAsMarkdown(url);
    const parsed = parseBeachCam(markdown, spotId);

    return {
      source: 'beachcam',
      data: parsed,
      timestamp: new Date().toISOString(),
      url: url
    };
  } catch (error) {
    logger.error(`[Scraper] BeachCam scraping failed:`, error.message);
    throw new Error(`BeachCam: ${error.message}`);
  }
}

/**
 * Aggregate data from multiple sources
 * Combines data from different sources into a single conditions object
 *
 * @param {Array} sources - Array of source data
 * @returns {Object} - Aggregated conditions
 */
function aggregateData(sources) {
  logger.info(`[Scraper] Aggregating data from ${sources.length} source(s)`);

  // Initialize aggregated conditions
  const aggregated = {
    waves: {
      height: { min: null, max: null, avg: null },
      period: null,
      direction: null
    },
    wind: {
      speed: null,
      direction: null,
      gusts: null
    },
    weather: {
      airTemp: null,
      waterTemp: null,
      cloudCover: null
    },
    tide: {
      current: null,
      height: null
    }
  };

  // Collect all values for averaging
  const values = {
    waveHeightMin: [],
    waveHeightMax: [],
    waveHeightAvg: [],
    wavePeriod: [],
    windSpeed: [],
    airTemp: [],
    waterTemp: []
  };

  // Most common wind/wave directions
  const windDirections = [];
  const waveDirections = [];

  // Extract values from each source
  for (const source of sources) {
    const data = source.data;

    if (data.waves?.height?.min) values.waveHeightMin.push(data.waves.height.min);
    if (data.waves?.height?.max) values.waveHeightMax.push(data.waves.height.max);
    if (data.waves?.height?.avg) values.waveHeightAvg.push(data.waves.height.avg);
    if (data.waves?.period) values.wavePeriod.push(data.waves.period);
    if (data.waves?.direction) waveDirections.push(data.waves.direction);

    if (data.wind?.speed) values.windSpeed.push(data.wind.speed);
    if (data.wind?.direction) windDirections.push(data.wind.direction);

    if (data.weather?.airTemp) values.airTemp.push(data.weather.airTemp);
    if (data.weather?.waterTemp) values.waterTemp.push(data.weather.waterTemp);
  }

  // Calculate averages
  if (values.waveHeightMin.length > 0) {
    aggregated.waves.height.min = Math.round(average(values.waveHeightMin) * 10) / 10;
  }
  if (values.waveHeightMax.length > 0) {
    aggregated.waves.height.max = Math.round(average(values.waveHeightMax) * 10) / 10;
  }
  if (values.waveHeightAvg.length > 0) {
    aggregated.waves.height.avg = Math.round(average(values.waveHeightAvg) * 10) / 10;
  }
  if (values.wavePeriod.length > 0) {
    aggregated.waves.period = Math.round(average(values.wavePeriod));
  }
  if (values.windSpeed.length > 0) {
    aggregated.wind.speed = Math.round(average(values.windSpeed));
  }
  if (values.airTemp.length > 0) {
    aggregated.weather.airTemp = Math.round(average(values.airTemp));
  }
  if (values.waterTemp.length > 0) {
    aggregated.weather.waterTemp = Math.round(average(values.waterTemp));
  }

  // Use most common direction
  aggregated.waves.direction = mostCommon(waveDirections);
  aggregated.wind.direction = mostCommon(windDirections);

  logger.info(`[Scraper] Aggregation complete`);
  return aggregated;
}

/**
 * Helper: Calculate average of numbers
 */
function average(arr) {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Helper: Find most common item in array
 */
function mostCommon(arr) {
  if (arr.length === 0) return null;

  const counts = {};
  let maxCount = 0;
  let mostCommonItem = null;

  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      mostCommonItem = item;
    }
  }

  return mostCommonItem;
}

module.exports = {
  fetchSurfData,
  aggregateData,
  scrapeBeachCam
};
