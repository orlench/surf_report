const logger = require('../utils/logger');

/**
 * Recommend a surfboard type based on current wave/wind conditions.
 * Uses a wave height × period (steepness) matrix with wind modifiers.
 *
 * Sources:
 * - SurfScience wave-to-board chart
 * - BreakFinder volume formula (weight × skill multiplier)
 */

const BOARD_TYPES = {
  sup: {
    boardType: 'sup',
    boardName: 'SUP / Foil',
    reason: "Barely any waves — SUP or foil if you want water time"
  },
  longboard: {
    boardType: 'longboard',
    boardName: 'Longboard',
    reason: "Small and mellow — grab the log and cruise"
  },
  fish: {
    boardType: 'fish',
    boardName: 'Fish',
    reason: "Fun little waves — your fish will fly on these"
  },
  midlength: {
    boardType: 'midlength',
    boardName: 'Mid-length',
    reason: "All-round conditions — a mid-length is the sweet spot"
  },
  shortboard: {
    boardType: 'shortboard',
    boardName: 'Shortboard',
    reason: "Proper waves! Time for the shortboard"
  },
  any: {
    boardType: 'any',
    boardName: 'Any board',
    reason: "Perfect conditions — ride whatever makes you happy"
  },
  stepup: {
    boardType: 'stepup',
    boardName: 'Step-up',
    reason: "Getting serious — paddle out on something with extra length"
  },
  gun: {
    boardType: 'gun',
    boardName: 'Gun',
    reason: "Big day. Bring the gun and respect the ocean"
  }
};

// Decision matrix: [heightRange][periodRange] => board type key
// Period ranges: short (<8s), medium (8-12s), long (13s+)
// Height ranges: tiny (<0.3), small (0.3-0.6), smallmed (0.6-1.0),
//                medium (1.0-1.5), large (1.5-2.5), xl (>2.5)
const MATRIX = {
  tiny:     { short: 'sup',       medium: 'sup',       long: 'longboard' },
  small:    { short: 'longboard', medium: 'longboard',  long: 'fish' },
  smallmed: { short: 'fish',      medium: 'midlength',  long: 'shortboard' },
  medium:   { short: 'midlength', medium: 'any',        long: 'shortboard' },
  large:    { short: 'midlength', medium: 'shortboard', long: 'stepup' },
  xl:       { short: 'stepup',    medium: 'stepup',     long: 'gun' }
};

// Volume multipliers by skill level
const SKILL_MULTIPLIERS = {
  beginner: 0.62,
  intermediate: 0.50,
  advanced: 0.41,
  expert: 0.36
};

function getHeightRange(height) {
  if (height < 0.3) return 'tiny';
  if (height < 0.6) return 'small';
  if (height < 1.0) return 'smallmed';
  if (height < 1.5) return 'medium';
  if (height < 2.5) return 'large';
  return 'xl';
}

function getPeriodRange(period) {
  if (period < 8) return 'short';
  if (period < 13) return 'medium';
  return 'long';
}

/**
 * Recommend a board type based on current conditions.
 * No user data needed — purely conditions-based.
 */
function recommendBoard(conditions) {
  const height = conditions.waves?.height?.avg || 0;
  const period = conditions.waves?.swell?.period || conditions.waves?.period || 0;
  const windSpeed = conditions.wind?.speed || 0;
  const windDir = conditions.wind?.direction || '';

  const heightRange = getHeightRange(height);
  const periodRange = getPeriodRange(period);

  let boardKey = MATRIX[heightRange]?.[periodRange] || 'midlength';

  // Wind modifier: strong onshore wind (>25 km/h from W/NW/SW on Israeli coast) -> bump volume
  // This means need more paddle power, so go one tier up
  const onshoreDirections = ['W', 'NW', 'SW', 'N'];
  const isOnshore = onshoreDirections.includes(windDir);
  if (isOnshore && windSpeed > 25) {
    boardKey = bumpUp(boardKey);
    logger.debug(`[BoardRec] Wind modifier: strong onshore ${windDir} ${windSpeed}km/h, bumped to ${boardKey}`);
  }

  const board = { ...BOARD_TYPES[boardKey] };

  logger.info(`[BoardRec] height=${height}m (${heightRange}), period=${period}s (${periodRange}), wind=${windSpeed}km/h ${windDir} => ${board.boardName}`);

  return board;
}

/**
 * Bump up one volume/stability tier for choppy conditions
 */
function bumpUp(boardKey) {
  const order = ['sup', 'longboard', 'fish', 'midlength', 'any', 'shortboard', 'stepup', 'gun'];
  const idx = order.indexOf(boardKey);
  if (idx <= 0) return boardKey; // already at max volume
  // Move toward more volume (lower index)
  return order[idx - 1];
}

/**
 * Personalized recommendation with volume calculation.
 * Uses BreakFinder formula: volume = weight × skill_multiplier + adjustments
 */
function recommendBoardPersonalized(conditions, userProfile) {
  const board = recommendBoard(conditions);

  if (!userProfile?.weight || !userProfile?.skillLevel) {
    return board;
  }

  const weight = parseFloat(userProfile.weight);
  const skill = userProfile.skillLevel;
  const multiplier = SKILL_MULTIPLIERS[skill] || SKILL_MULTIPLIERS.intermediate;

  let volume = weight * multiplier;

  // Wave size adjustment
  const height = conditions.waves?.height?.avg || 0;
  if (height < 0.6) volume += 2;
  else if (height > 2.0) volume -= 1;

  // Strong onshore wind adjustment
  const windSpeed = conditions.wind?.speed || 0;
  const windDir = conditions.wind?.direction || '';
  const onshoreDirections = ['W', 'NW', 'SW', 'N'];
  if (onshoreDirections.includes(windDir) && windSpeed > 25) {
    volume += 1;
  }

  volume = Math.round(volume * 10) / 10;

  board.volume = {
    recommended: volume,
    range: [Math.round((volume - 2) * 10) / 10, Math.round((volume + 2) * 10) / 10]
  };

  logger.info(`[BoardRec] Personalized: ${weight}kg, ${skill} => ~${volume}L`);

  return board;
}

module.exports = { recommendBoard, recommendBoardPersonalized };
