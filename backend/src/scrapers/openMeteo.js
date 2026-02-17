const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Scrape Open-Meteo Marine API for wave data
 * Free JSON API - no authentication required
 */

const SPOT_COORDS = {
  herzliya_marina: { lat: 32.1541, lon: 34.7944 },
  netanya_kontiki: { lat: 32.3335, lon: 34.8597 }
};

async function scrapeOpenMeteo(spotId) {
  try {
    const coords = SPOT_COORDS[spotId];
    if (!coords) {
      logger.warn(`[Open-Meteo] No coordinates for spot: ${spotId}`);
      return null;
    }

    // Fetch wave + swell + wind wave data
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${coords.lat}&longitude=${coords.lon}&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height,wind_wave_period&timezone=Asia/Jerusalem&forecast_days=1`;

    logger.info(`[Open-Meteo] Fetching ${url}`);

    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    const hourly = data.hourly;
    if (!hourly || !hourly.time || hourly.time.length === 0) {
      logger.warn(`[Open-Meteo] No data returned`);
      return null;
    }

    const conditions = {
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
      }
    };

    // Primary wave data
    const waveHeight = hourly.wave_height?.[0];
    const wavePeriod = hourly.wave_period?.[0];
    const waveDirection = hourly.wave_direction?.[0];

    if (waveHeight !== null && waveHeight !== undefined) {
      conditions.waves.height = {
        min: Math.round((waveHeight * 0.9) * 10) / 10,
        max: Math.round((waveHeight * 1.1) * 10) / 10,
        avg: Math.round(waveHeight * 10) / 10
      };
      logger.debug(`[Open-Meteo] Wave height: ${waveHeight}m`);
    }

    if (wavePeriod !== null && wavePeriod !== undefined) {
      conditions.waves.period = Math.round(wavePeriod);
      logger.debug(`[Open-Meteo] Wave period: ${wavePeriod}s`);
    }

    if (waveDirection !== null && waveDirection !== undefined) {
      conditions.waves.direction = degreesToCardinal(waveDirection);
      logger.debug(`[Open-Meteo] Wave direction: ${waveDirection}° (${conditions.waves.direction})`);
    }

    // Swell data
    const swellHeight = hourly.swell_wave_height?.[0];
    const swellPeriod = hourly.swell_wave_period?.[0];
    const swellDirection = hourly.swell_wave_direction?.[0];

    if (swellHeight !== null && swellHeight !== undefined) {
      conditions.waves.swell = {
        height: Math.round(swellHeight * 10) / 10,
        period: swellPeriod ? Math.round(swellPeriod) : null,
        direction: swellDirection !== null && swellDirection !== undefined
          ? degreesToCardinal(swellDirection) : null
      };
      logger.debug(`[Open-Meteo] Swell: ${swellHeight}m @ ${swellPeriod}s from ${conditions.waves.swell.direction}`);
    }

    logger.info(`[Open-Meteo] Successfully fetched wave data`);
    return conditions;

  } catch (error) {
    logger.error(`[Open-Meteo] Failed:`, error.message);
    return null;
  }
}

function degreesToCardinal(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees % 360) / 45)) % 8;
  return directions[index];
}

module.exports = { scrapeOpenMeteo };
