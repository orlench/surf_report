const { scrapeBeachCam } = require('../scrapers/beachcam');
const { scrapeSurfForecast } = require('../scrapers/surfForecast');
const { scrapeWindFinder } = require('../scrapers/windFinder');
const { scrapeMagicseaweed } = require('../scrapers/magicseaweed');
const { scrapeMockData } = require('../scrapers/mockData');
const { scrapeOpenMeteo } = require('../scrapers/openMeteo');
const { scrapeMetNo } = require('../scrapers/metNo');
const { scrapeOpenMeteoForecast } = require('../scrapers/openMeteoForecast');
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

  // Run all scrapers in parallel - use all available data even if partial
  const scrapers = [
    // Free JSON API sources (no auth)
    scrapeOpenMeteoWrapper(spotId),         // Wave + swell data (Open-Meteo Marine)
    scrapeMetNoWrapper(spotId),             // Wind/weather data (MET.NO)
    scrapeOpenMeteoForecastWrapper(spotId), // Wind data (Open-Meteo ECMWF atmospheric)
    // Web scrapers via Bright Data MCP
    scrapeBeachCamWrapper(spotId),          // Israeli beach conditions (beachcam.co.il)
    scrapeSurfForecastWrapper(spotId),      // surf-forecast.com - processed surf data
    scrapeWindFinderWrapper(spotId),        // windfinder.com - wind specialist
    scrapeMagicseaweedWrapper(spotId),      // magicseaweed.com - surf forecast
  ];

  // Execute all scrapers in parallel
  const results = await Promise.allSettled(scrapers);

  // Filter successful results (fulfilled and not null)
  const successfulData = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  // Log failures
  const failures = results.filter(r => r.status === 'rejected');
  const nullResults = results.filter(r => r.status === 'fulfilled' && r.value === null);

  if (failures.length > 0) {
    logger.warn(`[Scraper] ${failures.length} source(s) threw errors:`,
      failures.map((r, i) => `${i}: ${r.reason}`)
    );
  }

  if (nullResults.length > 0) {
    logger.warn(`[Scraper] ${nullResults.length} source(s) returned no data`);
  }

  if (successfulData.length === 0) {
    logger.error(`[Scraper] All data sources failed for ${spotId}`);
    throw new Error('All data sources failed');
  }

  logger.info(`[Scraper] Successfully fetched data from ${successfulData.length}/${scrapers.length} source(s)`);
  return successfulData;
}

/**
 * Wrapper functions for each scraper - return null on failure instead of throwing
 * This allows us to use partial data from successful sources
 */

async function scrapeSurfForecastWrapper(spotId) {
  try {
    logger.info(`[Scraper] Scraping Surf-forecast for ${spotId}`);
    const data = await scrapeSurfForecast(spotId);

    if (!data) return null;

    return {
      source: 'surf-forecast',
      data: data,
      timestamp: new Date().toISOString(),
      url: 'https://www.surf-forecast.com'
    };
  } catch (error) {
    logger.error(`[Scraper] Surf-forecast failed:`, error.message);
    return null;
  }
}

async function scrapeWindFinderWrapper(spotId) {
  try {
    logger.info(`[Scraper] Scraping WindFinder for ${spotId}`);
    const data = await scrapeWindFinder(spotId);

    if (!data) return null;

    return {
      source: 'windfinder',
      data: data,
      timestamp: new Date().toISOString(),
      url: 'https://www.windfinder.com'
    };
  } catch (error) {
    logger.error(`[Scraper] WindFinder failed:`, error.message);
    return null;
  }
}

async function scrapeMagicseaweedWrapper(spotId) {
  try {
    logger.info(`[Scraper] Scraping Magicseaweed for ${spotId}`);
    const data = await scrapeMagicseaweed(spotId);

    if (!data) return null;

    return {
      source: 'magicseaweed',
      data: data,
      timestamp: new Date().toISOString(),
      url: 'https://magicseaweed.com'
    };
  } catch (error) {
    logger.error(`[Scraper] Magicseaweed failed:`, error.message);
    return null;
  }
}

async function scrapeBeachCamWrapper(spotId) {
  try {
    logger.info(`[Scraper] Scraping BeachCam for ${spotId}`);
    const data = await scrapeBeachCam(spotId);

    if (!data) return null;

    return {
      source: 'beachcam',
      data: data,
      timestamp: new Date().toISOString(),
      url: 'https://www.beachcam.co.il'
    };
  } catch (error) {
    logger.error(`[Scraper] BeachCam failed:`, error.message);
    return null;
  }
}

