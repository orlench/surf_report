const brightData = require('../integrations/brightData');
const logger = require('../utils/logger');

/**
 * Scrape windfinder.com for wind conditions via Bright Data MCP
 * Provides: wind speed, direction, gusts, air temperature
 */

const SPOT_URLS = {
  herzliya_marina: 'https://www.windfinder.com/forecast/herzliya_marina',
  netanya_kontiki: 'https://www.windfinder.com/forecast/netanya',
  tel_aviv_maaravi: 'https://www.windfinder.com/forecast/jaffa_tel_aviv_israel'
};

async function scrapeWindFinder(spotId) {
  const url = SPOT_URLS[spotId];
  if (!url) {
    logger.warn(`[WindFinder] No URL configured for spot: ${spotId}`);
    return null;
  }

  logger.info(`[WindFinder] Scraping ${url} via Bright Data`);

  const markdown = await brightData.scrapeAsMarkdown(url);
  return parseWindFinderMarkdown(markdown);
}

function parseWindFinderMarkdown(markdown) {
  logger.info(`[WindFinder] Parsing markdown (${markdown.length} chars)`);
  logger.info(`[WindFinder] Markdown preview: ${markdown.substring(0, 800)}`);

  const conditions = {
    waves: {
      height: { min: null, max: null, avg: null },
      period: null,
      direction: null,
      swell: null
    },
    wind: {
      speed: null,
      direction: null,
      gusts: null
    },
    weather: {
      airTemp: null,
      waterTemp: null,
      cloudCover: null
    }
  };

  // Wind speed - WindFinder may show knots, km/h, or m/s
  // Try km/h first, then knots, then m/s
  const windKmhMatch = markdown.match(/wind[^.]*?(\d+)\s*km\/?h/i)
    || markdown.match(/(\d+)\s*km\/?h[^.]*?wind/i);
  const windKnotsMatch = markdown.match(/wind[^.]*?(\d+)\s*(?:kts?|knots?)/i)
    || markdown.match(/(\d+)\s*(?:kts?|knots?)/i);
  const windMs = markdown.match(/wind[^.]*?(\d+(?:\.\d+)?)\s*m\/s/i);

  if (windKmhMatch) {
    conditions.wind.speed = parseInt(windKmhMatch[1]);
  } else if (windKnotsMatch) {
    conditions.wind.speed = Math.round(parseInt(windKnotsMatch[1]) * 1.852);
  } else if (windMs) {
    conditions.wind.speed = Math.round(parseFloat(windMs[1]) * 3.6);
  }

  if (conditions.wind.speed !== null) {
    logger.debug(`[WindFinder] Wind speed: ${conditions.wind.speed} km/h`);
  }

  // Wind gusts
  const gustsKmhMatch = markdown.match(/gust[^.]*?(\d+)\s*km\/?h/i);
  const gustsKnotsMatch = markdown.match(/gust[^.]*?(\d+)\s*(?:kts?|knots?)/i);
  const gustsMs = markdown.match(/gust[^.]*?(\d+(?:\.\d+)?)\s*m\/s/i);

  if (gustsKmhMatch) {
    conditions.wind.gusts = parseInt(gustsKmhMatch[1]);
  } else if (gustsKnotsMatch) {
    conditions.wind.gusts = Math.round(parseInt(gustsKnotsMatch[1]) * 1.852);
  } else if (gustsMs) {
    conditions.wind.gusts = Math.round(parseFloat(gustsMs[1]) * 3.6);
  }

  if (conditions.wind.gusts !== null) {
    logger.debug(`[WindFinder] Wind gusts: ${conditions.wind.gusts} km/h`);
  }

  // Wind direction
  const windDirMatch = markdown.match(/wind[^.]*?(?:from|dir(?:ection)?)[:\s]+([NESW]{1,3})/i)
    || markdown.match(/([NESW]{1,3})\s+wind/i)
    || markdown.match(/wind[:\s]+[^A-Z]*([NESW]{1,3})\b/i);
  if (windDirMatch) {
    conditions.wind.direction = windDirMatch[1].toUpperCase();
    logger.debug(`[WindFinder] Wind direction: ${conditions.wind.direction}`);
  }

  // Air temperature
  const airTempMatch = markdown.match(/(?:air\s+)?temp(?:erature)?[:\s]+([\d.]+)\s*°?C/i)
    || markdown.match(/([\d.]+)\s*°C/);
  if (airTempMatch) {
    const temp = parseFloat(airTempMatch[1]);
    if (temp > -20 && temp < 50) {
      conditions.weather.airTemp = Math.round(temp);
      logger.debug(`[WindFinder] Air temp: ${conditions.weather.airTemp}°C`);
    }
  }

  // Wave height (WindFinder sometimes shows wave data)
  const waveMatch = markdown.match(/wave[^.]*?(\d+\.?\d*)\s*m/i);
  if (waveMatch) {
    const avg = parseFloat(waveMatch[1]);
    conditions.waves.height = {
      min: Math.round(avg * 0.85 * 10) / 10,
      max: Math.round(avg * 1.15 * 10) / 10,
      avg: Math.round(avg * 10) / 10
    };
    logger.debug(`[WindFinder] Wave height: ${avg}m`);
  }

  const hasData = conditions.wind.speed !== null;
  if (!hasData) {
    logger.warn(`[WindFinder] Could not extract wind data from markdown`);
    return null;
  }

  logger.info(`[WindFinder] Successfully parsed data`);
  return conditions;
}

module.exports = {
  scrapeWindFinder,
  SPOT_URLS
};
