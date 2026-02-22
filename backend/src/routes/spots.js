const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { getAllSpots, getSpotById, getOrCreateSpot, loadPersistedSpots } = require('../config/spots');
const { interpretFeedback } = require('../services/llm');
const logger = require('../utils/logger');

const USER_SPOTS_PATH = path.join(__dirname, '../../data/userSpots.json');
const FEEDBACK_PATH = path.join(__dirname, '../../data/spotFeedback.json');

// Load persisted user spots on startup
try {
  if (fs.existsSync(USER_SPOTS_PATH)) {
    const data = JSON.parse(fs.readFileSync(USER_SPOTS_PATH, 'utf8'));
    loadPersistedSpots(data);
    logger.info(`[Spots] Loaded ${data.length} persisted user spots`);
  }
} catch (e) {
  logger.warn(`[Spots] Failed to load persisted spots: ${e.message}`);
}

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
 * POST /api/spots
 * Save a user-discovered spot
 */
router.post('/', (req, res) => {
  try {
    const { name, lat, lon, country, region } = req.body;

    if (!name || lat == null || lon == null) {
      return res.status(400).json({ success: false, error: 'Missing required fields: name, lat, lon' });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      return res.status(400).json({ success: false, error: 'Invalid latitude' });
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      return res.status(400).json({ success: false, error: 'Invalid longitude' });
    }

    const spotName = String(name).slice(0, 100).trim();
    const spotId = spotName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    // Register in memory
    getOrCreateSpot(spotId, { lat: latNum, lon: lonNum, name: spotName, country: country || '' });

    // Persist to file
    let existing = [];
    try {
      if (fs.existsSync(USER_SPOTS_PATH)) {
        existing = JSON.parse(fs.readFileSync(USER_SPOTS_PATH, 'utf8'));
      }
    } catch (e) { /* ignore */ }

    // Deduplicate
    if (!existing.find(s => s.id === spotId)) {
      existing.push({
        id: spotId,
        name: spotName,
        lat: latNum,
        lon: lonNum,
        country: country || '',
        region: region || '',
        createdAt: new Date().toISOString()
      });
      fs.mkdirSync(path.dirname(USER_SPOTS_PATH), { recursive: true });
      fs.writeFileSync(USER_SPOTS_PATH, JSON.stringify(existing, null, 2));
      logger.info(`[Spots] Persisted new spot: ${spotName} (${spotId})`);
    }

    res.json({ success: true, spotId, spotName });
  } catch (error) {
    logger.error('[Spots] Error saving spot:', error);
    res.status(500).json({ success: false, error: 'Failed to save spot' });
  }
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

// --- Feedback helpers ---

function loadFeedback() {
  try {
    if (fs.existsSync(FEEDBACK_PATH)) {
      return JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveFeedback(data) {
  fs.mkdirSync(path.dirname(FEEDBACK_PATH), { recursive: true });
  fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(data, null, 2));
}

function aggregateMultipliers(entries) {
  if (!entries || entries.length === 0) return null;
  const factors = ['waveHeight', 'wavePeriod', 'swellQuality', 'windSpeed', 'windDirection', 'waveDirection'];
  const avg = {};
  for (const f of factors) {
    const sum = entries.reduce((acc, e) => acc + (e.multipliers[f] || 1.0), 0);
    avg[f] = Math.round((sum / entries.length) * 100) / 100;
  }
  return avg;
}

/**
 * POST /api/spots/:spotId/feedback
 * Submit surfer feedback about a spot
 */
router.post('/:spotId/feedback', async (req, res) => {
  try {
    const { spotId } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Feedback text must be at least 10 characters' });
    }

    const cleanText = text.slice(0, 500).trim();
    logger.info(`[Feedback] Processing feedback for ${spotId}: "${cleanText.slice(0, 80)}..."`);

    const multipliers = await interpretFeedback(cleanText);

    const allFeedback = loadFeedback();
    if (!allFeedback[spotId]) allFeedback[spotId] = [];

    allFeedback[spotId].push({
      text: cleanText,
      multipliers,
      timestamp: new Date().toISOString()
    });

    // Keep max 50 feedback entries per spot
    if (allFeedback[spotId].length > 50) {
      allFeedback[spotId] = allFeedback[spotId].slice(-50);
    }

    saveFeedback(allFeedback);

    const aggregated = aggregateMultipliers(allFeedback[spotId]);

    res.json({
      success: true,
      multipliers: aggregated,
      feedbackCount: allFeedback[spotId].length,
      yourMultipliers: multipliers
    });
  } catch (error) {
    logger.error(`[Feedback] Error:`, error);
    res.status(500).json({ success: false, error: 'Failed to process feedback' });
  }
});

/**
 * GET /api/spots/:spotId/feedback
 * Get aggregated feedback for a spot
 */
router.get('/:spotId/feedback', (req, res) => {
  const { spotId } = req.params;
  const allFeedback = loadFeedback();
  const entries = allFeedback[spotId] || [];

  const aggregated = aggregateMultipliers(entries);

  res.json({
    success: true,
    multipliers: aggregated,
    feedbackCount: entries.length,
    recentFeedback: entries.slice(-5).reverse().map(e => ({
      text: e.text,
      timestamp: e.timestamp
    }))
  });
});

module.exports = router;
