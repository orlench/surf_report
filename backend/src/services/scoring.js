const { getSpotById } = require('../config/spots');
const logger = require('../utils/logger');

/**
 * Scoring weights for different factors
 * Adjusted to include swell quality and reduce over-reliance on wave height
 */
const WEIGHTS = {
  waveHeight: 0.15,      // 15% - Are waves the right size?
  wavePeriod: 0.30,      // 30% - THE key quality factor: longer period = cleaner, more powerful waves
  swellQuality: 0.15,    // 15% - Groundswell vs wind chop (also period-dependent)
  windSpeed: 0.15,       // 15% - Light wind = glassy conditions
  windDirection: 0.15,   // 15% - Offshore = groomed faces
  waveDirection: 0.05,   // 5%  - Swell angle hitting the spot
  dataConfidence: 0.05   // 5%  - More sources = more reliable
};

/**
 * Calculate overall surf score for given conditions
 *
 * @param {Object} conditions - Aggregated surf conditions
 * @param {string} spotId - Spot identifier
 * @param {number} sourceCount - Number of data sources that returned data
 * @returns {Object} - Score breakdown and overall rating
 */
function calculateSurfScore(conditions, spotId, sourceCount) {
  const spot = getSpotById(spotId);

  if (!spot) {
    throw new Error(`Invalid spot ID: ${spotId}`);
  }

  // Calculate individual scores (0-100)
  const heightScore = scoreWaveHeight(conditions.waves?.height?.avg || 0, spot.optimal);
  const periodScore = scoreWavePeriod(conditions.waves?.period || 0, spot.optimal);
  const swellScore = scoreSwellQuality(conditions.waves?.swell, conditions.waves?.period, spot.optimal);
  const windSpeedScore = scoreWindSpeed(conditions.wind?.speed || 0, conditions.wind?.gusts);
  const windDirScore = scoreWindDirection(conditions.wind?.direction, spot.optimal);
  const waveDirScore = scoreWaveDirection(conditions.waves?.direction, conditions.waves?.swell?.direction, spot.optimal);
  const confidenceScore = scoreDataConfidence(sourceCount || 1);

  // Calculate weighted average
  const overall = Math.round(
    heightScore * WEIGHTS.waveHeight +
    periodScore * WEIGHTS.wavePeriod +
    swellScore * WEIGHTS.swellQuality +
    windSpeedScore * WEIGHTS.windSpeed +
    windDirScore * WEIGHTS.windDirection +
    waveDirScore * WEIGHTS.waveDirection +
    confidenceScore * WEIGHTS.dataConfidence
  );

  // Clamp to 0-100
  const clampedScore = Math.max(0, Math.min(100, overall));
  const rating = getRating(clampedScore);

  logger.debug(`[Scoring] ${spotId}: height=${Math.round(heightScore)} period=${Math.round(periodScore)} swell=${Math.round(swellScore)} wind=${Math.round(windSpeedScore)} windDir=${Math.round(windDirScore)} waveDir=${Math.round(waveDirScore)} confidence=${Math.round(confidenceScore)} => ${clampedScore} (${rating})`);

  const breakdown = {
    waveHeight: Math.round(heightScore),
    wavePeriod: Math.round(periodScore),
    swellQuality: Math.round(swellScore),
    windSpeed: Math.round(windSpeedScore),
    windDirection: Math.round(windDirScore),
    waveDirection: Math.round(waveDirScore)
  };

  const explanation = generateExplanation(conditions, breakdown, clampedScore);

  return {
    overall: clampedScore,
    rating,
    explanation,
    breakdown
  };
}

/**
 * Score wave height (0-100)
 * Ideal conditions get highest score
 */
function scoreWaveHeight(height, optimal) {
  const { min, ideal, max } = optimal.waveHeight;

  if (height <= 0.1) {
    // Flat - no surf
    return 0;
  } else if (height < min) {
    // Too small - exponential curve (very small = very bad)
    const ratio = height / min;
    return Math.round(50 * Math.pow(ratio, 1.5));
  } else if (height >= min && height <= ideal) {
    // Building up to ideal - linear growth from 50 to 100
    const range = ideal - min;
    const position = height - min;
    return range > 0 ? 50 + (50 * (position / range)) : 100;
  } else if (height > ideal && height <= max) {
    // Past ideal but still good - gradual decline from 100 to 70
    const range = max - ideal;
    const position = height - ideal;
    return range > 0 ? 100 - (30 * (position / range)) : 100;
  } else {
    // Too big - steep decline, dangerous conditions
    const overMax = (height - max) / max;
    return Math.max(0, Math.round(70 - (50 * overMax)));
  }
}

