const express = require('express');
const router = express.Router();
const { getAllSpots, getSpotById } = require('../config/spots');
const logger = require('../utils/logger');

/**
 * GET /api/spots
 * Get list of all available surf spots
 */
router.get('/', (req, res) => {
  logger.info(`[API] GET /api/spots`);

  const spots = getAllSpots();

  res.json({
    success: true,
    count: spots.length,
    spots: spots.map(spot => ({
      id: spot.id,
      name: spot.name,
      country: spot.country,
      location: spot.location,
      description: spot.description
    }))
  });
});

/**
 * GET /api/spots/:spotId
 * Get details for a specific spot
 */
router.get('/:spotId', (req, res) => {
  const { spotId } = req.params;
  logger.info(`[API] GET /api/spots/${spotId}`);

  const spot = getSpotById(spotId);

  if (!spot) {
    return res.status(404).json({
      success: false,
      error: `Spot not found: ${spotId}`
    });
  }

  res.json({
    success: true,
    spot
  });
});

module.exports = router;
