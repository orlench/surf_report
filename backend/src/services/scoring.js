const { getSpotById } = require('../config/spots');

/**
 * Scoring weights for different factors
 */
const WEIGHTS = {
  waveHeight: 0.35,    // 35%
  wavePeriod: 0.20,    // 20%
  windSpeed: 0.20,     // 20%
  windDirection: 0.15, // 15%
  waveDirection: 0.10  // 10%
};

/**
 * Calculate overall surf score for given conditions
 *
 * @param {Object} conditions - Surf conditions
 * @param {string} spotId - Spot identifier
 * @returns {Object} - Score breakdown and overall rating
 */
function calculateSurfScore(conditions, spotId) {
  const spot = getSpotById(spotId);

  if (!spot) {
    throw new Error(`Invalid spot ID: ${spotId}`);
  }

  // Calculate individual scores (0-100)
  const heightScore = scoreWaveHeight(conditions.waves?.height?.avg || 0, spot.optimal);
  const periodScore = scoreWavePeriod(conditions.waves?.period || 0, spot.optimal);
  const windSpeedScore = scoreWindSpeed(conditions.wind?.speed || 0);
  const windDirScore = scoreWindDirection(conditions.wind?.direction, spot.optimal);
  const waveDirScore = scoreWaveDirection(conditions.waves?.direction, spot.optimal);

  // Calculate weighted average
  const overall = Math.round(
    heightScore * WEIGHTS.waveHeight +
    periodScore * WEIGHTS.wavePeriod +
    windSpeedScore * WEIGHTS.windSpeed +
    windDirScore * WEIGHTS.windDirection +
    waveDirScore * WEIGHTS.waveDirection
  );

  const rating = getRating(overall);

  return {
    overall,
    rating,
    breakdown: {
      waveHeight: Math.round(heightScore),
      wavePeriod: Math.round(periodScore),
      windSpeed: Math.round(windSpeedScore),
      windDirection: Math.round(windDirScore),
      waveDirection: Math.round(waveDirScore)
    }
  };
}

/**
 * Score wave height (0-100)
 * Ideal conditions get highest score
 */
function scoreWaveHeight(height, optimal) {
  const { min, ideal, max } = optimal.waveHeight;

  if (height < min) {
    // Too small - exponential decay
    return Math.max(0, 50 * (height / min));
  } else if (height >= min && height <= ideal) {
    // Building up to ideal - linear growth
    const range = ideal - min;
    const position = height - min;
    return 50 + (50 * (position / range));
  } else if (height > ideal && height <= max) {
    // Past ideal but still good - gradual decline
    const range = max - ideal;
    const position = height - ideal;
    return 100 - (30 * (position / range));
  } else {
    // Too big - steep decline
    return Math.max(0, 70 - (20 * ((height - max) / max)));
  }
}

/**
 * Score wave period (0-100)
 * Longer period = better quality waves
 */
function scoreWavePeriod(period, optimal) {
  const { min, ideal, max } = optimal.wavePeriod;

  if (period < min) {
    // Too short - poor quality
    return Math.max(0, 40 * (period / min));
  } else if (period >= min && period <= ideal) {
    // Improving quality
    const range = ideal - min;
    const position = period - min;
    return 40 + (60 * (position / range));
  } else if (period > ideal && period <= max) {
    // Great quality, slight decline
    const range = max - ideal;
    const position = period - ideal;
    return 100 - (10 * (position / range));
  } else {
    // Very long period is still good
    return Math.max(80, 90 - (period - max));
  }
}

/**
 * Score wind speed (0-100)
 * Light wind is best for surfing
 */
function scoreWindSpeed(speed) {
  // Speed in km/h
  if (speed <= 10) {
    return 100; // Perfect - glass
  } else if (speed <= 20) {
    return 100 - (3 * (speed - 10)); // Good - slight texture
  } else if (speed <= 30) {
    return 70 - (5 * (speed - 20)); // Choppy
  } else {
    return Math.max(0, 20 - (speed - 30)); // Blown out
  }
}

/**
 * Score wind direction (0-100)
 * Offshore wind is best
 */
function scoreWindDirection(direction, optimal) {
  if (!direction) {
    return 50; // No data - neutral score
  }

  const offshoreDirections = optimal.windDirection || [];

  // Perfect offshore wind
  if (offshoreDirections.includes(direction)) {
    return 100;
  }

  // Check if wind is somewhat offshore (adjacent directions)
  const directionMap = {
    N: ['NE', 'NW'],
    NE: ['N', 'E'],
    E: ['NE', 'SE'],
    SE: ['E', 'S'],
    S: ['SE', 'SW'],
    SW: ['S', 'W'],
    W: ['SW', 'NW'],
    NW: ['N', 'W']
  };

  const adjacent = directionMap[direction] || [];
  const hasAdjacentOffshore = adjacent.some(dir => offshoreDirections.includes(dir));

  if (hasAdjacentOffshore) {
    return 70; // Side-shore, still okay
  }

  // Onshore wind - poor
  return 30;
}

/**
 * Score wave direction (0-100)
 * Some spots work better with certain swell directions
 */
function scoreWaveDirection(direction, optimal) {
  if (!direction) {
    return 50; // No data - neutral score
  }

  const optimalDirections = optimal.waveDirection || [];

  // Optimal swell direction for this spot
  if (optimalDirections.includes(direction)) {
    return 100;
  }

  // Check adjacent directions
  const directionMap = {
    N: ['NE', 'NW'],
    NE: ['N', 'E'],
    E: ['NE', 'SE'],
    SE: ['E', 'S'],
    S: ['SE', 'SW'],
    SW: ['S', 'W'],
    W: ['SW', 'NW'],
    NW: ['N', 'W']
  };

  const adjacent = directionMap[direction] || [];
  const hasAdjacentOptimal = adjacent.some(dir => optimalDirections.includes(dir));

  if (hasAdjacentOptimal) {
    return 75; // Close to optimal
  }

  // Non-optimal but still rideable
  return 50;
}

/**
 * Get rating label from score
 */
function getRating(score) {
  if (score >= 85) return 'EPIC';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'FAIR';
  if (score >= 30) return 'POOR';
  return 'FLAT';
}

module.exports = {
  calculateSurfScore,
  scoreWaveHeight,
  scoreWavePeriod,
  scoreWindSpeed,
  scoreWindDirection,
  scoreWaveDirection,
  getRating
};
