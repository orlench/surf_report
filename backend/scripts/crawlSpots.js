#!/usr/bin/env node
/**
 * Surfline Taxonomy Crawler
 *
 * Crawls the Surfline taxonomy API to build a static database of surf spots.
 * Uses the undocumented public API (no auth required).
 *
 * The taxonomy tree is flat at the continent level — spots, countries, and
 * subregions are all direct children. We use the `liesIn` references on each
 * spot to find its parent geoname node, then extract country from the parent's
 * `enumeratedPath` (e.g. ",Earth,Asia,Japan,Chigasaki" → country = "Japan").
 *
 * Usage: node crawlSpots.js
 * Output: ../../frontend/src/data/surfSpots.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://services.surfline.com/taxonomy';
const OUTPUT_PATH = path.join(__dirname, '../../frontend/src/data/surfSpots.json');
const EARTH_ID = '58f7ed51dadb30820bb38782';
const DELAY_MS = 300;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'SurfReport/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Extract country and region from enumeratedPath.
 * Path format: ",Earth,Continent,Country,Region,SubRegion,..."
 */
function parseEnumeratedPath(enumPath) {
  if (!enumPath) return { country: '', region: '' };
  const parts = enumPath.split(',').filter(Boolean);
  // [0]=Earth, [1]=Continent, [2]=Country, [3]=Region
  return {
    country: parts[2] || '',
    region: parts[3] || ''
  };
}

/**
 * Process a flat continent response into spot objects with country/region.
 * The `contains` array has spots, geonames, and subregions as siblings.
 * We resolve each spot's country via its `liesIn` parent references.
 */
function extractSpotsFromContinent(continentData) {
  const children = continentData.contains || [];
  const spots = [];

  // Build lookup of non-spot nodes by _id (for resolving liesIn)
  const lookup = {};
  children.forEach(c => {
    if (c.type !== 'spot') {
      lookup[c._id] = {
        name: c.name,
        type: c.type,
        enumPath: c.enumeratedPath || ''
      };
    }
  });
  // Include the continent root itself
  lookup[continentData._id] = {
    name: continentData.name,
    type: continentData.type,
    enumPath: continentData.enumeratedPath || ''
  };

  // Process spots
  children.forEach(node => {
    if (node.type !== 'spot') return;

    const coords = node.location?.coordinates;
    if (!coords || coords.length !== 2) return;

    let country = '';
    let region = '';

    // Resolve country/region from liesIn parent nodes
    const parentIds = node.liesIn || [];
    for (const parentId of parentIds) {
      const parent = lookup[parentId];
      if (!parent) continue;

      // Geoname parents have enumeratedPath with country info
      if (parent.enumPath) {
        const parsed = parseEnumeratedPath(parent.enumPath);
        if (parsed.country && !country) country = parsed.country;
        if (parsed.region && !region) region = parsed.region;
      }

      // Subregion parents provide region name
      if (parent.type === 'subregion' && parent.name && !region) {
        region = parent.name;
      }
    }

    spots.push({
      name: node.name || '',
      lat: coords[1],  // GeoJSON is [lon, lat]
      lon: coords[0],
      country,
      region
    });
  });

  return spots;
}

async function crawlContinent(continent) {
  const name = continent.name;
  const id = continent._id;
  console.log(`  Crawling ${name}...`);

  try {
    const data = await fetch(`${BASE_URL}?type=taxonomy&id=${id}`);
    const spots = extractSpotsFromContinent(data);
    console.log(`  ${name}: ${spots.length} spots`);
    return spots;
  } catch (err) {
    console.error(`  Error crawling ${name}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('Surfline Taxonomy Crawler');
  console.log('========================\n');

  // Step 1: Fetch root to get continents
  console.log('Fetching continents...');
  const root = await fetch(`${BASE_URL}?type=taxonomy&id=${EARTH_ID}&maxDepth=0`);
  const continents = (root.contains || []).filter(c => c.hasSpots);
  console.log(`Found ${continents.length} continents with spots: ${continents.map(c => c.name).join(', ')}\n`);

  // Step 2: Crawl each continent
  const allSpots = [];
  for (const continent of continents) {
    await sleep(DELAY_MS);
    const spots = await crawlContinent(continent);
    allSpots.push(...spots);
  }

  // Step 3: Deduplicate by name + coordinates
  const seen = new Set();
  const unique = [];
  for (const spot of allSpots) {
    const key = `${spot.name}|${spot.lat}|${spot.lon}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(spot);
    }
  }

  console.log(`\nTotal: ${allSpots.length} spots, ${unique.length} unique`);

  // Step 4: Sort by country then name
  unique.sort((a, b) => {
    const cmp = (a.country || '').localeCompare(b.country || '');
    return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
  });

  // Step 5: Write output
  const output = {
    generatedAt: new Date().toISOString(),
    count: unique.length,
    spots: unique.map(s => ({
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      country: s.country,
      region: s.region
    }))
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWritten to ${OUTPUT_PATH}`);
  console.log(`File size: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);

  // Stats
  const withCountry = unique.filter(s => s.country).length;
  const withRegion = unique.filter(s => s.region).length;
  console.log(`Spots with country: ${withCountry}/${unique.length}`);
  console.log(`Spots with region: ${withRegion}/${unique.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
