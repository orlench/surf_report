function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value, separator = '_') {
  return normalizeText(value).replace(/\s+/g, separator);
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function sha256(value) {
  return require('crypto').createHash('sha256').update(String(value || '')).digest('hex');
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function tokenCoverage(phrase, haystack) {
  const tokens = tokenize(phrase);
  if (tokens.length === 0) return 0;
  const matched = tokens.filter((token) => haystack.includes(token)).length;
  return matched / tokens.length;
}

const COUNTRY_ALIASES = {
  USA: ['usa', 'united states', 'hawaii', 'california'],
  UK: ['uk', 'united kingdom', 'england', 'britain', 'great britain', 'cornwall'],
  Portugal: ['portugal'],
  Spain: ['spain', 'basque'],
  France: ['france'],
  Australia: ['australia'],
  Indonesia: ['indonesia', 'bali'],
  'South Africa': ['south africa', 'south african'],
  Mexico: ['mexico', 'oaxaca'],
  'Costa Rica': ['costa rica'],
  Fiji: ['fiji'],
  Philippines: ['philippines', 'siargao'],
  'Sri Lanka': ['sri lanka'],
  Israel: ['israel'],
};

const COUNTRY_CODES = {
  USA: 'us',
  UK: 'gb',
  Portugal: 'pt',
  Spain: 'es',
  France: 'fr',
  Australia: 'au',
  Indonesia: 'id',
  'South Africa': 'za',
  Mexico: 'mx',
  'Costa Rica': 'cr',
  Fiji: 'fj',
  Philippines: 'ph',
  'Sri Lanka': 'lk',
  Israel: 'il',
};

function matchesCountry(haystack, country) {
  if (!country) return true;
  const aliases = COUNTRY_ALIASES[country] || [normalizeText(country)];
  return aliases.some((alias) => normalizeText(haystack).includes(normalizeText(alias)));
}

function matchesRegion(haystack, region) {
  if (!region) return false;
  return normalizeText(haystack).includes(normalizeText(region));
}

function countryCode(country) {
  return COUNTRY_CODES[country] || undefined;
}

function geoDistanceKm(aLat, aLon, bLat, bLon) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function extractCoordinatesFromText(text) {
  const value = String(text || '');
  const directional = [
    /lat(?:itude)?\s*long(?:itude)?[:\s]*\(?\s*([0-9]+(?:\.[0-9]+)?)\s*[°º]?\s*([NS])\s+([0-9]+(?:\.[0-9]+)?)\s*[°º]?\s*([EW])/i,
    /([0-9]+(?:\.[0-9]+)?)\s*[°º]?\s*([NS])\s+([0-9]+(?:\.[0-9]+)?)\s*[°º]?\s*([EW])/i,
  ];

  for (const pattern of directional) {
    const match = value.match(pattern);
    if (!match) continue;
    let lat = parseFloat(match[1]);
    let lon = parseFloat(match[3]);
    if (match[2].toUpperCase() === 'S') lat *= -1;
    if (match[4].toUpperCase() === 'W') lon *= -1;
    return { lat, lon };
  }

  const explicit = value.match(/gps[^0-9-+]*([-+]?\d{1,2}\.\d+)[,\s/]+([-+]?\d{1,3}\.\d+)/i);
  if (explicit) {
    return { lat: parseFloat(explicit[1]), lon: parseFloat(explicit[2]) };
  }

  return null;
}

function extractSentence(text, matcher) {
  const sentences = String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/);
  return sentences.find((sentence) => matcher(sentence)) || null;
}

module.exports = {
  normalizeText,
  slugify,
  tokenize,
  tokenCoverage,
  uniqueBy,
  sha256,
  firstLine,
  matchesCountry,
  matchesRegion,
  countryCode,
  geoDistanceKm,
  extractCoordinatesFromText,
  extractSentence,
};
