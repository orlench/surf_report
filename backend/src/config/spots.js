/**
 * Surf spot configurations
 * Defines the characteristics and optimal conditions for each spot
 */

const SPOTS = {
  herzliya_marina: {
    id: 'herzliya_marina',
    name: 'Herzliya Marina',
    country: 'Israel',
    location: {
      lat: 32.1667,
      lon: 34.8000
    },
    description: 'Beach break south of Herzliya Marina',
    optimal: {
      waveHeight: {
        min: 0.8,  // meters
        ideal: 1.5,
        max: 2.5
      },
      wavePeriod: {
        min: 8,    // seconds
        ideal: 12,
        max: 16
      },
      windDirection: ['E', 'NE', 'SE'], // Offshore winds
      waveDirection: ['W', 'NW', 'SW']  // Best swell directions
    }
  },
  netanya_kontiki: {
    id: 'netanya_kontiki',
    name: 'Netanya Kontiki',
    country: 'Israel',
    location: {
      lat: 32.3275,
      lon: 34.8556
    },
    description: 'Beach break near Kontiki restaurant',
    optimal: {
      waveHeight: {
        min: 0.6,  // meters
        ideal: 1.2,
        max: 2.0
      },
      wavePeriod: {
        min: 7,    // seconds
        ideal: 11,
        max: 15
      },
      windDirection: ['E', 'SE'], // Offshore winds (protected by breakwater)
      waveDirection: ['W', 'NW']  // Best swell directions
    }
  },
  tel_aviv_maaravi: {
    id: 'tel_aviv_maaravi',
    name: 'Tel Aviv Maaravi',
    country: 'Israel',
    location: {
      lat: 32.0602,
      lon: 34.7588
    },
    description: 'Beach break south of Tel Aviv, near Jaffa port',
    optimal: {
      waveHeight: {
        min: 0.6,
        ideal: 1.2,
        max: 2.0
      },
      wavePeriod: {
        min: 7,
        ideal: 11,
        max: 15
      },
      windDirection: ['E', 'SE', 'S'], // Offshore winds, sheltered from south
      waveDirection: ['W', 'NW', 'SW'] // Swell magnet, catches SW
    }
  },
  ocean_beach_sf: {
    id: 'ocean_beach_sf',
    name: 'Ocean Beach',
    country: 'USA',
    location: {
      lat: 37.7604,
      lon: -122.5107
    },
    description: 'Powerful beach break on San Francisco\'s west coast',
    optimal: {
      waveHeight: {
        min: 1.0,
        ideal: 2.0,
        max: 3.5
      },
      wavePeriod: {
        min: 10,
        ideal: 14,
        max: 20
      },
      windDirection: ['E', 'NE', 'SE'],   // Offshore winds for west-facing beach
      waveDirection: ['W', 'WNW', 'NW']   // Pacific groundswell
    }
  }
};

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
