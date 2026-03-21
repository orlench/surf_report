#!/usr/bin/env node

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { loadFullManifest } = require('../src/sourcing/manifest');
const { saveSpotBundle } = require('../src/sourcing/bundle');
const { ALL_SOURCES } = require('../src/sourcing/runner');

function main() {
  const manifest = loadFullManifest();

  for (const spot of manifest) {
    saveSpotBundle(spot, ALL_SOURCES);
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    spotCount: manifest.length,
    sources: ALL_SOURCES,
  }, null, 2));
}

main();
