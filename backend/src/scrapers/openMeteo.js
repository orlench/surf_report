const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Scrape Open-Meteo Marine API for wave data
 * Free JSON API - no authentication required
 */

const SPOT_COORDS = {
  herzliya_marina: { lat: 32.1541, lon: 34.7944 },
  netanya_kontiki: { lat: 32.3335, lon: 34.8597 },
  tel_aviv_maaravi: { lat: 32.0602, lon: 34.7588 }
};

async function scrapeOpenMeteo(spotId) {
  try {
    const coords = SPOT_COORDS[spotId];
    if (!coords) {
      logger.warn(`[Open-Meteo] No coordinates for spot: ${spotId}`);
      return null;
    }

    // Fetch wave + swell + wind wave data
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${coords.lat}&longitude=${coords.lon}&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height,wind_wave_period,sea_surface_temperature&timezone=Asia/Jerusalem&forecast_days=1`;

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

    // Swell data (what surfers actually ride)
    const swellHeight = hourly.swell_wave_height?.[0];
    const swellPeriod = hourly.swell_wave_period?.[0];
    const swellDirection = hourly.swell_wave_direction?.[0];

    // Use swell height as primary wave height (not combined wave_height which includes wind chop)
    if (swellHeight !== null && swellHeight !== undefined) {
      conditions.waves.height = {
        min: Math.round((swellHeight * 0.9) * 10) / 10,
        max: Math.round((swellHeight * 1.1) * 10) / 10,
        avg: Math.round(swellHeight * 10) / 10
      };
      conditions.waves.swell = {
        height: Math.round(swellHeight * 10) / 10,
        period: swellPeriod ? Math.round(swellPeriod) : null,
        direction: swellDirection !== null && swellDirection !== undefined
          ? degreesToCardinal(swellDirection) : null
      };
      logger.debug(`[Open-Meteo] Swell height: ${swellHeight}m (used as primary wave height)`);
    }

    // Wave period — prefer swell period over combined wave period
    const wavePeriod = swellPeriod || hourly.wave_period?.[0];
    if (wavePeriod !== null && wavePeriod !== undefined) {
      conditions.waves.period = Math.round(wavePeriod);
      logger.debug(`[Open-Meteo] Wave period: ${wavePeriod}s`);
    }

    // Wave direction — prefer swell direction
    const waveDirection = swellDirection || hourly.wave_direction?.[0];
    if (waveDirection !== null && waveDirection !== undefined) {
      conditions.waves.direction = degreesToCardinal(waveDirection);
      logger.debug(`[Open-Meteo] Wave direction: ${waveDirection}° (${conditions.waves.direction})`);
    }

    // Ocean temperature
    const oceanTemp = hourly.sea_surface_temperature?.[0];
    if (oceanTemp !== null && oceanTemp !== undefined) {
      conditions.weather.waterTemp = Math.round(oceanTemp);
      logger.debug(`[Open-Meteo] Water temp: ${oceanTemp}°C`);
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
