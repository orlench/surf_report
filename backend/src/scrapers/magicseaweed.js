const brightData = require('../integrations/brightData');
const logger = require('../utils/logger');

/**
 * Scrape magicseaweed.com for wave conditions via Bright Data MCP
 * Provides: wave height, period, direction, wind speed/direction
 * Note: Magicseaweed was acquired by Surfline and may redirect there
 */

const SPOT_URLS = {
  herzliya_marina: 'https://www.surf-forecast.com/breaks/Herzliya/forecasts/latest',
  netanya_kontiki: 'https://www.surf-forecast.com/breaks/Netanya/forecasts/latest',
  tel_aviv_maaravi: 'https://www.surf-forecast.com/breaks/Hof-Maravi/forecasts/latest'
};

// Magicseaweed spot pages for Israeli breaks
const MSW_URLS = {
  herzliya_marina: 'https://magicseaweed.com/Herzliya-Surf-Report/5359/',
  netanya_kontiki: 'https://magicseaweed.com/Netanya-Surf-Report/5360/',
  tel_aviv_maaravi: 'https://magicseaweed.com/Hof-Maravi-Surf-Report/3663/'
};

async function scrapeMagicseaweed(spotId) {
  const url = MSW_URLS[spotId];
  if (!url) {
    logger.warn(`[Magicseaweed] No URL configured for spot: ${spotId}`);
    return null;
  }

  logger.info(`[Magicseaweed] Scraping ${url} via Bright Data`);

  const markdown = await brightData.scrapeAsMarkdown(url);
  return parseMagicseaweedMarkdown(markdown);
}

function parseMagicseaweedMarkdown(markdown) {
  logger.info(`[Magicseaweed] Parsing markdown (${markdown.length} chars)`);
  logger.info(`[Magicseaweed] Markdown preview: ${markdown.substring(0, 800)}`);

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

  // MSW often shows height in feet (e.g. "2-3ft") or meters ("0.6-0.9m")
  // Try meter range first
  const heightMRangeMatch = markdown.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*m(?:\s|$)/i);
  const heightFtRangeMatch = markdown.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*ft/i);
  const heightFtSingleMatch = markdown.match(/(\d+\.?\d*)\s*ft\b/i);
  const heightMSingleMatch = markdown.match(/(\d+\.?\d*)\s*m(?:\s|$)/i);

  if (heightMRangeMatch) {
    const min = parseFloat(heightMRangeMatch[1]);
    const max = parseFloat(heightMRangeMatch[2]);
    conditions.waves.height = {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(((min + max) / 2) * 10) / 10
    };
  } else if (heightFtRangeMatch) {
    const min = parseFloat(heightFtRangeMatch[1]) * 0.3048;
    const max = parseFloat(heightFtRangeMatch[2]) * 0.3048;
    conditions.waves.height = {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(((min + max) / 2) * 10) / 10
    };
  } else if (heightFtSingleMatch) {
    const avg = parseFloat(heightFtSingleMatch[1]) * 0.3048;
    conditions.waves.height = {
      min: Math.round(avg * 0.85 * 10) / 10,
      max: Math.round(avg * 1.15 * 10) / 10,
      avg: Math.round(avg * 10) / 10
    };
  } else if (heightMSingleMatch) {
    const avg = parseFloat(heightMSingleMatch[1]);
    if (avg > 0.1 && avg < 10) {
      conditions.waves.height = {
        min: Math.round(avg * 0.85 * 10) / 10,
        max: Math.round(avg * 1.15 * 10) / 10,
        avg: Math.round(avg * 10) / 10
      };
    }
  }

  if (conditions.waves.height.avg !== null) {
    logger.debug(`[Magicseaweed] Wave height: ${conditions.waves.height.avg}m`);
  }

  // Wave period
  const periodMatch = markdown.match(/period[:\s]+(\d+)\s*s/i)
    || markdown.match(/(\d+)\s*s\s+period/i)
    || markdown.match(/\|\s*(\d+)\s*s\s*\|/);
  if (periodMatch) {
    const period = parseInt(periodMatch[1]);
    if (period >= 4 && period <= 25) {
      conditions.waves.period = period;
      logger.debug(`[Magicseaweed] Wave period: ${period}s`);
    }
  }

  // Swell direction
  const swellDirMatch = markdown.match(/swell[^.]*?([NESW]{1,3})/i)
    || markdown.match(/([NESW]{1,3})\s+swell/i);
  if (swellDirMatch) {
    conditions.waves.direction = swellDirMatch[1].toUpperCase();
    logger.debug(`[Magicseaweed] Wave direction: ${conditions.waves.direction}`);
  }

  // Wind speed (MSW typically shows km/h)
  const windKmhMatch = markdown.match(/wind[^.]*?(\d+)\s*km\/?h/i);
  const windKnotsMatch = markdown.match(/wind[^.]*?(\d+)\s*(?:kts?|knots?)/i);

  if (windKmhMatch) {
    conditions.wind.speed = parseInt(windKmhMatch[1]);
  } else if (windKnotsMatch) {
    conditions.wind.speed = Math.round(parseInt(windKnotsMatch[1]) * 1.852);
  }

  if (conditions.wind.speed !== null) {
    logger.debug(`[Magicseaweed] Wind speed: ${conditions.wind.speed} km/h`);
  }

  // Wind direction
  const windDirMatch = markdown.match(/wind[^.]*?(?:from\s+)?([NESW]{1,3})/i)
    || markdown.match(/([NESW]{1,3})\s+wind/i);
  if (windDirMatch) {
    conditions.wind.direction = windDirMatch[1].toUpperCase();
    logger.debug(`[Magicseaweed] Wind direction: ${conditions.wind.direction}`);
  }

  // Water temperature
  const waterTempMatch = markdown.match(/(?:water|sea)\s+temp(?:erature)?[:\s]+([\d.]+)\s*°?C/i);
  if (waterTempMatch) {
    conditions.weather.waterTemp = Math.round(parseFloat(waterTempMatch[1]));
    logger.debug(`[Magicseaweed] Water temp: ${conditions.weather.waterTemp}°C`);
  }

  const hasData = conditions.waves.height.avg !== null || conditions.wind.speed !== null;
  if (!hasData) {
    logger.warn(`[Magicseaweed] Could not extract any data from markdown`);
    return null;
  }

  // Best-effort hourly forecast extraction
  conditions.hourly = parseMagicseaweedHourly(markdown);

  logger.info(`[Magicseaweed] Successfully parsed data (${conditions.hourly.length} hourly entries)`);
  return conditions;
}

