const brightData = require('../integrations/brightData');
const logger = require('../utils/logger');

/**
 * Scrape surf-forecast.com for Israeli surf spots via Bright Data MCP
 * Provides: wave height, period, wind speed/direction, swell data
 */

const SPOT_URLS = {
  herzliya_marina: 'https://www.surf-forecast.com/breaks/Haambatia-Herzliya/forecasts/latest/six_day',
  netanya_kontiki: 'https://www.surf-forecast.com/breaks/Netanya/forecasts/latest/six_day',
  tel_aviv_maaravi: 'https://www.surf-forecast.com/breaks/Hof-Maravi/forecasts/latest/six_day'
};

async function scrapeSurfForecast(spotId) {
  const url = SPOT_URLS[spotId];
  if (!url) {
    logger.warn(`[Surf-forecast] No URL configured for spot: ${spotId}`);
    return null;
  }

  logger.info(`[Surf-forecast] Scraping ${url} via Bright Data`);

  const markdown = await brightData.scrapeAsMarkdown(url);
  return parseSurfForecastMarkdown(markdown);
}

function parseSurfForecastMarkdown(markdown) {
  logger.info(`[Surf-forecast] Parsing markdown (${markdown.length} chars)`);
  logger.info(`[Surf-forecast] Markdown preview: ${markdown.substring(0, 800)}`);

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

  // Wave height in meters - range or single value
  const heightMRangeMatch = markdown.match(/(?:wave|swell|surf)[^.]*?(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*m/i);
  const heightMSingleMatch = markdown.match(/(?:wave|swell|surf)[^.]*?(\d+\.?\d*)\s*m/i)
    || markdown.match(/\|\s*(\d+\.?\d*)\s*m\s*\|/);

  // Wave height in feet - range or single value
  const heightFtRangeMatch = markdown.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*ft/i);
  const heightFtSingleMatch = markdown.match(/(\d+\.?\d*)\s*ft/i);

  if (heightMRangeMatch) {
    const min = parseFloat(heightMRangeMatch[1]);
    const max = parseFloat(heightMRangeMatch[2]);
    conditions.waves.height = {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(((min + max) / 2) * 10) / 10
    };
  } else if (heightMSingleMatch) {
    const avg = parseFloat(heightMSingleMatch[1]);
    conditions.waves.height = {
      min: Math.round(avg * 0.85 * 10) / 10,
      max: Math.round(avg * 1.15 * 10) / 10,
      avg: Math.round(avg * 10) / 10
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
  }

  if (conditions.waves.height.avg !== null) {
    logger.debug(`[Surf-forecast] Wave height: ${conditions.waves.height.avg}m`);
  }

  // Wave period (4-25s range to avoid false matches)
  const periodPatterns = [
    /(?:wave\s+)?period[:\s]+(\d+)\s*s/i,
    /\|\s*(\d+)\s*s\s*\|/,
    /(\d+)\s+sec(?:ond)?s?\b/i
  ];
  for (const pattern of periodPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      const period = parseInt(match[1]);
      if (period >= 4 && period <= 25) {
        conditions.waves.period = period;
        logger.debug(`[Surf-forecast] Wave period: ${period}s`);
        break;
      }
    }
  }

  // Wave/swell direction
  const dirPatterns = [
    /(?:swell|wave)\s+dir(?:ection)?[:\s]+([NESW]{1,3})/i,
    /swell[:\s]+[^)]*\)\s+([NESW]{1,3})/i,
    /direction[:\s]+([NESW]{1,3})/i
  ];
  for (const pattern of dirPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      conditions.waves.direction = match[1].toUpperCase();
      logger.debug(`[Surf-forecast] Wave direction: ${conditions.waves.direction}`);
      break;
    }
  }

  // Wind speed
  const windKmhMatch = markdown.match(/wind[^.]*?(\d+)\s*km\/?h/i)
    || markdown.match(/wind\s+speed[:\s]+(\d+)/i);
  const windKnotsMatch = markdown.match(/wind[^.]*?(\d+)\s*knots?/i);
  const windMphMatch = markdown.match(/wind[^.]*?(\d+)\s*mph/i);

  if (windKmhMatch) {
    conditions.wind.speed = parseInt(windKmhMatch[1]);
  } else if (windKnotsMatch) {
    conditions.wind.speed = Math.round(parseInt(windKnotsMatch[1]) * 1.852);
  } else if (windMphMatch) {
    conditions.wind.speed = Math.round(parseInt(windMphMatch[1]) * 1.609);
  }

  if (conditions.wind.speed !== null) {
    logger.debug(`[Surf-forecast] Wind speed: ${conditions.wind.speed} km/h`);
  }

  // Wind direction
  const windDirMatch = markdown.match(/wind\s+dir(?:ection)?[:\s]+([NESW]{1,3})/i)
    || markdown.match(/wind[:\s]+\d+[^A-Z]*([NESW]{1,3})/i);
  if (windDirMatch) {
    conditions.wind.direction = windDirMatch[1].toUpperCase();
    logger.debug(`[Surf-forecast] Wind direction: ${conditions.wind.direction}`);
  }

  // Water temperature
  const waterTempMatch = markdown.match(/(?:water|sea)\s+temp(?:erature)?[:\s]+([\d.]+)\s*°?C/i);
  if (waterTempMatch) {
    conditions.weather.waterTemp = Math.round(parseFloat(waterTempMatch[1]));
    logger.debug(`[Surf-forecast] Water temp: ${conditions.weather.waterTemp}°C`);
  }

  // Air temperature
  const airTempMatch = markdown.match(/air\s+temp(?:erature)?[:\s]+([\d.]+)\s*°?C/i);
  if (airTempMatch) {
    conditions.weather.airTemp = Math.round(parseFloat(airTempMatch[1]));
    logger.debug(`[Surf-forecast] Air temp: ${conditions.weather.airTemp}°C`);
  }

  const hasData = conditions.waves.height.avg !== null || conditions.wind.speed !== null;
  if (!hasData) {
    logger.warn(`[Surf-forecast] Could not extract any data from markdown`);
    return null;
  }

  logger.info(`[Surf-forecast] Successfully parsed data`);
  return conditions;
}

module.exports = {
  scrapeSurfForecast,
  SPOT_URLS
};
