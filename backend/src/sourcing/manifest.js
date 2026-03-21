const fs = require('fs');
const path = require('path');
const { slugify, normalizeText, geoDistanceKm } = require('./utils');

const PILOT_SPOT_IDS = [
  'pipeline',
  'waimea_bay',
  'ocean_beach_sf',
  'mavericks',
  'rincon',
  'malibu_surfrider',
  'nazare',
  'peniche_supertubos',
  'mundaka',
  'hossegor',
  'fistral_beach',
  'bells_beach',
  'snapper_rocks',
  'uluwatu',
  'padang_padang',
  'jeffreys_bay',
  'puerto_escondido',
  'playa_hermosa',
  'cloudbreak',
  'siargao_cloud_9',
  'arugam_bay',
  'herzliya_marina',
  'ashkelon',
  'haifa_dado',
];

const SEARCH_ALIASES = {
  ocean_beach_sf: ['Ocean Beach San Francisco', 'Ocean Beach SF'],
  jeffreys_bay: ['Jeffreys Bay', 'J-Bay', 'J Bay'],
  peniche_supertubos: ['Peniche Supertubos', 'Supertubos'],
  siargao_cloud_9: ['Siargao Cloud 9', 'Cloud 9 Siargao', 'Cloud 9'],
  haifa_dado: ['Haifa Dado Beach', 'Haifa Dado'],
  arugam_bay: ['Arugam Bay', 'Aragum Bay'],
  nazare: ['Nazare', 'Nazare Praia do Norte', 'Nazaré'],
  padang_padang: ['Padang Padang', 'Padang-Padang'],
  playa_hermosa: ['Playa Hermosa Costa Rica', 'Playa Hermosa'],
};

function loadPilotManifest() {
  const defaultSpots = loadDefaultSpots();
  const byId = new Map(defaultSpots.map((spot) => [spot.id, spot]));

  return PILOT_SPOT_IDS.map((spotId) => {
    const spot = byId.get(spotId);
    if (!spot) {
      throw new Error(`Pilot spot missing from defaultSpots.json: ${spotId}`);
    }
    return withAliases({
      ...spot,
      region: spot.region || '',
      country: spot.country || '',
    });
  });
}

function loadFullManifest() {
  const defaultSpots = loadDefaultSpots();
  const fullSpots = loadFullSpots();
  const normalizedDefaultSpots = defaultSpots.map((spot) => ({
    ...spot,
    region: spot.region || '',
    country: spot.country || '',
    aliases: SEARCH_ALIASES[spot.id] || [spot.name],
  }));

  const defaultMatchesByKey = new Map();
  for (const spot of normalizedDefaultSpots) {
    const key = normalizedSpotKey(spot.name, spot.region, spot.country);
    const items = defaultMatchesByKey.get(key) || [];
    items.push(spot);
    defaultMatchesByKey.set(key, items);
  }

  const records = fullSpots.map((spot, index) => {
    const normalizedSpot = {
      ...spot,
      name: String(spot.name || '').trim(),
      region: String(spot.region || '').trim(),
      country: String(spot.country || '').trim(),
      lat: Number(spot.lat),
      lon: Number(spot.lon),
      originalIndex: index,
    };

    const matchingDefault = findMatchingDefaultSpot(normalizedDefaultSpots, defaultMatchesByKey, normalizedSpot);
    if (matchingDefault) {
      return withAliases({
        ...normalizedSpot,
        id: matchingDefault.id,
      });
    }

    return withAliases({
      ...normalizedSpot,
      id: null,
    });
  });

  assignGeneratedIds(records);
  return records;
}

function loadDefaultSpots() {
  const filePath = path.join(__dirname, '../../data/defaultSpots.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadFullSpots() {
  const filePath = path.join(__dirname, '../../data/surfSpots.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(data) ? data : data.spots;
}

function withAliases(spot) {
  return {
    ...spot,
    aliases: SEARCH_ALIASES[spot.id] || [spot.name],
  };
}

function normalizedSpotKey(name, region, country) {
  return [
    normalizeText(name),
    normalizeText(region),
    normalizeText(country),
  ].join('|');
}

function findMatchingDefaultSpot(defaultSpots, defaultMatchesByKey, spot) {
  const key = normalizedSpotKey(spot.name, spot.region, spot.country);
  const direct = defaultMatchesByKey.get(key) || [];

  const candidates = direct.length > 0
    ? direct
    : defaultSpots.filter((candidate) => {
      if (normalizeText(candidate.name) !== normalizeText(spot.name)) return false;
      if (spot.country && candidate.country && normalizeText(candidate.country) !== normalizeText(spot.country)) return false;
      return geoDistanceKm(candidate.lat, candidate.lon, spot.lat, spot.lon) <= 5;
    });

  return candidates.find((candidate) => geoDistanceKm(candidate.lat, candidate.lon, spot.lat, spot.lon) <= 5) || null;
}

function assignGeneratedIds(records) {
  const counts = new Map();

  for (const record of records) {
    if (record.id) continue;
    const base = slugify([record.name, record.region, record.country].filter(Boolean).join(' '), '_')
      || `spot_${record.originalIndex + 1}`;
    counts.set(base, (counts.get(base) || 0) + 1);
  }

  const emitted = new Map();
  for (const record of records) {
    if (record.id) continue;

    const base = slugify([record.name, record.region, record.country].filter(Boolean).join(' '), '_')
      || `spot_${record.originalIndex + 1}`;
    const total = counts.get(base) || 1;
    const next = (emitted.get(base) || 0) + 1;
    emitted.set(base, next);

    if (total === 1) {
      record.id = base;
      continue;
    }

    const latToken = String(record.lat).replace(/[^0-9-]+/g, '_');
    const lonToken = String(record.lon).replace(/[^0-9-]+/g, '_');
    record.id = `${base}_${latToken}_${lonToken}`;
  }
}

module.exports = {
  PILOT_SPOT_IDS,
  SEARCH_ALIASES,
  loadPilotManifest,
  loadFullManifest,
};
