const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Scrape API.MET.NO (YR.NO) for wind and weather data
 * Free JSON API - requires proper User-Agent header
 */

const SPOT_COORDS = {
  herzliya_marina: { lat: 32.1541, lon: 34.7944 },
  netanya_kontiki: { lat: 32.3335, lon: 34.8597 },
  tel_aviv_maaravi: { lat: 32.0602, lon: 34.7588 }
};

async function scrapeMetNo(spotId) {
  try {
    const coords = SPOT_COORDS[spotId];
    if (!coords) {
      logger.warn(`[MET.NO] No coordinates for spot: ${spotId}`);
      return null;
    }

    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${coords.lat}&lon=${coords.lon}`;

    logger.info(`[MET.NO] Fetching ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'SurfReport/1.0 (https://github.com/orlench/surf_report)'
      },
      timeout: 10000
    });

    const data = response.data;

    // Get current time data
    const timeseries = data.properties?.timeseries;
    if (!timeseries || timeseries.length === 0) {
      logger.warn(`[MET.NO] No timeseries data returned`);
      return null;
    }

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

    // Use first entry (current time)
    const current = timeseries[0].data.instant.details;

    // Wind data (convert m/s to km/h)
    if (current.wind_speed !== undefined) {
      conditions.wind.speed = Math.round(current.wind_speed * 3.6);
      logger.debug(`[MET.NO] Wind speed: ${conditions.wind.speed} km/h`);
    }

    if (current.wind_from_direction !== undefined) {
      conditions.wind.direction = degreesToCardinal(current.wind_from_direction);
      logger.debug(`[MET.NO] Wind direction: ${conditions.wind.direction}`);
    }

    // Wind gusts (if available in next_1_hours)
    const next1h = timeseries[0].data.next_1_hours?.details;
    if (next1h?.wind_speed_of_gust !== undefined) {
      conditions.wind.gusts = Math.round(next1h.wind_speed_of_gust * 3.6);
      logger.debug(`[MET.NO] Wind gusts: ${conditions.wind.gusts} km/h`);
    }

    // Temperature
    if (current.air_temperature !== undefined) {
      conditions.weather.airTemp = Math.round(current.air_temperature);
      logger.debug(`[MET.NO] Air temp: ${conditions.weather.airTemp}°C`);
    }

    // Cloud cover
    if (current.cloud_area_fraction !== undefined) {
      const cloudPercent = current.cloud_area_fraction;
      if (cloudPercent < 25) {
        conditions.weather.cloudCover = 'Clear';
      } else if (cloudPercent < 50) {
        conditions.weather.cloudCover = 'Partly cloudy';
      } else if (cloudPercent < 75) {
        conditions.weather.cloudCover = 'Cloudy';
      } else {
        conditions.weather.cloudCover = 'Overcast';
      }
      logger.debug(`[MET.NO] Cloud cover: ${conditions.weather.cloudCover} (${cloudPercent}%)`);
    }

    logger.info(`[MET.NO] Successfully fetched wind/weather data`);
    return conditions;

  } catch (error) {
    logger.error(`[MET.NO] Failed:`, error.message);
    return null;
  }
}

/**
 * Convert degrees to cardinal direction
 */
function degreesToCardinal(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees % 360) / 45)) % 8;
  return directions[index];
}

module.exports = {
  scrapeMetNo
};
