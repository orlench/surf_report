const express = require('express');
const router = express.Router();
const { fetchSurfData, aggregateData } = require('../services/scraper');
const { calculateSurfScore } = require('../services/scoring');
const { getSpotName, isValidSpot, getAllSpots } = require('../config/spots');
const cache = require('../services/cache');
const logger = require('../utils/logger');

/**
 * GET /api/conditions/:spotId
 * Get current surf conditions and score for a specific spot
 *
 * Query params:
 *   - refresh: Set to true to bypass cache and fetch fresh data
 */
router.get('/:spotId', async (req, res, next) => {
  try {
    const { spotId } = req.params;
    const { refresh } = req.query;

    // Validate spot ID
    if (!isValidSpot(spotId)) {
      return res.status(404).json({
        success: false,
        error: `Invalid spot ID: ${spotId}`
      });
    }

    logger.info(`[API] GET /api/conditions/${spotId} (refresh: ${!!refresh})`);

    // Check cache unless refresh requested
    if (!refresh) {
      const cached = cache.get(`conditions:${spotId}`);
      if (cached) {
        const cacheAge = cache.getAge(`conditions:${spotId}`);
        logger.info(`[API] Returning cached data for ${spotId} (age: ${cacheAge}s)`);
        return res.json({
          ...cached,
          fromCache: true,
          cacheAge
        });
      }
    }

    // Fetch fresh data
    logger.info(`[API] Fetching fresh data for ${spotId}`);
    const rawData = await fetchSurfData(spotId);

    // Aggregate from multiple sources
    const aggregated = aggregateData(rawData);

    // Calculate score
    const score = calculateSurfScore(aggregated, spotId);

    // Build response
    const response = {
      spotId,
      spotName: getSpotName(spotId),
      timestamp: new Date().toISOString(),
      score,
      conditions: aggregated,
      sources: rawData.map(d => ({
        name: d.source,
        status: 'success',
        timestamp: d.timestamp,
        url: d.url
      })),
      fromCache: false
    };

    // Cache result for 10 minutes
    cache.set(`conditions:${spotId}`, response, 600);

    res.json(response);

  } catch (error) {
    logger.error(`[API] Error in /conditions/${req.params.spotId}:`, error);
    next(error);
  }
});

/**
 * GET /api/conditions
 * Get conditions for all spots
 */
router.get('/', async (req, res, next) => {
  try {
    logger.info(`[API] GET /api/conditions (all spots)`);

    const spots = getAllSpots();
    const results = [];

    // Fetch conditions for each spot (use cache if available)
    for (const spot of spots) {
      try {
        const cached = cache.get(`conditions:${spot.id}`);
        if (cached) {
          results.push(cached);
        } else {
          // If not in cache, skip for now (user can request specific spot)
          results.push({
            spotId: spot.id,
            spotName: spot.name,
            message: 'No cached data. Request /api/conditions/' + spot.id + ' to fetch'
          });
        }
      } catch (error) {
        logger.warn(`[API] Failed to get conditions for ${spot.id}:`, error.message);
      }
    }

    // Find best spot (highest score)
    const spotsWithScores = results.filter(r => r.score);
    let bestSpot = null;
    if (spotsWithScores.length > 0) {
      bestSpot = spotsWithScores.reduce((best, current) =>
        current.score.overall > best.score.overall ? current : best
      );
    }

    res.json({
      spots: results,
      bestSpot: bestSpot ? {
        spotId: bestSpot.spotId,
        spotName: bestSpot.spotName,
        score: bestSpot.score.overall,
        rating: bestSpot.score.rating
      } : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[API] Error in /conditions (all):`, error);
    next(error);
  }
});

module.exports = router;