/**
 * Score wave period (0-100)
 * Longer period = better quality, cleaner waves
 */
function scoreWavePeriod(period, optimal) {
  const { min, ideal, max } = optimal.wavePeriod;

  if (period <= 0) {
    return 0;
  } else if (period < min) {
    // Too short - choppy, poor quality
    const ratio = period / min;
    return Math.round(40 * Math.pow(ratio, 1.3));
  } else if (period >= min && period <= ideal) {
    // Improving quality - 40 to 100
    const range = ideal - min;
    const position = period - min;
    return range > 0 ? 40 + (60 * (position / range)) : 100;
  } else if (period > ideal && period <= max) {
    // Great quality, very slight decline from 100 to 90
    const range = max - ideal;
    const position = period - ideal;
    return range > 0 ? 100 - (10 * (position / range)) : 100;
  } else {
    // Very long period is still excellent
    return 85;
  }
}

/**
 * Score swell quality (0-100)
 * Distinguishes clean groundswell from messy wind chop
 * Uses swell-specific data when available, falls back to general wave period
 */
function scoreSwellQuality(swell, wavePeriod, optimal) {
  // No swell data at all - conservative score
  if (!swell && !wavePeriod) {
    return 35;
  }

  let score = 50; // Base score

  if (swell && swell.height) {
    const swellHeight = swell.height;
    const swellPeriod = swell.period || wavePeriod || 0;

    // Swell height contribution (0.3m-2.5m range for Israel)
    if (swellHeight >= 0.5 && swellHeight <= 2.0) {
      score += 20; // Good swell present
    } else if (swellHeight > 0 && swellHeight < 0.5) {
      score += 5; // Barely any swell
    } else if (swellHeight > 2.0) {
      score += 10; // Big swell, could be too much
    }

    // Swell period is the key quality indicator
    // Long period = groundswell = clean, powerful waves
    if (swellPeriod >= 12) {
      score += 30; // Excellent groundswell
    } else if (swellPeriod >= 10) {
      score += 20; // Good groundswell
    } else if (swellPeriod >= 8) {
      score += 10; // Moderate, mixed swell
    } else if (swellPeriod >= 5) {
      score += 0;  // Wind swell, choppy
    } else {
      score -= 10; // Very short period, messy
    }

    // Swell direction bonus
    if (swell.direction && optimal.waveDirection) {
      if (optimal.waveDirection.includes(swell.direction)) {
        score += 10; // Perfect swell angle
      }
    }
  } else {
    // No swell-specific data, use wave period as proxy
    const period = wavePeriod || 0;
    if (period >= 12) {
      score += 25; // Likely groundswell
    } else if (period >= 9) {
      score += 10; // Decent
    } else if (period >= 6) {
      score -= 5;  // Likely wind swell
    } else {
      score -= 15; // Very choppy
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Score wind speed (0-100)
 * Light wind is best for surfing
 * Now incorporates gusts as a penalty
 */
function scoreWindSpeed(speed, gusts) {
  let baseScore;

  // Speed in km/h
  if (speed <= 8) {
    baseScore = 100; // Glass - perfect
  } else if (speed <= 15) {
    baseScore = 100 - (3 * (speed - 8)); // Good - slight texture
  } else if (speed <= 25) {
    baseScore = 79 - (4 * (speed - 15)); // Getting choppy
  } else if (speed <= 35) {
    baseScore = 39 - (3 * (speed - 25)); // Rough
  } else {
    baseScore = Math.max(0, 9 - (speed - 35)); // Blown out
  }

  // Gust penalty: strong gusts make conditions inconsistent
  if (gusts && speed > 0) {
    const gustRatio = gusts / speed;
    if (gustRatio > 2.0) {
      // Extreme gusts (more than double sustained) - big penalty
      baseScore -= 20;
    } else if (gustRatio > 1.5) {
      // Strong gusts - moderate penalty
      baseScore -= 10;
    } else if (gustRatio > 1.3) {
      // Noticeable gusts - small penalty
      baseScore -= 5;
    }
    // Also penalize high absolute gusts
    if (gusts > 40) {
      baseScore -= 10;
    } else if (gusts > 30) {
      baseScore -= 5;
    }
  }

  return Math.max(0, Math.min(100, baseScore));
}

/**
 * Score wind direction (0-100)
 * Offshore wind is best - holds up wave faces
 */
function scoreWindDirection(direction, optimal) {
  if (!direction) {
    return 40; // No data - slightly pessimistic (can't confirm offshore)
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
    return 65; // Cross-shore, manageable
  }

  // Direct onshore wind - worst case for wave quality
  // For Israeli coast facing W, onshore = W/NW/SW
  return 25;
}

/**
 * Score wave direction (0-100)
 * Some spots work better with certain swell directions
 * Now considers swell direction separately from overall wave direction
 */
function scoreWaveDirection(waveDirection, swellDirection, optimal) {
  // Prefer swell direction if available (more meaningful for wave quality)
  const direction = swellDirection || waveDirection;

  if (!direction) {
    return 40; // No data - slightly pessimistic
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
    return 70; // Close to optimal angle
  }

  // Wrong direction entirely
  return 35;
}

/**
 * Score data confidence (0-100)
 * More data sources = more reliable prediction
 */
function scoreDataConfidence(sourceCount) {
  if (sourceCount >= 5) return 100;  // Excellent coverage
  if (sourceCount >= 4) return 90;
  if (sourceCount >= 3) return 75;
  if (sourceCount >= 2) return 55;
  return 30; // Single source - low confidence
}

/**
 * Get rating label from score (7 tiers)
 */
function getRating(score) {
  if (score >= 85) return 'EPIC';
  if (score >= 75) return 'GREAT';
  if (score >= 65) return 'GOOD';
  if (score >= 50) return 'FAIR';
  if (score >= 35) return 'MARGINAL';
  if (score >= 20) return 'POOR';
  return 'FLAT';
}

/**
 * Generate a human-readable explanation of conditions
 */
function generateExplanation(conditions, breakdown, score) {
  const parts = [];
  const waves = conditions.waves || {};
  const wind = conditions.wind || {};
  const swell = waves.swell || {};

  // Wave size description
  const height = waves.height?.avg;
  if (height) {
    if (breakdown.waveHeight >= 80) {
      parts.push(`Great wave size at ${height}m`);
    } else if (breakdown.waveHeight >= 50) {
      parts.push(`Decent ${height}m waves`);
    } else if (height < 0.3) {
      parts.push('Essentially flat');
    } else {
      parts.push(`Small waves at ${height}m`);
    }
  } else {
    parts.push('No wave data available');
  }

  // Period / swell quality
  const period = swell.period || waves.period;
  if (period) {
    if (period >= 12) {
      parts.push(`clean groundswell (${period}s period)`);
    } else if (period >= 9) {
      parts.push(`decent ${period}s period`);
    } else if (period >= 6) {
      parts.push(`short-period wind swell (${period}s)`);
    } else {
      parts.push(`very choppy ${period}s wind chop`);
    }
  }

  // Wind conditions
  if (wind.speed !== null && wind.speed !== undefined) {
    const dir = wind.direction || '';
    if (breakdown.windSpeed >= 80 && breakdown.windDirection >= 80) {
      parts.push('glassy with offshore wind');
    } else if (breakdown.windSpeed >= 80) {
      parts.push('light wind');
    } else if (breakdown.windSpeed >= 50) {
      if (breakdown.windDirection <= 30) {
        parts.push(`onshore ${dir} wind at ${wind.speed} km/h`);
      } else {
        parts.push(`moderate ${wind.speed} km/h wind`);
      }
    } else {
      if (breakdown.windDirection <= 30) {
        parts.push(`strong onshore ${dir} wind (${wind.speed} km/h)`);
      } else {
        parts.push(`windy at ${wind.speed} km/h`);
      }
    }

    // Gust note
    if (wind.gusts && wind.gusts > wind.speed * 1.4) {
      parts.push(`gusty to ${wind.gusts} km/h`);
    }
  }

  return parts.join(', ') + '.';
}

module.exports = {
  calculateSurfScore,
  scoreWaveHeight,
  scoreWavePeriod,
  scoreSwellQuality,
  scoreWindSpeed,
  scoreWindDirection,
  scoreWaveDirection,
  scoreDataConfidence,
  generateExplanation,
  getRating
};