async function scrapeMockDataWrapper(spotId) {
  try {
    logger.info(`[Scraper] Getting mock data for ${spotId}`);
    const data = await scrapeMockData(spotId);

    if (!data) return null;

    return {
      source: 'mock-data',
      data: data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`[Scraper] Mock data failed:`, error.message);
    return null;
  }
}

async function scrapeOpenMeteoWrapper(spotId) {
  try {
    logger.info(`[Scraper] Scraping Open-Meteo for ${spotId}`);
    const data = await scrapeOpenMeteo(spotId);

    if (!data) return null;

    return {
      source: 'open-meteo',
      data: data,
      timestamp: new Date().toISOString(),
      url: 'https://open-meteo.com'
    };
  } catch (error) {
    logger.error(`[Scraper] Open-Meteo failed:`, error.message);
    return null;
  }
}

async function scrapeMetNoWrapper(spotId) {
  try {
    logger.info(`[Scraper] Scraping MET.NO for ${spotId}`);
    const data = await scrapeMetNo(spotId);

    if (!data) return null;

    return {
      source: 'met-no',
      data: data,
      timestamp: new Date().toISOString(),
      url: 'https://www.met.no'
    };
  } catch (error) {
    logger.error(`[Scraper] MET.NO failed:`, error.message);
    return null;
  }
}

