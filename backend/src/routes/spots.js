const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { getAllSpots, getSpotById, getOrCreateSpot, loadPersistedSpots } = require('../config/spots');
const logger = require('../utils/logger');

const USER_SPOTS_PATH = path.join(__dirname, '../../data/userSpots.json');

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

module.exports = router;
