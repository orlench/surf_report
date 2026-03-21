const fs = require('fs');
const path = require('path');
const { resolve } = require('../utils/dataPath');

function baseDir() {
  return resolve('spotMetadata');
}

function filePath(...parts) {
  return path.join(baseDir(), ...parts);
}

function statePath(name) {
  return filePath('state', name);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(absPath, fallback = null) {
  if (!fs.existsSync(absPath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(absPath, data) {
  ensureDir(path.dirname(absPath));
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2));
}

function loadBucket(kind, source) {
  return readJson(filePath(kind, `${source}.json`), { source, updatedAt: null, spots: {} });
}

function saveBucket(kind, source, bucket) {
  writeJson(filePath(kind, `${source}.json`), {
    ...bucket,
    updatedAt: new Date().toISOString(),
  });
}

function rawPath(source, spotId) {
  return filePath('raw', source, `${spotId}.json`);
}

function parsedPath(source, spotId) {
  return filePath('parsed', source, `${spotId}.json`);
}

function bundlePath(spotId) {
  return filePath('bundles', `${spotId}.json`);
}

function loadRaw(source, spotId) {
  return readJson(rawPath(source, spotId), null);
}

function saveRaw(source, spotId, data) {
  writeJson(rawPath(source, spotId), data);
}

function loadParsed(source, spotId) {
  return readJson(parsedPath(source, spotId), null);
}

function saveParsed(source, spotId, data) {
  writeJson(parsedPath(source, spotId), data);
}

function saveManifest(name, data) {
  writeJson(filePath('manifests', name), data);
}

function saveReport(name, data) {
  writeJson(filePath('reports', name), data);
}

function loadReport(name, fallback = null) {
  return readJson(filePath('reports', name), fallback);
}

function loadState(name, fallback = null) {
  return readJson(statePath(name), fallback);
}

function saveState(name, data) {
  writeJson(statePath(name), data);
}

function loadBundle(spotId) {
  return readJson(bundlePath(spotId), null);
}

function saveBundle(spotId, data) {
  writeJson(bundlePath(spotId), data);
}

module.exports = {
  baseDir,
  filePath,
  bundlePath,
  loadBucket,
  saveBucket,
  loadRaw,
  saveRaw,
  loadParsed,
  saveParsed,
  saveManifest,
  loadReport,
  saveReport,
  loadState,
  saveState,
  loadBundle,
  saveBundle,
};
