const { calculateSurfScore, getRating } = require('./scoring');
const logger = require('../utils/logger');

/**
 * Generate a short-term trend analysis from hourly forecast data
 *
 * @param {Array} hourlyTimeline - Aggregated hourly conditions (from aggregateHourlyData)
 * @param {string} spotId - Spot identifier
 * @param {number} currentScore - Current overall score
 * @returns {Object} - Trend analysis with message, best window, and block scores
 */
function generateTrend(hourlyTimeline, spotId, currentScore) {
  if (!hourlyTimeline || hourlyTimeline.length < 3) {
    logger.warn(`[Trend] Not enough hourly data for trend analysis (${hourlyTimeline?.length || 0} entries)`);
    return null;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Define time blocks
  const blockDefs = [
    { label: 'This morning', day: todayStr, startHour: 6, endHour: 11, skipIfPast: true },
    { label: 'Midday', day: todayStr, startHour: 11, endHour: 14, skipIfPast: true },
    { label: 'This afternoon', day: todayStr, startHour: 14, endHour: 18, skipIfPast: true },
    { label: 'This evening', day: todayStr, startHour: 18, endHour: 21, skipIfPast: true },
    { label: 'Tomorrow morning', day: tomorrowStr, startHour: 6, endHour: 11, skipIfPast: false },
    { label: 'Tomorrow midday', day: tomorrowStr, startHour: 11, endHour: 14, skipIfPast: false },
    { label: 'Tomorrow afternoon', day: tomorrowStr, startHour: 14, endHour: 18, skipIfPast: false },
    { label: 'Tomorrow evening', day: tomorrowStr, startHour: 18, endHour: 21, skipIfPast: false }
  ];

  const blocks = [];

  for (const def of blockDefs) {
    // Skip blocks that are in the past
    if (def.skipIfPast && def.endHour <= currentHour) continue;

    // Find hourly entries in this block
    const blockEntries = hourlyTimeline.filter(h => {
      const hDate = h.time.substring(0, 10);
      const hHour = parseInt(h.time.substring(11, 13));
      return hDate === def.day && hHour >= def.startHour && hHour < def.endHour;
    });

    if (blockEntries.length === 0) continue;

    // Average the block entries into a single conditions object
    const blockConditions = averageBlockEntries(blockEntries);

    // Score this block using the existing scoring engine
    try {
      const score = calculateSurfScore(blockConditions, spotId, 3);
      blocks.push({
        label: def.label,
        score: score.overall,
        rating: score.rating,
        conditions: blockConditions,
        breakdown: score.breakdown
      });
    } catch (e) {
      logger.debug(`[Trend] Could not score block "${def.label}": ${e.message}`);
    }
  }

  if (blocks.length === 0) {
    logger.warn(`[Trend] No scoreable blocks found`);
    return null;
  }

  // Find the best upcoming window
  const bestBlock = blocks.reduce((best, b) => b.score > best.score ? b : best, blocks[0]);

  // Determine overall trend direction
  const futureScores = blocks.map(b => b.score);
  const avgFutureScore = futureScores.reduce((s, v) => s + v, 0) / futureScores.length;
  const scoreDiff = avgFutureScore - currentScore;

  let trend;
  if (scoreDiff > 8) trend = 'improving';
  else if (scoreDiff < -8) trend = 'declining';
  else trend = 'stable';

  // Generate the message
  const message = generateTrendMessage(currentScore, bestBlock, blocks, trend);

  const result = {
    trend,
    bestWindow: {
      label: bestBlock.label,
      score: bestBlock.score,
      rating: bestBlock.rating
    },
    message,
    blocks: blocks.map(b => ({
      label: b.label,
      score: b.score,
      rating: b.rating
    }))
  };

  logger.info(`[Trend] Analysis: ${trend} | Best: ${bestBlock.label} (${bestBlock.score}) | Current: ${currentScore}`);
  return result;
}

/**
 * Average multiple hourly entries into a single conditions object for scoring
 */
function averageBlockEntries(entries) {
  const waveHeights = entries.filter(e => e.waves?.height?.avg).map(e => e.waves.height.avg);
  const wavePeriods = entries.filter(e => e.waves?.period).map(e => e.waves.period);
  const waveDirections = entries.filter(e => e.waves?.direction).map(e => e.waves.direction);
  const swellHeights = entries.filter(e => e.waves?.swell?.height).map(e => e.waves.swell.height);
  const swellPeriods = entries.filter(e => e.waves?.swell?.period).map(e => e.waves.swell.period);
  const swellDirections = entries.filter(e => e.waves?.swell?.direction).map(e => e.waves.swell.direction);
  const windSpeeds = entries.filter(e => e.wind?.speed).map(e => e.wind.speed);
  const windDirections = entries.filter(e => e.wind?.direction).map(e => e.wind.direction);
  const windGusts = entries.filter(e => e.wind?.gusts).map(e => e.wind.gusts);

  const avg = arr => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const mode = arr => {
    if (arr.length === 0) return null;
    const counts = {};
    let max = 0, result = null;
    for (const v of arr) {
      counts[v] = (counts[v] || 0) + 1;
      if (counts[v] > max) { max = counts[v]; result = v; }
    }
    return result;
  };

  const avgHeight = avg(waveHeights);
  return {
    waves: {
      height: { avg: avgHeight ? Math.round(avgHeight * 10) / 10 : null },
      period: wavePeriods.length > 0 ? Math.round(avg(wavePeriods)) : null,
      direction: mode(waveDirections),
      swell: swellHeights.length > 0 ? {
        height: Math.round(avg(swellHeights) * 10) / 10,
        period: swellPeriods.length > 0 ? Math.round(avg(swellPeriods)) : null,
        direction: mode(swellDirections)
      } : null
    },
    wind: {
      speed: windSpeeds.length > 0 ? Math.round(avg(windSpeeds)) : null,
      direction: mode(windDirections),
      gusts: windGusts.length > 0 ? Math.round(avg(windGusts)) : null
    },
    weather: {
      airTemp: null,
      waterTemp: null,
      cloudCover: null
    }
  };
}

/**
 * Generate natural-language trend message
 */
function generateTrendMessage(currentScore, bestBlock, blocks, trend) {
  const diff = bestBlock.score - currentScore;

  // If current conditions are the best or very close
  if (diff <= 3) {
    if (trend === 'declining') {
      return `Conditions are expected to decline — best to go now.`;
    }
    return `Conditions look stable for the next hours.`;
  }

  // Better conditions are coming
  if (diff >= 5) {
    // Figure out WHY it's better — compare wind and waves
    const bestWind = bestBlock.conditions?.wind?.speed;
    const bestWindDir = bestBlock.conditions?.wind?.direction;
    const bestPeriod = bestBlock.conditions?.waves?.period;

    // Find current-ish block for comparison
    const currentBlock = blocks[0];
    const currentWind = currentBlock?.conditions?.wind?.speed;
    const currentWindDir = currentBlock?.conditions?.wind?.direction;

    const reasons = [];

    // Wind easing
    if (bestWind && currentWind && bestWind < currentWind - 5) {
      reasons.push('wind should ease');
    }

    // Wind direction shift
    if (bestWindDir && currentWindDir && bestWindDir !== currentWindDir) {
      const offshoreDirections = ['E', 'NE', 'SE'];
      if (offshoreDirections.includes(bestWindDir)) {
        reasons.push(`wind shifting ${bestWindDir} (offshore)`);
      } else {
        reasons.push(`wind shifting to ${bestWindDir}`);
      }
    }

    // Swell building
    const bestHeight = bestBlock.conditions?.waves?.height?.avg;
    const currentHeight = currentBlock?.conditions?.waves?.height?.avg;
    if (bestHeight && currentHeight && bestHeight > currentHeight + 0.2) {
      reasons.push('swell building');
    }

    // Period improving
    if (bestPeriod && bestPeriod > (currentBlock?.conditions?.waves?.period || 0) + 2) {
      reasons.push('swell period increasing');
    }

    const reasonText = reasons.length > 0 ? reasons.join(' and ') : 'conditions improving';
    return `${capitalize(reasonText)} ${bestBlock.label.toLowerCase()} — expect ${bestBlock.rating} (${bestBlock.score}/100).`;
  }

  // Small improvement
  return `Slight improvement expected ${bestBlock.label.toLowerCase()} — ${bestBlock.rating} (${bestBlock.score}/100).`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { generateTrend };