async function scrapeOpenMeteoForecastWrapper(spotId) {
  try {
    logger.info(`[Scraper] Scraping Open-Meteo Forecast (ECMWF) for ${spotId}`);
    const data = await scrapeOpenMeteoForecast(spotId);

    if (!data) return null;

    return {
      source: 'open-meteo-forecast',
      data: data,
      timestamp: new Date().toISOString(),
      url: 'https://open-meteo.com'
    };
  } catch (error) {
    logger.error(`[Scraper] Open-Meteo Forecast failed:`, error.message);
    return null;
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
      direction: null,
      swell: null
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
    windGusts: [],
    airTemp: [],
    waterTemp: [],
    swellHeight: [],
    swellPeriod: []
  };

  // Most common wind/wave directions
  const windDirections = [];
  const waveDirections = [];
  const swellDirections = [];

  // Extract values from each source - use ALL available data
  for (const source of sources) {
    const data = source.data;

    if (data.waves?.height?.min) values.waveHeightMin.push(data.waves.height.min);
    if (data.waves?.height?.max) values.waveHeightMax.push(data.waves.height.max);
    if (data.waves?.height?.avg) values.waveHeightAvg.push(data.waves.height.avg);
    if (data.waves?.period) values.wavePeriod.push(data.waves.period);
    if (data.waves?.direction) waveDirections.push(data.waves.direction);

    if (data.waves?.swell?.height) values.swellHeight.push(data.waves.swell.height);
    if (data.waves?.swell?.period) values.swellPeriod.push(data.waves.swell.period);
    if (data.waves?.swell?.direction) swellDirections.push(data.waves.swell.direction);

    if (data.wind?.speed) values.windSpeed.push(data.wind.speed);
    if (data.wind?.gusts) values.windGusts.push(data.wind.gusts);
    if (data.wind?.direction) windDirections.push(data.wind.direction);

    if (data.weather?.airTemp) values.airTemp.push(data.weather.airTemp);
    if (data.weather?.waterTemp) values.waterTemp.push(data.weather.waterTemp);
  }

  // Calculate averages
  if (values.waveHeightAvg.length > 0) {
    aggregated.waves.height.avg = Math.round(average(values.waveHeightAvg) * 10) / 10;
  }

  // Reality check: if swell height is available, cap wave height
  // Many sources report "significant wave height" (swell + wind chop combined),
  // which inflates the number beyond what surfers actually see.
  // Face height at a beach break ≈ swell height × 1.3-1.5
  const swellH = values.swellHeight.length > 0 ? average(values.swellHeight) : null;
  if (swellH && aggregated.waves.height.avg !== null) {
    const maxRealisticHeight = Math.round(swellH * 1.4 * 10) / 10; // beach break multiplier
    if (aggregated.waves.height.avg > maxRealisticHeight) {
      logger.info(`[Scraper] Capping wave height from ${aggregated.waves.height.avg}m to ${maxRealisticHeight}m (swell: ${Math.round(swellH * 10) / 10}m)`);
      aggregated.waves.height.avg = maxRealisticHeight;
    }
  }

  // Tighten min/max range to max 0.2m gap centered on avg
  const avg = aggregated.waves.height.avg;
  if (avg !== null) {
    const maxGap = 0.2;
    aggregated.waves.height.min = Math.round((avg - maxGap / 2) * 10) / 10;
    aggregated.waves.height.max = Math.round((avg + maxGap / 2) * 10) / 10;
    // Ensure min doesn't go below 0
    if (aggregated.waves.height.min < 0) aggregated.waves.height.min = 0;
  }
  if (values.wavePeriod.length > 0) {
    aggregated.waves.period = Math.round(average(values.wavePeriod));
  }
  if (values.windSpeed.length > 0) {
    aggregated.wind.speed = Math.round(average(values.windSpeed));
  }
  if (values.windGusts.length > 0) {
    aggregated.wind.gusts = Math.round(average(values.windGusts));
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

  // Aggregate swell data
  if (values.swellHeight.length > 0) {
    aggregated.waves.swell = {
      height: Math.round(average(values.swellHeight) * 10) / 10,
      period: values.swellPeriod.length > 0 ? Math.round(average(values.swellPeriod)) : null,
      direction: mostCommon(swellDirections)
    };
  }

  logger.debug(`[Scraper] Aggregated from ${sources.length} sources: ` +
    `waves=${aggregated.waves.height.avg}m @ ${aggregated.waves.period}s, ` +
    `wind=${aggregated.wind.speed}km/h ${aggregated.wind.direction}`);

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

/**
 * Aggregate hourly forecast data from all sources into a unified timeline
 * Merges wave data (Open-Meteo Marine) with wind data (Open-Meteo Forecast, MET.NO, web scrapers)
 *
 * @param {Array} sources - Array of source data objects (each has .data.hourly)
 * @returns {Array} - Merged hourly timeline sorted by time
 */
function aggregateHourlyData(sources) {
  // Collect all hourly entries keyed by hour
  const hourMap = {};

  for (const source of sources) {
    const hourlyEntries = source.data?.hourly;
    if (!hourlyEntries || !Array.isArray(hourlyEntries)) continue;

    for (const entry of hourlyEntries) {
      if (!entry.time) continue;
      // Normalize to hour key (YYYY-MM-DDTHH:00)
      const hourKey = entry.time.substring(0, 13) + ':00';

      if (!hourMap[hourKey]) {
        hourMap[hourKey] = {
          time: hourKey,
          waveHeights: [],
          wavePeriods: [],
          waveDirections: [],
          swellHeights: [],
          swellPeriods: [],
          swellDirections: [],
          windSpeeds: [],
          windDirections: [],
          windGusts: [],
          airTemps: []
        };
      }

      const h = hourMap[hourKey];
      if (entry.waves?.height?.avg) h.waveHeights.push(entry.waves.height.avg);
      if (entry.waves?.period) h.wavePeriods.push(entry.waves.period);
      if (entry.waves?.direction) h.waveDirections.push(entry.waves.direction);
      if (entry.waves?.swell?.height) h.swellHeights.push(entry.waves.swell.height);
      if (entry.waves?.swell?.period) h.swellPeriods.push(entry.waves.swell.period);
      if (entry.waves?.swell?.direction) h.swellDirections.push(entry.waves.swell.direction);
      if (entry.wind?.speed) h.windSpeeds.push(entry.wind.speed);
      if (entry.wind?.direction) h.windDirections.push(entry.wind.direction);
      if (entry.wind?.gusts) h.windGusts.push(entry.wind.gusts);
      if (entry.weather?.airTemp) h.airTemps.push(entry.weather.airTemp);
    }
  }

  // Convert to conditions-like objects for scoring
  const timeline = Object.values(hourMap)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(h => ({
      time: h.time,
      waves: {
        height: { avg: h.waveHeights.length > 0 ? Math.round(average(h.waveHeights) * 10) / 10 : null },
        period: h.wavePeriods.length > 0 ? Math.round(average(h.wavePeriods)) : null,
        direction: mostCommon(h.waveDirections),
        swell: h.swellHeights.length > 0 ? {
          height: Math.round(average(h.swellHeights) * 10) / 10,
          period: h.swellPeriods.length > 0 ? Math.round(average(h.swellPeriods)) : null,
          direction: mostCommon(h.swellDirections)
        } : null
      },
      wind: {
        speed: h.windSpeeds.length > 0 ? Math.round(average(h.windSpeeds)) : null,
        direction: mostCommon(h.windDirections),
        gusts: h.windGusts.length > 0 ? Math.round(average(h.windGusts)) : null
      },
      weather: {
        airTemp: h.airTemps.length > 0 ? Math.round(average(h.airTemps)) : null
      }
    }));

  logger.info(`[Scraper] Aggregated ${timeline.length} hourly entries from ${sources.length} sources`);
  return timeline;
}

module.exports = {
  fetchSurfData,
  aggregateData,
  aggregateHourlyData
};
