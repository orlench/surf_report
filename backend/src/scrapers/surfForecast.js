const brightData = require('../integrations/brightData');
const logger = require('../utils/logger');
const urlCache = require('../utils/urlCache');

/**
 * Scrape surf-forecast.com for Israeli surf spots via Bright Data MCP
 * Provides: wave height, period, wind speed/direction, swell data
 */

const SPOT_URLS = {};
const coordsMap = {};

function registerCoords(spotId, lat, lon, name, country) {
  coordsMap[spotId] = { lat, lon, name, country };
}

async function resolveUrl(spotId) {
  if (SPOT_URLS[spotId]) return SPOT_URLS[spotId];
  const cached = urlCache.get('surfForecast', spotId);
  if (cached) return cached;

  const meta = coordsMap[spotId];
  const query = meta?.name
    ? `site:surf-forecast.com ${meta.name} ${meta.country || ''} surf forecast`
    : `site:surf-forecast.com ${spotId} surf forecast`;

  logger.info(`[Surf-forecast] Searching for URL: ${query}`);
  try {
    const searchResult = await brightData.searchEngine(query);
    const parsed = JSON.parse(searchResult);
    const link = parsed?.organic?.find(r => /surf-forecast\.com\/breaks\//.test(r.link))?.link;
    if (link) {
      const sixDay = link.replace(/\/forecasts\/.*/, '/forecasts/latest/six_day');
      urlCache.set('surfForecast', spotId, sixDay);
      logger.info(`[Surf-forecast] Discovered URL for ${spotId}: ${sixDay}`);
      return sixDay;
    }
  } catch (err) {
    logger.warn(`[Surf-forecast] Search failed for ${spotId}: ${err.message}`);
  }
  return null;
}

async function scrapeSurfForecast(spotId) {
  const url = await resolveUrl(spotId);
  if (!url) {
    logger.warn(`[Surf-forecast] Could not resolve URL for spot: ${spotId}`);
    return null;
  }

  logger.info(`[Surf-forecast] Scraping ${url} via Bright Data`);

  const markdown = await brightData.scrapeAsMarkdown(url);
  return parseSurfForecastMarkdown(markdown);
}

// Valid compass directions used by surf-forecast.com
const DIRS = 'N|NNW|NW|WNW|W|WSW|SW|SSW|S|SSE|SE|ESE|E|ENE|NE|NNE';

// Extract the text of a section between two patterns (regex-based, whitespace-tolerant)
function extractSection(text, startPattern, endPattern) {
  const startRe = new RegExp(startPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s]+'));
  const si = text.search(startRe);
  if (si === -1) return '';
  const endRe = new RegExp(endPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s]+'));
  const tail = text.substring(si);
  const ei = tail.search(endRe);
  return ei === -1 ? tail : tail.substring(0, ei);
}

// Pull all floats from a section, skip values out of range
function extractFloats(text, min, max) {
  return [...text.matchAll(/\b(\d+\.?\d*)\b/g)]
    .map(m => parseFloat(m[1]))
    .filter(v => v >= min && v <= max);
}

// Pull all compass directions from a section
function extractDirs(text) {
  return [...text.matchAll(new RegExp(`\\b(${DIRS})\\b`, 'g'))].map(m => m[1]);
}

function parseSurfForecastMarkdown(markdown) {
  logger.info(`[Surf-forecast] Parsing markdown (${markdown.length} chars)`);

  const conditions = {
    waves: { height: { min: null, max: null, avg: null }, period: null, direction: null, swell: null },
    wind: { speed: null, direction: null, gusts: null },
    weather: { airTemp: null, waterTemp: null, cloudCover: null },
    tide: { current: null, height: null }
  };

  // ── Water temperature ────────────────────────────────────────────────
  // Format: "Today's … sea temperature is** 18.2° C **"
  const waterTempMatch = markdown.match(/sea temperature[^*]*\*\*\s*([\d.]+)°?\s*C/i)
    || markdown.match(/([\d.]+)°?\s*C[\s\S]{0,60}warmer than normal/i);
  if (waterTempMatch) {
    const t = parseFloat(waterTempMatch[1]);
    if (t > 0 && t < 40) {
      conditions.weather.waterTemp = Math.round(t);
      logger.debug(`[Surf-forecast] Water temp: ${conditions.weather.waterTemp}°C`);
    }
  }

  // ── Air temperature ──────────────────────────────────────────────────
  // Format: "max 17°C on Thu" in the Short Range Forecast summary
  const airTempMatch = markdown.match(/max\s+([\d.]+)°C/i);
  if (airTempMatch) {
    const t = parseFloat(airTempMatch[1]);
    if (t > -20 && t < 55) {
      conditions.weather.airTemp = Math.round(t);
      logger.debug(`[Surf-forecast] Air temp: ${conditions.weather.airTemp}°C`);
    }
  }

  // ── Wave height & direction ──────────────────────────────────────────
  // The forecast table has a "Wave Height (m) & direction" section.
  // Each cell is: <float>\n<DIR>  (one per AM/PM/Night slot, 21 total for 7 days)
  // We take the first 3 slots (today: AM, PM, Night) and average them.
  const waveSection = extractSection(markdown, 'Wave Height (m)', 'Period(s)');
  if (waveSection) {
    const heights = extractFloats(waveSection, 0.05, 12);
    const dirs = extractDirs(waveSection);
    if (heights.length > 0) {
      // Average first 3 (today) — or fewer if available
      const todayHeights = heights.slice(0, 3);
      const avg = Math.round(todayHeights.reduce((s, v) => s + v, 0) / todayHeights.length * 10) / 10;
      conditions.waves.height = {
        min: Math.round((avg - 0.1) * 10) / 10,
        max: Math.round((avg + 0.1) * 10) / 10,
        avg
      };
      logger.debug(`[Surf-forecast] Wave height: ${avg}m (from ${todayHeights.length} slots)`);
    }
    if (dirs.length > 0) {
      // Most common direction today
      const todayDirs = dirs.slice(0, 3);
      const freq = {};
      todayDirs.forEach(d => { freq[d] = (freq[d] || 0) + 1; });
      conditions.waves.direction = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      logger.debug(`[Surf-forecast] Wave direction: ${conditions.waves.direction}`);
    }
  }

  // ── Wave period ──────────────────────────────────────────────────────
  // Format: "**5**\n**4**\n**4**..." (bold numbers in Period section)
  const periodSection = extractSection(markdown, 'Period(s)', 'Wave\nGraph') ||
                        extractSection(markdown, 'Period(s)', 'Energy');
  if (periodSection) {
    const periods = [...periodSection.matchAll(/\*\*(\d+)\*\*/g)]
      .map(m => parseInt(m[1]))
      .filter(p => p >= 3 && p <= 30);
    if (periods.length > 0) {
      const todayPeriods = periods.slice(0, 3);
      conditions.waves.period = Math.round(todayPeriods.reduce((s, v) => s + v, 0) / todayPeriods.length);
      logger.debug(`[Surf-forecast] Wave period: ${conditions.waves.period}s`);
    }
  }

  // ── Wind speed & direction ───────────────────────────────────────────
  // Format: "10\nNE\n20\nNW..." or "10NE\n20NW" in Wind (km/h) section
  const windSection = extractSection(markdown, 'Wind\n(km/h)', 'Wind State') ||
                      extractSection(markdown, 'Wind\n(km/h)', 'High Tide');
  if (windSection) {
    const speeds = extractFloats(windSection, 0, 200).filter(Number.isInteger);
    const dirs = extractDirs(windSection);
    if (speeds.length > 0) {
      const todaySpeeds = speeds.slice(0, 3);
      conditions.wind.speed = Math.round(todaySpeeds.reduce((s, v) => s + v, 0) / todaySpeeds.length);
      logger.debug(`[Surf-forecast] Wind speed: ${conditions.wind.speed} km/h`);
    }
    if (dirs.length > 0) {
      const todayDirs = dirs.slice(0, 3);
      const freq = {};
      todayDirs.forEach(d => { freq[d] = (freq[d] || 0) + 1; });
      conditions.wind.direction = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      logger.debug(`[Surf-forecast] Wind direction: ${conditions.wind.direction}`);
    }
  }

  // ── Tide ─────────────────────────────────────────────────────────────
  // Format: "High Tide\n/ height (m)\n10:15AM\n0.37"
  const highTideMatch = markdown.match(/High Tide[\s\S]{0,30}([\d:]+(?:AM|PM))\s*([\d.-]+)/i);
  const lowTideMatch = markdown.match(/Low Tide[\s\S]{0,30}([\d:]+(?:AM|PM))\s*([\d.-]+)/i);
  if (highTideMatch || lowTideMatch) {
    conditions.tide = {
      nextHigh: highTideMatch ? { time: highTideMatch[1], height: parseFloat(highTideMatch[2]) } : null,
      nextLow: lowTideMatch ? { time: lowTideMatch[1], height: parseFloat(lowTideMatch[2]) } : null
    };
    logger.debug(`[Surf-forecast] Tide: high ${conditions.tide?.nextHigh?.time} ${conditions.tide?.nextHigh?.height}m`);
  }

  const hasData = conditions.waves.height.avg !== null || conditions.wind.speed !== null;
  if (!hasData) {
    logger.warn(`[Surf-forecast] Could not extract any data from markdown`);
    return null;
  }

  conditions.hourly = parseSurfForecastHourly(markdown);
  logger.info(`[Surf-forecast] Parsed: waves=${conditions.waves.height.avg}m ${conditions.waves.direction} ${conditions.waves.period}s | wind=${conditions.wind.speed}km/h ${conditions.wind.direction} | water=${conditions.weather.waterTemp}°C | hourly=${conditions.hourly.length}`);
  return conditions;
}

function parseSurfForecastHourly(markdown) {
  const hourly = [];
  try {
    // The forecast table has 21 time slots: AM(8h), PM(14h), Night(20h) × 7 days
    const SLOT_HOURS = [8, 14, 20];

    const waveSection = extractSection(markdown, 'Wave Height (m)', 'Period(s)');
    const periodSection = extractSection(markdown, 'Period(s)', 'Wave\nGraph') ||
                          extractSection(markdown, 'Period(s)', 'Energy');
    const windSection = extractSection(markdown, 'Wind\n(km/h)', 'Wind State') ||
                        extractSection(markdown, 'Wind\n(km/h)', 'High Tide');

    const heights = waveSection ? extractFloats(waveSection, 0.05, 12) : [];
    const waveDirs = waveSection ? extractDirs(waveSection) : [];
    const periods = periodSection
      ? [...periodSection.matchAll(/\*\*(\d+)\*\*/g)].map(m => parseInt(m[1])).filter(p => p >= 3 && p <= 30)
      : [];
    const windSpeeds = windSection ? extractFloats(windSection, 0, 200).filter(Number.isInteger) : [];
    const windDirs = windSection ? extractDirs(windSection) : [];

    const count = Math.min(heights.length, 21);
    const base = new Date();
    base.setMinutes(0, 0, 0);

    for (let i = 0; i < count; i++) {
      const dayOffset = Math.floor(i / 3);
      const slotHour = SLOT_HOURS[i % 3];
      const date = new Date(base);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(slotHour);

      hourly.push({
        time: date.toISOString().substring(0, 16),
        waves: {
          height: { avg: heights[i] ?? null },
          period: periods[i] ?? null,
          direction: waveDirs[i] ?? null
        },
        wind: {
          speed: windSpeeds[i] ?? null,
          direction: windDirs[i] ?? null,
          gusts: null
        }
      });
    }
  } catch (e) {
    logger.debug(`[Surf-forecast] Hourly parsing failed: ${e.message}`);
  }
  return hourly;
}

module.exports = {
  scrapeSurfForecast,
  registerCoords,
  SPOT_URLS
};
