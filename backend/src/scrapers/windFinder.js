const brightData = require('../integrations/brightData');
const logger = require('../utils/logger');

/**
 * Scrape windfinder.com for wind conditions via Bright Data MCP
 * Provides: wind speed, direction, gusts, air temperature
 */

const SPOT_URLS = {
  herzliya_marina: 'https://www.windfinder.com/forecast/herzliya_marina',
  netanya_kontiki: 'https://www.windfinder.com/forecast/netanya',
  tel_aviv_maaravi: 'https://www.windfinder.com/forecast/jaffa_tel_aviv_israel',
  ocean_beach_sf: 'https://www.windfinder.com/forecast/ocean_beach'
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

  // Best-effort hourly forecast extraction
  conditions.hourly = parseWindFinderHourly(markdown);

  logger.info(`[WindFinder] Successfully parsed data (${conditions.hourly.length} hourly entries)`);
  return conditions;
}

function parseWindFinderHourly(markdown) {
  const hourly = [];
  try {
    const rows = markdown.split('\n');
    const today = new Date();

    for (const row of rows) {
      const timeMatch = row.match(/(\d{1,2})\s*(?:h|:00|AM|PM)/i);
      if (!timeMatch) continue;

      let hour = parseInt(timeMatch[1]);
      if (/PM/i.test(row) && hour < 12) hour += 12;
      if (/AM/i.test(row) && hour === 12) hour = 0;

      const windKmh = row.match(/(\d+)\s*km\/?h/i);
      const windKts = row.match(/(\d+)\s*(?:kts?|knots?)/i);
      const windMs = row.match(/(\d+(?:\.\d+)?)\s*m\/s/i);
      const gustMatch = row.match(/gust[^.]*?(\d+)/i);
      const dirMatch = row.match(/\b([NESW]{1,3})\b/);

      let speed = null;
      if (windKmh) speed = parseInt(windKmh[1]);
      else if (windKts) speed = Math.round(parseInt(windKts[1]) * 1.852);
      else if (windMs) speed = Math.round(parseFloat(windMs[1]) * 3.6);

      if (speed !== null) {
        hourly.push({
          time: `${today.toISOString().split('T')[0]}T${String(hour).padStart(2, '0')}:00`,
          wind: {
            speed,
            direction: dirMatch ? dirMatch[1].toUpperCase() : null,
            gusts: gustMatch ? parseInt(gustMatch[1]) : null
          }
        });
      }
    }
  } catch (e) {
    logger.debug(`[WindFinder] Hourly parsing failed: ${e.message}`);
  }
  return hourly;
}

module.exports = {
  scrapeWindFinder,
  SPOT_URLS
};
