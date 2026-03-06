const express = require('express');
const router = express.Router();
const { fetchSurfData, aggregateData, aggregateHourlyData } = require('../services/scraper');
const { calculateSurfScore } = require('../services/scoring');
const { generateTrend } = require('../services/trend');
const { recommendBoard } = require('../services/boardRecommendation');
const { getSpotName, getSpotById, isValidSpot, getAllSpots } = require('../config/spots');
const cache = require('../services/cache');
const logger = require('../utils/logger');
const geoip = require('geoip-lite');

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format a full conditions response into the slim agent format
 */
function formatAgentResponse(response, spot) {
  const conditions = response.conditions || {};
  const waves = conditions.waves || {};
  const wind = conditions.wind || {};
  const weather = conditions.weather || {};
  const score = response.score || {};
  const trend = response.trend || null;
  const board = response.boardRecommendation || {};

  // Verdict mapping
  let verdict;
  const rating = score.rating || 'POOR';
  if (['EPIC', 'GREAT', 'GOOD'].includes(rating)) {
    verdict = 'Yes, go surfing.';
  } else if (['FAIR'].includes(rating)) {
    verdict = 'Maybe, conditions are marginal.';
  } else {
    verdict = 'No, not worth it today.';
  }

  // Build trend summary
  let trendSummary = null;
  if (trend) {
    trendSummary = {
      direction: trend.direction || trend.trend || null,
      bestWindow: trend.bestWindow || null,
      message: trend.message || null,
    };
  }

  return {
    spot: {
      id: response.spotId,
      name: response.spotName || spot?.name || response.spotId,
      country: spot?.country || '',
    },
    timestamp: response.timestamp,
    score: score.overall || 0,
    rating,
    verdict,
    summary: score.explanation || '',
    conditions: {
      waveHeight: {
        avg: waves.height?.avg || 0,
        unit: 'm',
      },
      wavePeriod: {
        value: waves.swell?.period || waves.period || 0,
        unit: 's',
      },
      wind: {
        speed: wind.speed || 0,
        unit: 'kph',
        direction: wind.direction || null,
      },
      waterTemp: {
        value: weather.waterTemp || weather.temperature || null,
        unit: 'C',
      },
    },
    board: board.boardName || board.boardType || null,
    trend: trendSummary,
    links: {
      web: `https://shouldigo.surf/?spot=${response.spotId}`,
      full: `https://api.shouldigo.surf/api/conditions/${response.spotId}`,
      schema: 'https://api.shouldigo.surf/api/agent/schema',
    },
  };
}

/**
 * Fetch conditions for a spot (from cache or fresh) and return agent format
 */
async function getAgentConditions(spotId) {
  const cached = cache.get(`conditions:${spotId}`);
  if (cached) {
    const spot = getSpotById(spotId);
    return formatAgentResponse(cached, spot);
  }

  // Fetch fresh
  const rawData = await fetchSurfData(spotId);
  const aggregated = aggregateData(rawData);
  const score = calculateSurfScore(aggregated, spotId, rawData.length);
  const hourlyTimeline = aggregateHourlyData(rawData);

  let trend = null;
  try {
    trend = generateTrend(hourlyTimeline, spotId, score.overall);
  } catch (e) {
    logger.warn(`[Agent] Trend failed for ${spotId}: ${e.message}`);
  }

  const response = {
    spotId,
    spotName: getSpotName(spotId),
    timestamp: new Date().toISOString(),
    score,
    conditions: aggregated,
    trend,
    boardRecommendation: recommendBoard(aggregated),
    fromCache: false,
  };

  cache.set(`conditions:${spotId}`, response, 600);

  const spot = getSpotById(spotId);
  return formatAgentResponse(response, spot);
}

/**
 * GET /api/agent/schema
 * JSON Schema for the agent response format
 */
router.get('/schema', (req, res) => {
  res.json({
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    'x-agent-instructions': 'Use GET /api/agent/{spotId} to check surf conditions. The verdict field gives a yes/no/maybe answer. The summary field can be relayed verbatim to users.',
    type: 'object',
    properties: {
      spot: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          country: { type: 'string' },
        },
      },
      timestamp: { type: 'string', format: 'date-time' },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      rating: { type: 'string', enum: ['EPIC', 'GREAT', 'GOOD', 'FAIR', 'MARGINAL', 'POOR', 'FLAT'] },
      verdict: { type: 'string' },
      summary: { type: 'string' },
      conditions: {
        type: 'object',
        properties: {
          waveHeight: { type: 'object', properties: { avg: { type: 'number' }, unit: { type: 'string' } } },
          wavePeriod: { type: 'object', properties: { value: { type: 'number' }, unit: { type: 'string' } } },
          wind: { type: 'object', properties: { speed: { type: 'number' }, unit: { type: 'string' }, direction: { type: 'string' } } },
          waterTemp: { type: 'object', properties: { value: { type: 'number' }, unit: { type: 'string' } } },
        },
      },
      board: { type: 'string' },
      trend: {
        type: 'object',
        nullable: true,
        properties: {
          direction: { type: 'string' },
          bestWindow: { type: 'string' },
          message: { type: 'string' },
        },
      },
      links: {
        type: 'object',
        properties: {
          web: { type: 'string', format: 'uri' },
          full: { type: 'string', format: 'uri' },
          schema: { type: 'string', format: 'uri' },
        },
      },
    },
  });
});

/**
 * GET /api/agent/nearest
 * Find nearest spot by IP or explicit lat/lon and return conditions
 */
router.get('/nearest', async (req, res, next) => {
  try {
    let lat = parseFloat(req.query.lat);
    let lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket.remoteAddress;
      const geo = geoip.lookup(ip);
      if (geo && geo.ll) {
        [lat, lon] = geo.ll;
      } else {
        // Fallback to first spot
        const spots = getAllSpots();
        if (spots.length === 0) {
          return res.status(404).json({ error: 'No spots available' });
        }
        const result = await getAgentConditions(spots[0].id);
        return res.json(result);
      }
    }

    const spots = getAllSpots();
    let nearest = spots[0];
    let minDist = Infinity;

    for (const spot of spots) {
      const dist = haversine(lat, lon, spot.location.lat, spot.location.lon);
      if (dist < minDist) {
        minDist = dist;
        nearest = spot;
      }
    }

    const result = await getAgentConditions(nearest.id);
    res.json(result);
  } catch (error) {
    logger.error(`[Agent] Error in /nearest:`, error);
    next(error);
  }
});

/**
 * GET /api/agent/:spotId
 * Get concise conditions for a specific spot, optimized for AI agents
 */
router.get('/:spotId', async (req, res, next) => {
  try {
    const { spotId } = req.params;

    if (!isValidSpot(spotId)) {
      return res.status(404).json({
        error: `Unknown spot: ${spotId}`,
        hint: 'Use GET /api/spots for a list of valid spot IDs',
      });
    }

    const result = await getAgentConditions(spotId);
    res.json(result);
  } catch (error) {
    logger.error(`[Agent] Error for ${req.params.spotId}:`, error);
    next(error);
  }
});

module.exports = router;
