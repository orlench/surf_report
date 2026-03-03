const brightData = require('../integrations/brightData');
const logger = require('../utils/logger');

/**
 * Scrape Windguru for wind + wave forecasts via Bright Data
 * Uses coordinate-based URL — works globally for any lat/lon
 * Provides: wind speed, gusts, direction, wave height, period
 */

const coordsMap = {};

function registerCoords(spotId, lat, lon) {
  coordsMap[spotId] = { lat, lon };
}

async function scrapeWindguru(spotId) {
  const coords = coordsMap[spotId];
  if (!coords) {
    logger.warn(`[Windguru] No coords registered for spot: ${spotId}`);
    return null;
  }

  const { lat, lon } = coords;
  const url = `https://www.windguru.cz/int/?sc=0&lat=${lat}&lon=${lon}`;
  logger.info(`[Windguru] Scraping ${url}`);

  const markdown = await brightData.scrapeAsMarkdown(url);
  return parseWindguruMarkdown(markdown);
}

function parseWindguruMarkdown(markdown) {
  logger.info(`[Windguru] Parsing markdown (${markdown.length} chars)`);
  logger.debug(`[Windguru] Preview: ${markdown.substring(0, 600)}`);

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

  // Wind speed — Windguru typically shows knots, m/s, or km/h
  const windKnotsMatch = markdown.match(/wind\s*speed[^.]*?(\d+)\s*(?:kts?|knots?)/i)
    || markdown.match(/(\d+)\s*(?:kts?|knots?)\s+wind/i)
    || markdown.match(/WSPD[:\s]+(\d+)/i)
    || markdown.match(/(?:^|\|)\s*(\d{1,3})\s*(?:\||\s+(?:kts?|knots?))/m);
  const windKmhMatch = markdown.match(/wind[^.]*?(\d+)\s*km\/?h/i);
  const windMsMatch = markdown.match(/wind[^.]*?(\d+(?:\.\d+)?)\s*m\/s/i)
    || markdown.match(/(\d+(?:\.\d+)?)\s*m\/s/i);

  if (windKnotsMatch) {
    conditions.wind.speed = Math.round(parseInt(windKnotsMatch[1]) * 1.852);
  } else if (windKmhMatch) {
    conditions.wind.speed = parseInt(windKmhMatch[1]);
  } else if (windMsMatch) {
    conditions.wind.speed = Math.round(parseFloat(windMsMatch[1]) * 3.6);
  }

  if (conditions.wind.speed !== null) {
    // Sanity check
    if (conditions.wind.speed > 200) conditions.wind.speed = null;
    else logger.debug(`[Windguru] Wind speed: ${conditions.wind.speed} km/h`);
  }

  // Wind gusts
  const gustsKnotsMatch = markdown.match(/gust[^.]*?(\d+)\s*(?:kts?|knots?)/i)
    || markdown.match(/GUST[:\s]+(\d+)/i);
  const gustsKmhMatch = markdown.match(/gust[^.]*?(\d+)\s*km\/?h/i);
  const gustsMsMatch = markdown.match(/gust[^.]*?(\d+(?:\.\d+)?)\s*m\/s/i);

  if (gustsKnotsMatch) {
    conditions.wind.gusts = Math.round(parseInt(gustsKnotsMatch[1]) * 1.852);
  } else if (gustsKmhMatch) {
    conditions.wind.gusts = parseInt(gustsKmhMatch[1]);
  } else if (gustsMsMatch) {
    conditions.wind.gusts = Math.round(parseFloat(gustsMsMatch[1]) * 3.6);
  }

  // Wind direction
  const windDirMatch = markdown.match(/wind[^.]*?(?:dir(?:ection)?|from)[:\s]+([NESW]{1,3})/i)
    || markdown.match(/WDIR[:\s]+([NESW]{1,3})/i)
    || markdown.match(/\b(N|NE|E|SE|S|SW|W|NW|NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW)\b/);
  if (windDirMatch) {
    conditions.wind.direction = windDirMatch[1].toUpperCase();
    logger.debug(`[Windguru] Wind direction: ${conditions.wind.direction}`);
  }

  // Wave height
  const waveHeightMRangeMatch = markdown.match(/(?:wave|swell|surf)[^.]*?(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*m/i);
  const waveHeightMMatch = markdown.match(/(?:wave|swell|HTSGW)[^.]*?(\d+\.?\d*)\s*m/i)
    || markdown.match(/HTSGW[:\s]+([\d.]+)/i);
  const waveHeightFtRangeMatch = markdown.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*ft/i);
  const waveHeightFtMatch = markdown.match(/(?:wave|swell)[^.]*?(\d+\.?\d*)\s*ft/i);

  if (waveHeightMRangeMatch) {
    const min = parseFloat(waveHeightMRangeMatch[1]);
    const max = parseFloat(waveHeightMRangeMatch[2]);
    conditions.waves.height = { min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10, avg: Math.round(((min + max) / 2) * 10) / 10 };
  } else if (waveHeightMMatch) {
    const avg = parseFloat(waveHeightMMatch[1]);
    if (avg > 0.05 && avg < 15) {
      conditions.waves.height = { min: Math.round(avg * 0.85 * 10) / 10, max: Math.round(avg * 1.15 * 10) / 10, avg: Math.round(avg * 10) / 10 };
    }
  } else if (waveHeightFtRangeMatch) {
    const min = parseFloat(waveHeightFtRangeMatch[1]) * 0.3048;
    const max = parseFloat(waveHeightFtRangeMatch[2]) * 0.3048;
    conditions.waves.height = { min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10, avg: Math.round(((min + max) / 2) * 10) / 10 };
  } else if (waveHeightFtMatch) {
    const avg = parseFloat(waveHeightFtMatch[1]) * 0.3048;
    if (avg > 0.05 && avg < 15) {
      conditions.waves.height = { min: Math.round(avg * 0.85 * 10) / 10, max: Math.round(avg * 1.15 * 10) / 10, avg: Math.round(avg * 10) / 10 };
    }
  }

  if (conditions.waves.height.avg !== null) {
    logger.debug(`[Windguru] Wave height: ${conditions.waves.height.avg}m`);
  }

  // Wave period
  const periodMatch = markdown.match(/(?:wave\s+)?period[:\s]+(\d+)\s*s/i)
    || markdown.match(/PERPW[:\s]+(\d+)/i)
    || markdown.match(/(\d+)\s*s\s+period/i);
  if (periodMatch) {
    const p = parseInt(periodMatch[1]);
    if (p >= 3 && p <= 30) {
      conditions.waves.period = p;
      logger.debug(`[Windguru] Wave period: ${p}s`);
    }
  }

  // Air temperature
  const airTempMatch = markdown.match(/(?:air|temp(?:erature)?)[:\s]+([\d.]+)\s*°?C/i)
    || markdown.match(/TMP[:\s]+([\d.]+)/i);
  if (airTempMatch) {
    const t = parseFloat(airTempMatch[1]);
    if (t > -40 && t < 55) {
      conditions.weather.airTemp = Math.round(t);
      logger.debug(`[Windguru] Air temp: ${conditions.weather.airTemp}°C`);
    }
  }

  const hasData = conditions.wind.speed !== null || conditions.waves.height.avg !== null;
  if (!hasData) {
    logger.warn(`[Windguru] Could not extract usable data from markdown`);
    return null;
  }

  conditions.hourly = parseWindguruHourly(markdown);
  logger.info(`[Windguru] Parsed successfully (${conditions.hourly.length} hourly entries)`);
  return conditions;
}

