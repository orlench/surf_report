const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * Scrape surf-forecast.com for Israeli surf spots
 * Provides: wave height, period, wind speed/direction, weather
 */

const SPOT_URLS = {
  herzliya_marina: 'https://www.surf-forecast.com/breaks/Herzliya/forecasts/latest/six_day',
  netanya_kontiki: 'https://www.surf-forecast.com/breaks/Netanya/forecasts/latest/six_day'
};

async function scrapeSurfForecast(spotId) {
  try {
    const url = SPOT_URLS[spotId];
    if (!url) {
      logger.warn(`[Surf-forecast] No URL configured for spot: ${spotId}`);
      return null;
    }

    logger.info(`[Surf-forecast] Scraping ${url}`);

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

    // Get current/first forecast row
    const firstRow = $('.forecast-table tbody tr').first();

    // Wave height (in meters)
    const waveHeight = firstRow.find('.forecast-table__cell--height').first().text().trim();
    const waveMatch = waveHeight.match(/([\d.]+)/);
    if (waveMatch) {
      const height = parseFloat(waveMatch[1]);
      conditions.waves.height = {
        min: Math.round((height * 0.8) * 10) / 10,
        max: Math.round((height * 1.2) * 10) / 10,
        avg: Math.round(height * 10) / 10
      };
      logger.debug(`[Surf-forecast] Wave height: ${height}m`);
    }

    // Wave period (seconds)
    const period = firstRow.find('.forecast-table__cell--period').first().text().trim();
    const periodMatch = period.match(/(\d+)/);
    if (periodMatch) {
      conditions.waves.period = parseInt(periodMatch[1]);
      logger.debug(`[Surf-forecast] Wave period: ${conditions.waves.period}s`);
    }

    // Wind speed and direction
    const wind = firstRow.find('.forecast-table__cell--wind').first();
    const windSpeed = wind.find('.wind-icon__val').text().trim();
    const windDir = wind.find('.wind-icon__tooltip').text().trim();

    if (windSpeed) {
      const speedMatch = windSpeed.match(/(\d+)/);
      if (speedMatch) {
        conditions.wind.speed = parseInt(speedMatch[1]);
        logger.debug(`[Surf-forecast] Wind speed: ${conditions.wind.speed} km/h`);
      }
    }

    if (windDir) {
      const dirMatch = windDir.match(/([NESW]+)/i);
      if (dirMatch) {
        conditions.wind.direction = dirMatch[1].toUpperCase();
        logger.debug(`[Surf-forecast] Wind direction: ${conditions.wind.direction}`);
      }
    }

    // Water temperature
    const waterTemp = $('.forecast-table-water-temp__value').first().text().trim();
    const tempMatch = waterTemp.match(/(\d+)/);
    if (tempMatch) {
      conditions.weather.waterTemp = parseInt(tempMatch[1]);
      logger.debug(`[Surf-forecast] Water temp: ${conditions.weather.waterTemp}°C`);
    }

    // Air temperature
    const airTemp = firstRow.find('.forecast-table__cell--temperature').first().text().trim();
    const airTempMatch = airTemp.match(/(\d+)/);
    if (airTempMatch) {
      conditions.weather.airTemp = parseInt(airTempMatch[1]);
      logger.debug(`[Surf-forecast] Air temp: ${conditions.weather.airTemp}°C`);
    }

    logger.info(`[Surf-forecast] Successfully scraped data`);
    return conditions;

  } catch (error) {
    logger.error(`[Surf-forecast] Scraping failed:`, error.message);
    return null;
  }
}

module.exports = {
  scrapeSurfForecast,
  SPOT_URLS
};
