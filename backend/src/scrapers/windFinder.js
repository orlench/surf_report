const brightData = require('../integrations/brightData');
const logger = require('../utils/logger');

/**
 * Scrape windfinder.com for wind conditions via Bright Data MCP
 * Provides: wind speed, direction, gusts, air temperature
 */

const SPOT_URLS = {};
const coordsMap = {};
const urlCache = {}; // cache discovered URLs per spotId

function registerCoords(spotId, lat, lon, name, country) {
  coordsMap[spotId] = { lat, lon, name, country };
}

async function resolveUrl(spotId) {
  // Static URL takes priority
  if (SPOT_URLS[spotId]) return SPOT_URLS[spotId];
  // Return cached URL from previous search
  if (urlCache[spotId]) return urlCache[spotId];

  // Use spot name + country for the search (coords alone return empty results)
  const meta = coordsMap[spotId];
  const query = meta?.name
    ? `windfinder forecast ${meta.name} ${meta.country || ''} wind waves`
    : `windfinder forecast ${spotId} wind waves`;

  logger.info(`[WindFinder] Searching for spot URL: ${query}`);
  try {
    const searchResult = await brightData.searchEngine(query);
    const parsed = JSON.parse(searchResult);
    const firstResult = parsed?.organic?.[0]?.link;
    const urlMatch = firstResult?.match(/https?:\/\/(?:www\.)?windfinder\.com\/(?:forecast|weatherforecast|report)\/[\w-]+/);
    if (!urlMatch && firstResult) {
      // Try extracting from any organic result
      const anyLink = parsed.organic?.map(r => r.link).find(l => /windfinder\.com\/(forecast|weatherforecast)\//.test(l));
      if (anyLink) {
        urlCache[spotId] = anyLink;
        logger.info(`[WindFinder] Discovered URL for ${spotId}: ${anyLink}`);
        return anyLink;
      }
    }
    if (urlMatch) {
      urlCache[spotId] = urlMatch[0];
      logger.info(`[WindFinder] Discovered URL for ${spotId}: ${urlMatch[0]}`);
      return urlMatch[0];
    }
  } catch (err) {
    logger.warn(`[WindFinder] Search failed for ${spotId}: ${err.message}`);
  }
  return null;
}

async function scrapeWindFinder(spotId) {
  const url = await resolveUrl(spotId);
  if (!url) {
    logger.warn(`[WindFinder] Could not resolve URL for spot: ${spotId}`);
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

  // Wind speed — WindFinder shows knots in block format: "7 kts\nmax 9 kts"
  // Exclude lines that look like "max N kts" (those are gusts)
  const windKnotsMatch = markdown.match(/(?:^|\n)(\d+)\s*kts?\b/m);
  const windKmhMatch = markdown.match(/(?:^|\n)(\d+)\s*km\/?h\b/m);
  const windMs = markdown.match(/(?:^|\n)(\d+(?:\.\d+)?)\s*m\/s\b/m);

  if (windKnotsMatch) {
    conditions.wind.speed = Math.round(parseInt(windKnotsMatch[1]) * 1.852);
  } else if (windKmhMatch) {
    conditions.wind.speed = parseInt(windKmhMatch[1]);
  } else if (windMs) {
    conditions.wind.speed = Math.round(parseFloat(windMs[1]) * 3.6);
  }

  if (conditions.wind.speed !== null) {
    logger.debug(`[WindFinder] Wind speed: ${conditions.wind.speed} km/h`);
  }

  // Wind gusts — WindFinder format: "max 9 kts"
  const gustsKnotsMatch = markdown.match(/max\s+(\d+)\s*kts?\b/i);
  const gustsKmhMatch = markdown.match(/max\s+(\d+)\s*km\/?h\b/i);
  const gustsMs = markdown.match(/max\s+(\d+(?:\.\d+)?)\s*m\/s\b/i);

  if (gustsKnotsMatch) {
    conditions.wind.gusts = Math.round(parseInt(gustsKnotsMatch[1]) * 1.852);
  } else if (gustsKmhMatch) {
    conditions.wind.gusts = parseInt(gustsKmhMatch[1]);
  } else if (gustsMs) {
    conditions.wind.gusts = Math.round(parseFloat(gustsMs[1]) * 3.6);
  }

  if (conditions.wind.gusts !== null) {
    logger.debug(`[WindFinder] Wind gusts: ${conditions.wind.gusts} km/h`);
  }

  // Wind direction — WindFinder format: "17° NNO\n7 kts"
  // Handles English (N,NE,E,SE,S,SW,W,NW) and German (N,NO,O,SO,S,SW,W,NW) abbreviations
  const germanToEnglish = { 'O': 'E', 'NO': 'NE', 'NNO': 'NNE', 'ONO': 'ENE', 'SO': 'SE', 'SSO': 'SSE', 'OSO': 'ESE', 'WSW': 'WSW', 'WNW': 'WNW', 'NNW': 'NNW', 'SSW': 'SSW' };
  const windDirMatch = markdown.match(/\d+°\s+(N|NNO|NO|ONO|O|OSO|SO|SSO|S|SSW|SW|WSW|W|WNW|NW|NNW|NE|ENE|ESE|SE|SSE|NNE)\b/);
  if (windDirMatch) {
    const raw = windDirMatch[1].toUpperCase();
    conditions.wind.direction = germanToEnglish[raw] || raw;
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

  // Wave height — WindFinder format: "343° NNW\n0.4 m" (direction line followed by height)
  const waveHeightMatch = markdown.match(/(?:\d+°\s+\w+\n)([\d.]+)\s*m\b/m)
    || markdown.match(/\b([\d.]+)\s*m\b(?!\s*\/)/m);
  if (waveHeightMatch) {
    const avg = parseFloat(waveHeightMatch[1]);
    if (avg > 0.05 && avg < 15) {
      conditions.waves.height = {
        min: Math.round(avg * 0.85 * 10) / 10,
        max: Math.round(avg * 1.15 * 10) / 10,
        avg: Math.round(avg * 10) / 10
      };
      logger.debug(`[WindFinder] Wave height: ${avg}m`);
    }
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
  registerCoords,
  SPOT_URLS
};
