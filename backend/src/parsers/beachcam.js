const logger = require('../utils/logger');

/**
 * Parse BeachCam.co.il markdown content
 * Extracts wave height, wind conditions, and other surf data
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
    // Parse wave height (looking for patterns like "1-2m", "3-5 feet", "1.5m")
    const waveHeightMatch = markdown.match(/wave[s]?\s*(?:height)?[:\s-]*(\d+(?:\.\d+)?)\s*[-–to]\s*(\d+(?:\.\d+)?)\s*(m|meter|feet|ft)/i);
    if (waveHeightMatch) {
      let min = parseFloat(waveHeightMatch[1]);
      let max = parseFloat(waveHeightMatch[2]);
      const unit = waveHeightMatch[3].toLowerCase();

      // Convert feet to meters if needed
      if (unit.startsWith('f')) {
        min = min * 0.3048;
        max = max * 0.3048;
      }

      conditions.waves.height = {
        min: Math.round(min * 10) / 10,
        max: Math.round(max * 10) / 10,
        avg: Math.round(((min + max) / 2) * 10) / 10
      };
      logger.debug(`[BeachCam Parser] Found wave height: ${conditions.waves.height.min}-${conditions.waves.height.max}m`);
    }

    // Try single wave height value (e.g., "1.5m waves")
    if (!conditions.waves.height.avg) {
      const singleHeightMatch = markdown.match(/(\d+(?:\.\d+)?)\s*(m|meter|feet|ft)\s*wave/i);
      if (singleHeightMatch) {
        let height = parseFloat(singleHeightMatch[1]);
        const unit = singleHeightMatch[2].toLowerCase();

        if (unit.startsWith('f')) {
          height = height * 0.3048;
        }

        conditions.waves.height = {
          min: Math.round((height * 0.8) * 10) / 10,
          max: Math.round((height * 1.2) * 10) / 10,
          avg: Math.round(height * 10) / 10
        };
        logger.debug(`[BeachCam Parser] Found single wave height: ${conditions.waves.height.avg}m`);
      }
    }

    // Parse wave period (e.g., "10 seconds", "8s period")
    const periodMatch = markdown.match(/period[:\s]*(\d+)\s*(?:sec|s\b)/i);
    if (periodMatch) {
      conditions.waves.period = parseInt(periodMatch[1]);
      logger.debug(`[BeachCam Parser] Found wave period: ${conditions.waves.period}s`);
    }

    // Parse wave direction (e.g., "W swell", "swell from NW")
    const waveDirMatch = markdown.match(/(?:swell|wave)[s]?\s*(?:from|direction)?[:\s]*(N|NE|E|SE|S|SW|W|NW)/i);
    if (waveDirMatch) {
      conditions.waves.direction = waveDirMatch[1].toUpperCase();
      logger.debug(`[BeachCam Parser] Found wave direction: ${conditions.waves.direction}`);
    }

    // Parse wind (e.g., "NW 15 km/h", "Wind: E 20km/h", "10kt NE wind")
    const windMatch = markdown.match(/wind[:\s]*(?:from\s*)?(N|NE|E|SE|S|SW|W|NW)?\s*(\d+)\s*(?:km\/h|kph|kt|kts|knots)/i) ||
                      markdown.match(/(N|NE|E|SE|S|SW|W|NW)\s+(\d+)\s*(?:km\/h|kph|kt|kts|knots)/i);

    if (windMatch) {
      const direction = windMatch[1]?.toUpperCase();
      let speed = parseInt(windMatch[2]);

      // Convert knots to km/h if needed
      if (markdown.toLowerCase().includes('kt') || markdown.toLowerCase().includes('knot')) {
        speed = Math.round(speed * 1.852);
      }

      if (direction) {
        conditions.wind.direction = direction;
      }
      conditions.wind.speed = speed;
      logger.debug(`[BeachCam Parser] Found wind: ${conditions.wind.direction || '?'} ${conditions.wind.speed}km/h`);
    }

    // Parse air temperature (e.g., "18°C", "72°F", "Temperature: 20C")
    const airTempMatch = markdown.match(/(?:air\s*)?temp(?:erature)?[:\s]*(\d+)\s*°?\s*([CF])/i);
    if (airTempMatch) {
      let temp = parseInt(airTempMatch[1]);
      const unit = airTempMatch[2].toUpperCase();

      // Convert Fahrenheit to Celsius if needed
      if (unit === 'F') {
        temp = Math.round((temp - 32) * 5 / 9);
      }

      conditions.weather.airTemp = temp;
      logger.debug(`[BeachCam Parser] Found air temp: ${conditions.weather.airTemp}°C`);
    }

    // Parse water temperature
    const waterTempMatch = markdown.match(/water\s*temp(?:erature)?[:\s]*(\d+)\s*°?\s*([CF])/i);
    if (waterTempMatch) {
      let temp = parseInt(waterTempMatch[1]);
      const unit = waterTempMatch[2].toUpperCase();

      if (unit === 'F') {
        temp = Math.round((temp - 32) * 5 / 9);
      }

      conditions.weather.waterTemp = temp;
      logger.debug(`[BeachCam Parser] Found water temp: ${conditions.weather.waterTemp}°C`);
    }

    // Parse conditions rating (e.g., "Good conditions", "Fair", "Poor")
    const ratingMatch = markdown.match(/conditions?[:\s]*(epic|excellent|good|fair|poor|flat)/i);
    if (ratingMatch) {
      conditions.rating = ratingMatch[1].toUpperCase();
      logger.debug(`[BeachCam Parser] Found rating: ${conditions.rating}`);
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
  // BeachCam has a general forecast page
  // We'll scrape the main forecast page and look for location-specific data
  return 'https://beachcam.co.il/en/forcast.html';
}

module.exports = {
  parseBeachCam,
  getBeachCamURL
};
