const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * Scrape magicseaweed.com for wave conditions
 * Provides: wave height, period, direction
 */

const SPOT_URLS = {
  herzliya_marina: 'https://magicseaweed.com/Herzliya-Surf-Report/5359/',
  netanya_kontiki: 'https://magicseaweed.com/Netanya-Surf-Report/5360/'
};

async function scrapeMagicseaweed(spotId) {
  try {
    const url = SPOT_URLS[spotId];
    if (!url) {
      logger.warn(`[Magicseaweed] No URL configured for spot: ${spotId}`);
      return null;
    }

    logger.info(`[Magicseaweed] Scraping ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const conditions = {
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
      }
    };

    // Get current forecast
    const currentForecast = $('.forecast-table__row').first();

    // Wave height (convert feet to meters if needed)
    const waveHeight = currentForecast.find('.forecast-table__cell--swell-height').text().trim();
    const heightMatch = waveHeight.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (heightMatch) {
      const min = parseFloat(heightMatch[1]) * 0.3048; // feet to meters
      const max = parseFloat(heightMatch[2]) * 0.3048;
      conditions.waves.height = {
        min: Math.round(min * 10) / 10,
        max: Math.round(max * 10) / 10,
        avg: Math.round(((min + max) / 2) * 10) / 10
      };
      logger.debug(`[Magicseaweed] Wave height: ${conditions.waves.height.avg}m`);
    }

    // Wave period
    const period = currentForecast.find('.forecast-table__cell--swell-period').text().trim();
    const periodMatch = period.match(/(\d+)/);
    if (periodMatch) {
      conditions.waves.period = parseInt(periodMatch[1]);
      logger.debug(`[Magicseaweed] Wave period: ${conditions.waves.period}s`);
    }

    // Wave direction
    const waveDir = currentForecast.find('.forecast-table__cell--swell-direction').attr('title');
    if (waveDir) {
      const dirMatch = waveDir.match(/([NESW]+)/i);
      if (dirMatch) {
        conditions.waves.direction = dirMatch[1].toUpperCase();
        logger.debug(`[Magicseaweed] Wave direction: ${conditions.waves.direction}`);
      }
    }

    // Wind data (if available)
    const windSpeed = currentForecast.find('.forecast-table__cell--wind-speed').text().trim();
    const windMatch = windSpeed.match(/(\d+)/);
    if (windMatch) {
      conditions.wind.speed = parseInt(windMatch[1]);
      logger.debug(`[Magicseaweed] Wind speed: ${conditions.wind.speed} km/h`);
    }

    const windDirection = currentForecast.find('.forecast-table__cell--wind-direction').attr('title');
    if (windDirection) {
      const windDirMatch = windDirection.match(/([NESW]+)/i);
      if (windDirMatch) {
        conditions.wind.direction = windDirMatch[1].toUpperCase();
        logger.debug(`[Magicseaweed] Wind direction: ${conditions.wind.direction}`);
      }
    }

    logger.info(`[Magicseaweed] Successfully scraped data`);
    return conditions;

  } catch (error) {
    logger.error(`[Magicseaweed] Scraping failed:`, error.message);
    return null;
  }
}

module.exports = {
  scrapeMagicseaweed,
  SPOT_URLS
};
