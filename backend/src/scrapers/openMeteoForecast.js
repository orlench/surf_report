const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Scrape Open-Meteo Forecast API for wind data (ECMWF model)
 * This is a different source from the Marine API - uses atmospheric models
 * Free JSON API - no authentication required
 */

const SPOT_COORDS = {
  herzliya_marina: { lat: 32.1541, lon: 34.7944 },
  netanya_kontiki: { lat: 32.3335, lon: 34.8597 },
  tel_aviv_maaravi: { lat: 32.0602, lon: 34.7588 }
};

async function scrapeOpenMeteoForecast(spotId) {
  try {
    const coords = SPOT_COORDS[spotId];
    if (!coords) {
      logger.warn(`[Open-Meteo Forecast] No coordinates for spot: ${spotId}`);
      return null;
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,apparent_temperature,cloud_cover&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Asia/Jerusalem&forecast_days=2&models=best_match`;

    logger.info(`[Open-Meteo Forecast] Fetching ${url}`);

    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    const current = data.current;
    if (!current) {
      logger.warn(`[Open-Meteo Forecast] No current data returned`);
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

    // Wind data - Open-Meteo returns km/h by default
    if (current.wind_speed_10m !== null && current.wind_speed_10m !== undefined) {
      conditions.wind.speed = Math.round(current.wind_speed_10m);
      logger.debug(`[Open-Meteo Forecast] Wind speed: ${conditions.wind.speed} km/h`);
    }

    if (current.wind_direction_10m !== null && current.wind_direction_10m !== undefined) {
      conditions.wind.direction = degreesToCardinal(current.wind_direction_10m);
      logger.debug(`[Open-Meteo Forecast] Wind direction: ${conditions.wind.direction}`);
    }

    if (current.wind_gusts_10m !== null && current.wind_gusts_10m !== undefined) {
      conditions.wind.gusts = Math.round(current.wind_gusts_10m);
      logger.debug(`[Open-Meteo Forecast] Wind gusts: ${conditions.wind.gusts} km/h`);
    }

    // Cloud cover
    if (current.cloud_cover !== null && current.cloud_cover !== undefined) {
      const cloudPercent = current.cloud_cover;
      if (cloudPercent < 25) conditions.weather.cloudCover = 'Clear';
      else if (cloudPercent < 50) conditions.weather.cloudCover = 'Partly cloudy';
      else if (cloudPercent < 75) conditions.weather.cloudCover = 'Cloudy';
      else conditions.weather.cloudCover = 'Overcast';
    }

    // Extract full hourly arrays for trend analysis
    const hourlyData = data.hourly;
    const hourlyForecast = [];
    if (hourlyData?.time) {
      for (let i = 0; i < hourlyData.time.length; i++) {
        const h = {
          time: hourlyData.time[i],
          wind: { speed: null, direction: null, gusts: null }
        };
        if (hourlyData.wind_speed_10m?.[i] !== null && hourlyData.wind_speed_10m?.[i] !== undefined) {
          h.wind.speed = Math.round(hourlyData.wind_speed_10m[i]);
        }
        if (hourlyData.wind_direction_10m?.[i] !== null && hourlyData.wind_direction_10m?.[i] !== undefined) {
          h.wind.direction = degreesToCardinal(hourlyData.wind_direction_10m[i]);
        }
        if (hourlyData.wind_gusts_10m?.[i] !== null && hourlyData.wind_gusts_10m?.[i] !== undefined) {
          h.wind.gusts = Math.round(hourlyData.wind_gusts_10m[i]);
        }
        hourlyForecast.push(h);
      }
    }
    conditions.hourly = hourlyForecast;
    logger.info(`[Open-Meteo Forecast] Successfully fetched wind data (${hourlyForecast.length} hourly entries)`);
    return conditions;

  } catch (error) {
    logger.error(`[Open-Meteo Forecast] Failed:`, error.message);
    return null;
  }
}

function degreesToCardinal(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees % 360) / 45)) % 8;
  return directions[index];
}

module.exports = { scrapeOpenMeteoForecast };