function parseMagicseaweedHourly(markdown) {
  const hourly = [];
  try {
    const rows = markdown.split('\n');
    const today = new Date();

    for (const row of rows) {
      const timeMatch = row.match(/(\d{1,2})\s*(?:AM|PM|:00|h)/i);
      if (!timeMatch) continue;

      let hour = parseInt(timeMatch[1]);
      if (/PM/i.test(row) && hour < 12) hour += 12;
      if (/AM/i.test(row) && hour === 12) hour = 0;

      const waveMatch = row.match(/(\d+\.?\d*)\s*(?:m|ft)/i);
      const periodMatch = row.match(/(\d+)\s*s/);
      const windMatch = row.match(/(\d+)\s*km\/?h/i) || row.match(/(\d+)\s*(?:kts?|knots?)/i);
      const dirMatch = row.match(/\b([NESW]{1,3})\b/);

      if (waveMatch || windMatch) {
        const isFt = /ft/i.test(row);
        const waveAvg = waveMatch ? parseFloat(waveMatch[1]) * (isFt ? 0.3048 : 1) : null;
        hourly.push({
          time: `${today.toISOString().split('T')[0]}T${String(hour).padStart(2, '0')}:00`,
          waves: waveAvg ? { height: { avg: Math.round(waveAvg * 10) / 10 }, period: periodMatch ? parseInt(periodMatch[1]) : null, direction: null } : undefined,
          wind: windMatch ? { speed: Math.round(parseInt(windMatch[1]) * (/kts?/i.test(row) ? 1.852 : 1)), direction: dirMatch ? dirMatch[1].toUpperCase() : null, gusts: null } : undefined
        });
      }
    }
  } catch (e) {
    logger.debug(`[Magicseaweed] Hourly parsing failed: ${e.message}`);
  }
  return hourly;
}

module.exports = {
  scrapeMagicseaweed,
  SPOT_URLS: MSW_URLS
};
