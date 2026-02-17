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
  }
};

/**
 * Get all available spots
 */
function getAllSpots() {
  return Object.values(SPOTS);
}

/**
 * Get spot by ID
 */
function getSpotById(spotId) {
  return SPOTS[spotId];
}

/**
 * Get spot name
 */
function getSpotName(spotId) {
  const spot = SPOTS[spotId];
  return spot ? spot.name : spotId;
}

/**
 * Check if spot ID is valid
 */
function isValidSpot(spotId) {
  return spotId in SPOTS;
}

module.exports = {
  SPOTS,
  getAllSpots,
  getSpotById,
  getSpotName,
  isValidSpot
};
