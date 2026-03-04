const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../../data/discoveredUrls.json');

let cache = {};

try {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
} catch (_) {}

function get(service, spotId) {
  return cache[service]?.[spotId] || null;
}

function set(service, spotId, url) {
  if (!cache[service]) cache[service] = {};
  cache[service][spotId] = url;
  fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), () => {});
}

module.exports = { get, set };
