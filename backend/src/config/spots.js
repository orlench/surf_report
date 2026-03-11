/**
 * Surf spot configurations
 * Defines the characteristics and optimal conditions for each spot
 */

const SPOTS = {};

// In-memory store for dynamically created spots (from map discovery)
const dynamicSpots = {};

/**
 * Get or create a dynamic spot from coordinates.
 * Returns a spot config object with sensible defaults.
 */
function getOrCreateSpot(id, { lat, lon, name, country }) {
  if (SPOTS[id]) return SPOTS[id];
  if (dynamicSpots[id]) return dynamicSpots[id];

  const { registerCoords: regOpenMeteo } = require('../scrapers/openMeteo');
  const { registerCoords: regMetNo } = require('../scrapers/metNo');
  const { registerCoords: regForecast } = require('../scrapers/openMeteoForecast');
  const { registerCoords: regSurfForecast } = require('../scrapers/surfForecast');
  const { registerCoords: regWindFinder } = require('../scrapers/windFinder');

  dynamicSpots[id] = {
    id,
    name: name || id,
    country: country || '',
    location: { lat, lon },
    description: `User-discovered spot`,
    optimal: {
      waveHeight: { min: 0.8, ideal: 1.5, max: 2.5 },
      wavePeriod: { min: 8, ideal: 12, max: 16 },
      windDirection: ['E', 'NE', 'SE'],
      waveDirection: ['W', 'NW', 'SW']
    }
  };

  regOpenMeteo(id, lat, lon);
  regMetNo(id, lat, lon);
  regForecast(id, lat, lon);
  regSurfForecast(id, lat, lon, name, country);
  regWindFinder(id, lat, lon, name, country);

  return dynamicSpots[id];
}

/**
 * Get all available spots (hardcoded + dynamic + persisted)
 */
function getAllSpots() {
  return [...Object.values(SPOTS), ...Object.values(dynamicSpots)];
}

/**
 * Get spot by ID
 */
function getSpotById(spotId) {
  return SPOTS[spotId] || dynamicSpots[spotId];
}

/**
 * Get spot name
 */
function getSpotName(spotId) {
  const spot = SPOTS[spotId] || dynamicSpots[spotId];
  return spot ? spot.name : spotId;
}

/**
 * Check if spot ID is valid. If not found in memory, tries to auto-register
 * from the full surf spots database (surfSpots.json).
 */
function isValidSpot(spotId) {
  if (spotId in SPOTS || spotId in dynamicSpots) return true;
  // Try to find and auto-register from the full spots DB
  return !!tryAutoRegister(spotId);
}

/**
 * Try to find a spot by ID in the full surfSpots.json and auto-register it.
 * Handles both underscore and hyphen ID formats.
 */
function tryAutoRegister(spotId) {
  try {
    const fs = require('fs');
    const path = require('path');
    const spotsPath = path.join(__dirname, '../../data/surfSpots.json');
    if (!fs.existsSync(spotsPath)) return null;

    const data = JSON.parse(fs.readFileSync(spotsPath, 'utf8'));
    const spots = data.spots || data;

    // Normalize ID for matching (both _ and - formats)
    const normalizedId = spotId.toLowerCase();
    const match = spots.find(s => {
      const nameId = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const nameIdHyphen = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return nameId === normalizedId || nameIdHyphen === normalizedId || (s.id && s.id === normalizedId);
    });

    if (match && match.lat && match.lon) {
      return getOrCreateSpot(spotId, {
        lat: match.lat,
        lon: match.lon,
        name: match.name,
        country: match.country || ''
      });
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Load persisted user spots into dynamic store
 */
function loadPersistedSpots(spotsArray) {
  const { registerCoords: regOpenMeteo } = require('../scrapers/openMeteo');
  const { registerCoords: regMetNo } = require('../scrapers/metNo');
  const { registerCoords: regForecast } = require('../scrapers/openMeteoForecast');
  const { registerCoords: regSurfForecast } = require('../scrapers/surfForecast');
  const { registerCoords: regWindFinder } = require('../scrapers/windFinder');

  for (const s of spotsArray) {
    if (!SPOTS[s.id] && !dynamicSpots[s.id]) {
      dynamicSpots[s.id] = {
        id: s.id,
        name: s.name,
        country: s.country || '',
        location: { lat: s.lat, lon: s.lon },
        description: 'User-discovered spot',
        optimal: {
          waveHeight: { min: 0.8, ideal: 1.5, max: 2.5 },
          wavePeriod: { min: 8, ideal: 12, max: 16 },
          windDirection: ['E', 'NE', 'SE'],
          waveDirection: ['W', 'NW', 'SW']
        }
      };
      regOpenMeteo(s.id, s.lat, s.lon);
      regMetNo(s.id, s.lat, s.lon);
      regForecast(s.id, s.lat, s.lon);
      regSurfForecast(s.id, s.lat, s.lon, s.name, s.country);
      regWindFinder(s.id, s.lat, s.lon, s.name, s.country);
    }
  }
}

module.exports = {
  SPOTS,
  getAllSpots,
  getSpotById,
  getSpotName,
  isValidSpot,
  getOrCreateSpot,
  loadPersistedSpots
};
