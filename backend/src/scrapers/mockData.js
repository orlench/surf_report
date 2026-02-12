const logger = require('../utils/logger');

/**
 * Mock data source for testing
 * Returns realistic surf conditions data
 */

async function scrapeMockData(spotId) {
  try {
    logger.info(`[MockData] Generating mock data for ${spotId}`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate realistic conditions
    const conditions = {
      waves: {
        height: {
          min: 0.8,
          max: 1.5,
          avg: 1.2
        },
        period: 8,
        direction: 'W'
      },
      wind: {
        speed: 15,
        direction: 'E',
        gusts: 20
      },
      weather: {
        airTemp: 18,
        waterTemp: 19,
        cloudCover: 'partly cloudy'
      }
    };

    logger.info(`[MockData] Successfully generated mock data`);
    return conditions;

  } catch (error) {
    logger.error(`[MockData] Failed:`, error.message);
    return null;
  }
}

module.exports = {
  scrapeMockData
};
