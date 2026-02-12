const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * Scrape windfinder.com for wind conditions
 * Provides: wind speed, direction, gusts
 */

const SPOT_URLS = {
  herzliya_marina: 'https://www.windfinder.com/forecast/herzliya',
  netanya_kontiki: 'https://www.windfinder.com/forecast/netanya'
};

async function scrapeWindFinder(spotId) {
  try {
    const url = SPOT_URLS[spotId];
    if (!url) {
      logger.warn(`[WindFinder] No URL configured for spot: ${spotId}`);
      return null;
    }

    logger.info(`[WindFinder] Scraping ${url}`);

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

    // Get first forecast data point
    const firstDataCell = $('.weathertable tbody tr').first();

    // Wind speed (convert knots to km/h)
    const windSpeed = firstDataCell.find('.wind').first().text().trim();
    const speedMatch = windSpeed.match(/(\d+)/);
    if (speedMatch) {
      const knots = parseInt(speedMatch[1]);
      conditions.wind.speed = Math.round(knots * 1.852); // knots to km/h
      logger.debug(`[WindFinder] Wind speed: ${conditions.wind.speed} km/h`);
    }

    // Wind direction
    const windDir = firstDataCell.find('.wind-unit__dir').text().trim();
    if (windDir) {
      conditions.wind.direction = windDir.toUpperCase();
      logger.debug(`[WindFinder] Wind direction: ${conditions.wind.direction}`);
    }

    // Gusts
    const gusts = firstDataCell.find('.gusts').text().trim();
    const gustsMatch = gusts.match(/(\d+)/);
    if (gustsMatch) {
      const gustsKnots = parseInt(gustsMatch[1]);
      conditions.wind.gusts = Math.round(gustsKnots * 1.852);
      logger.debug(`[WindFinder] Wind gusts: ${conditions.wind.gusts} km/h`);
    }

    // Air temperature
    const temp = firstDataCell.find('.temperature').first().text().trim();
    const tempMatch = temp.match(/(\d+)/);
    if (tempMatch) {
      conditions.weather.airTemp = parseInt(tempMatch[1]);
      logger.debug(`[WindFinder] Air temp: ${conditions.weather.airTemp}°C`);
    }

    logger.info(`[WindFinder] Successfully scraped data`);
    return conditions;

  } catch (error) {
    logger.error(`[WindFinder] Scraping failed:`, error.message);
    return null;
  }
}

module.exports = {
  scrapeWindFinder,
  SPOT_URLS
};
