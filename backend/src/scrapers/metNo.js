const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Scrape API.MET.NO (YR.NO) for wind and weather data
 * Free JSON API - requires proper User-Agent header
 */

const SPOT_COORDS = {
  herzliya_marina: { lat: 32.1541, lon: 34.7944 },
  netanya_kontiki: { lat: 32.3335, lon: 34.8597 },
  tel_aviv_maaravi: { lat: 32.0602, lon: 34.7588 },
  ocean_beach_sf: { lat: 37.7604, lon: -122.5107 }
};

function registerCoords(spotId, lat, lon) {
  SPOT_COORDS[spotId] = { lat, lon };
}

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

    // Extract hourly forecast for trend analysis (next 48 hours)
    const hourlyForecast = [];
    const now = new Date();
    const cutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    for (const entry of timeseries) {
      const entryTime = new Date(entry.time);
      if (entryTime > cutoff) break;
      const details = entry.data?.instant?.details;
      if (!details) continue;
      const h = {
        time: entry.time,
        wind: { speed: null, direction: null, gusts: null },
        weather: { airTemp: null }
      };
      if (details.wind_speed !== undefined) {
        h.wind.speed = Math.round(details.wind_speed * 3.6);
      }
      if (details.wind_from_direction !== undefined) {
        h.wind.direction = degreesToCardinal(details.wind_from_direction);
      }
      const next1h = entry.data?.next_1_hours?.details;
      if (next1h?.wind_speed_of_gust !== undefined) {
        h.wind.gusts = Math.round(next1h.wind_speed_of_gust * 3.6);
      }
      if (details.air_temperature !== undefined) {
        h.weather.airTemp = Math.round(details.air_temperature);
      }
      hourlyForecast.push(h);
    }
    conditions.hourly = hourlyForecast;
    logger.info(`[MET.NO] Successfully fetched wind/weather data (${hourlyForecast.length} hourly entries)`);
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
  scrapeMetNo,
  registerCoords
};
