const logger = require('../utils/logger');

/**
 * Parse BeachCam.co.il markdown content
 * Extracts wave height, wind conditions, and other surf data from structured forecast tables
 *
 * @param {string} markdown - Scraped markdown content
 * @param {string} spotId - Spot identifier for location-specific parsing
 * @returns {Object} - Parsed surf conditions
 */
function parseBeachCam(markdown, spotId) {
  logger.info(`[BeachCam Parser] Parsing content for ${spotId}`);

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

  try {
    // Parse "Today's Summary" table for current conditions
    // Format: | 11 AM | 1.2m (4ft) | 7s | 25 SSW | Cross-shore |
    const summaryMatch = markdown.match(/\|\s*\d+\s*[AP]M\s*\|\s*([\d.]+)m\s*\([^)]+\)\s*\|\s*(\d+)s\s*\|\s*(\d+)\s+(\w+)\s*\|/);
    if (summaryMatch) {
      const height = parseFloat(summaryMatch[1]);
      conditions.waves.height = {
        min: Math.round((height * 0.9) * 10) / 10,
        max: Math.round((height * 1.1) * 10) / 10,
        avg: Math.round(height * 10) / 10
      };
      conditions.waves.period = parseInt(summaryMatch[2]);
      conditions.wind.speed = parseInt(summaryMatch[3]);
      conditions.wind.direction = summaryMatch[4];

      logger.debug(`[BeachCam Parser] Found current conditions: ${height}m waves, ${summaryMatch[2]}s period, ${summaryMatch[3]} ${summaryMatch[4]} wind`);
    }

    // Parse wave height from detailed forecast table if not found in summary
    if (!conditions.waves.height.avg) {
      // Look for height in "48-Hour Detailed Forecast" section
      const heightTableMatch = markdown.match(/\|\s*\*\*Height\*\*\s*\|\s*([\d.]+)\s*\|/);
      if (heightTableMatch) {
        const height = parseFloat(heightTableMatch[1]);
        conditions.waves.height = {
          min: Math.round((height * 0.9) * 10) / 10,
          max: Math.round((height * 1.1) * 10) / 10,
          avg: Math.round(height * 10) / 10
        };
        logger.debug(`[BeachCam Parser] Found wave height from table: ${height}m`);
      }
    }

    // Parse wave direction from table (e.g., "| **Dir** | WNW |")
    if (!conditions.waves.direction) {
      const dirMatch = markdown.match(/\|\s*\*\*Dir\*\*\s*\|\s*([A-Z]+)\s*\|/);
      if (dirMatch) {
        conditions.waves.direction = dirMatch[1];
        logger.debug(`[BeachCam Parser] Found wave direction: ${conditions.waves.direction}`);
      }
    }

    // Parse wave period from table if not found
    if (!conditions.waves.period) {
      const periodTableMatch = markdown.match(/Wave Period[^\|]*\|\s*\w+\s+\d+[AP]M[^\|]*\|\s*[^\|]*\|[^\|]*\|[^\|]*\|\s*(\d+)\s*\|/);
      if (periodTableMatch) {
        conditions.waves.period = parseInt(periodTableMatch[1]);
        logger.debug(`[BeachCam Parser] Found wave period from table: ${conditions.waves.period}s`);
      }
    }

    // Parse wind from detailed forecast if not found in summary
    if (!conditions.wind.speed) {
      // Format: | 25 SSW | or wind table row
      const windTableMatch = markdown.match(/Wind Speed[^\|]*\|[^\|]*\|\s*(\d+)\s+([A-Z]+)\s*\|/);
      if (windTableMatch) {
        conditions.wind.speed = parseInt(windTableMatch[1]);
        conditions.wind.direction = windTableMatch[2];
        logger.debug(`[BeachCam Parser] Found wind from table: ${conditions.wind.speed} ${conditions.wind.direction}`);
      }
    }

    // Parse sea/water temperature
    // Format: | **Sea Temperature** | 19.0°C |
    const waterTempMatch = markdown.match(/\|\s*\*\*Sea Temperature\*\*\s*\|\s*([\d.]+)°C/i);
    if (waterTempMatch) {
      conditions.weather.waterTemp = Math.round(parseFloat(waterTempMatch[1]));
      logger.debug(`[BeachCam Parser] Found water temp: ${conditions.weather.waterTemp}°C`);
    }

    // Parse air temperature from weather forecast table
    // Format: | 16/13 | (temperature/feels like)
    const airTempMatch = markdown.match(/Temperature[^\|]*\|[^\|]*\|\s*(\d+)\/\d+\s*\|/);
    if (airTempMatch) {
      conditions.weather.airTemp = parseInt(airTempMatch[1]);
      logger.debug(`[BeachCam Parser] Found air temp: ${conditions.weather.airTemp}°C`);
    }

    // Parse cloud cover from sky conditions
    const skyMatch = markdown.match(/\|\s*(Clear|Cloud|Part cloud|Partly cloudy)\s*\|/i);
    if (skyMatch) {
      conditions.weather.cloudCover = skyMatch[1];
      logger.debug(`[BeachCam Parser] Found sky: ${conditions.weather.cloudCover}`);
    }

    logger.info(`[BeachCam Parser] Successfully parsed BeachCam data`);
    return conditions;

  } catch (error) {
    logger.error(`[BeachCam Parser] Error parsing markdown:`, error);
    throw new Error(`BeachCam parsing failed: ${error.message}`);
  }
}

/**
 * Get BeachCam URL for a specific spot
 */
function getBeachCamURL(spotId) {
  // BeachCam has a general forecast page that covers Israeli beaches
  // The data is from Surf-forecast.com for the Dabush break
  return 'https://beachcam.co.il/en/forcast.html';
}

module.exports = {
  parseBeachCam,
  getBeachCamURL
};
