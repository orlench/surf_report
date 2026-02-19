const express = require('express');
const router = express.Router();
const { fetchSurfData, fetchSurfDataByCoords, aggregateData, aggregateHourlyData } = require('../services/scraper');
const { calculateSurfScore } = require('../services/scoring');
const { generateTrend } = require('../services/trend');
const { recommendBoard, recommendBoardPersonalized } = require('../services/boardRecommendation');
const { getSpotName, isValidSpot, getAllSpots, getOrCreateSpot } = require('../config/spots');
const cache = require('../services/cache');
const logger = require('../utils/logger');

/**
 * GET /api/conditions/custom
 * Get conditions for any coordinates (custom/discovered spots)
 *
 * Query params:
 *   - lat: Latitude (required)
 *   - lon: Longitude (required)
 *   - name: Spot name (required)
 *   - country: Country name (optional)
 */
router.get('/custom', async (req, res, next) => {
  try {
    const { lat, lon, name, country } = req.query;

    // Validate required params
    if (!lat || !lon || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required params: lat, lon, name'
      });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      return res.status(400).json({ success: false, error: 'Invalid latitude' });
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      return res.status(400).json({ success: false, error: 'Invalid longitude' });
    }

    // Sanitize name
    const spotName = String(name).slice(0, 100).trim();
    const spotCountry = country ? String(country).slice(0, 100).trim() : '';
    const spotId = spotName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    logger.info(`[API] GET /api/conditions/custom ${spotName} (${latNum}, ${lonNum})`);

    // Check cache
    const cacheKey = `conditions:custom:${spotId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      const cacheAge = cache.getAge(cacheKey);
      logger.info(`[API] Returning cached custom data for ${spotName} (age: ${cacheAge}s)`);
      return res.json({ ...cached, fromCache: true, cacheAge });
    }

    // Register this spot dynamically
    getOrCreateSpot(spotId, { lat: latNum, lon: lonNum, name: spotName, country: spotCountry });

    // Fetch data using coordinate-based scrapers
    const rawData = await fetchSurfDataByCoords(latNum, lonNum, spotId);
    const aggregated = aggregateData(rawData);
    const score = calculateSurfScore(aggregated, spotId, rawData.length);

    const hourlyTimeline = aggregateHourlyData(rawData);
    let trend = null;
    try {
      trend = generateTrend(hourlyTimeline, spotId, score.overall);
    } catch (e) {
      logger.warn(`[API] Trend analysis failed for custom spot: ${e.message}`);
    }

    const response = {
      spotId,
      spotName,
      timestamp: new Date().toISOString(),
      score,
      conditions: aggregated,
      trend,
      boardRecommendation: recommendBoard(aggregated),
      sources: rawData.map(d => ({
        name: d.source,
        status: 'success',
        timestamp: d.timestamp,
        url: d.url
      })),
      fromCache: false
    };

    cache.set(cacheKey, response, 600);
    res.json(response);

  } catch (error) {
    logger.error(`[API] Error in /conditions/custom:`, error);
    next(error);
  }
});

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

    // Validate and sanitize optional query params
    let weight = null;
    let skill = null;

    if (req.query.weight) {
      weight = parseFloat(req.query.weight);
      if (isNaN(weight) || weight < 20 || weight > 250) {
        return res.status(400).json({ success: false, error: 'Invalid weight: must be 20-250 kg' });
      }
    }

    if (req.query.skill) {
      const validSkills = ['beginner', 'intermediate', 'advanced', 'expert'];
      skill = req.query.skill;
      if (!validSkills.includes(skill)) {
        return res.status(400).json({ success: false, error: 'Invalid skill: must be beginner, intermediate, advanced, or expert' });
      }
    }

    // Board recommendation helper (computed per-request for personalization)
    const getBoardRec = (conditions) => {
      if (weight && skill) {
        return recommendBoardPersonalized(conditions, { weight, skillLevel: skill });
      }
      return recommendBoard(conditions);
    };

    // Check cache unless refresh requested
    if (!refresh) {
      const cached = cache.get(`conditions:${spotId}`);
      if (cached) {
        const cacheAge = cache.getAge(`conditions:${spotId}`);
        logger.info(`[API] Returning cached data for ${spotId} (age: ${cacheAge}s)`);
        return res.json({
          ...cached,
          boardRecommendation: getBoardRec(cached.conditions),
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

    // Calculate score (pass source count for confidence scoring)
    const score = calculateSurfScore(aggregated, spotId, rawData.length);

    // Generate trend analysis from hourly forecast data
    const hourlyTimeline = aggregateHourlyData(rawData);
    let trend = null;
    try {
      trend = generateTrend(hourlyTimeline, spotId, score.overall);
    } catch (e) {
      logger.warn(`[API] Trend analysis failed: ${e.message}`);
    }

    // Build response
    const response = {
      spotId,
      spotName: getSpotName(spotId),
      timestamp: new Date().toISOString(),
      score,
      conditions: aggregated,
      trend,
      boardRecommendation: getBoardRec(aggregated),
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