function parseWindguruHourly(markdown) {
  const hourly = [];
  try {
    const rows = markdown.split('\n');
    const today = new Date();

    for (const row of rows) {
      const timeMatch = row.match(/\b(\d{1,2}):00\b/) || row.match(/\b(\d{1,2})\s*h\b/i);
      if (!timeMatch) continue;

      const hour = parseInt(timeMatch[1]);
      if (hour < 0 || hour > 23) continue;

      const windKts = row.match(/(\d+)\s*(?:kts?|knots?)/i);
      const windKmh = row.match(/(\d+)\s*km\/?h/i);
      const windMs = row.match(/(\d+(?:\.\d+)?)\s*m\/s/i);
      const gustMatch = row.match(/gust[^\d]*(\d+)/i);
      const dirMatch = row.match(/\b(N|NE|E|SE|S|SW|W|NW|NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW)\b/);
      const waveMatch = row.match(/(\d+\.?\d*)\s*m\b/);

      let speed = null;
      if (windKts) speed = Math.round(parseInt(windKts[1]) * 1.852);
      else if (windKmh) speed = parseInt(windKmh[1]);
      else if (windMs) speed = Math.round(parseFloat(windMs[1]) * 3.6);

      if (speed !== null && speed < 200) {
        hourly.push({
          time: `${today.toISOString().split('T')[0]}T${String(hour).padStart(2, '0')}:00`,
          wind: {
            speed,
            direction: dirMatch ? dirMatch[1].toUpperCase() : null,
            gusts: gustMatch ? parseInt(gustMatch[1]) : null
          },
          waves: waveMatch ? { height: { avg: parseFloat(waveMatch[1]) }, period: null, direction: null } : undefined
        });
      }
    }
  } catch (e) {
    logger.debug(`[Windguru] Hourly parse failed: ${e.message}`);
  }
  return hourly;
}

module.exports = { scrapeWindguru, registerCoords };
