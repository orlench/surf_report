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
  const { registerCoords: regWindguru } = require('../scrapers/windguru');
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
  regWindguru(id, lat, lon);
  regWindFinder(id, lat, lon);

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
 * Check if spot ID is valid (hardcoded only for legacy route)
 */
function isValidSpot(spotId) {
  return spotId in SPOTS || spotId in dynamicSpots;
}

/**
 * Load persisted user spots into dynamic store
 */
function loadPersistedSpots(spotsArray) {
  const { registerCoords: regOpenMeteo } = require('../scrapers/openMeteo');
  const { registerCoords: regMetNo } = require('../scrapers/metNo');
  const { registerCoords: regForecast } = require('../scrapers/openMeteoForecast');
  const { registerCoords: regWindguru } = require('../scrapers/windguru');
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
      regWindguru(s.id, s.lat, s.lon);
      regWindFinder(s.id, s.lat, s.lon);
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
