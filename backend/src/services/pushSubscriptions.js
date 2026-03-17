const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { resolve } = require('../utils/dataPath');

const DATA_FILE = resolve('pushSubscriptions.json');

function readAll() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    logger.error(`[Push] Failed to read subscriptions: ${e.message}`);
    return [];
  }
}

function writeAll(subs) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(subs, null, 2));
  } catch (e) {
    logger.error(`[Push] Failed to write subscriptions: ${e.message}`);
  }
}

function makeId(endpoint, spotId) {
  return crypto.createHash('sha256').update(endpoint + spotId).digest('hex').slice(0, 16);
}

/**
 * Upsert a push subscription for a specific spot.
 * Returns { id, count } where count is total subs for this endpoint.
 */
function upsertSubscription(subscription, spotId, threshold) {
  const subs = readAll();
  const id = makeId(subscription.endpoint, spotId);
  const existing = subs.findIndex(s => s.id === id);

  const entry = {
    id,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    spotId,
    threshold,
    createdAt: existing >= 0 ? subs[existing].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastNotifiedAt: existing >= 0 ? subs[existing].lastNotifiedAt : null,
    lastNotifiedBlock: existing >= 0 ? subs[existing].lastNotifiedBlock : null
  };

  if (existing >= 0) {
    subs[existing] = entry;
  } else {
    subs.push(entry);
  }

  writeAll(subs);

  const count = subs.filter(s => s.endpoint === subscription.endpoint).length;
  return { id, count };
}

/**
 * Remove a subscription for a specific spot+endpoint.
 */
function removeSubscription(endpoint, spotId) {
  const subs = readAll();
  const id = makeId(endpoint, spotId);
  const filtered = subs.filter(s => s.id !== id);
  writeAll(filtered);
  return filtered.length < subs.length;
}

/**
 * Get all subscriptions for a given endpoint.
 */
function getSubscriptionsByEndpoint(endpoint) {
  return readAll().filter(s => s.endpoint === endpoint);
}

/**
 * Group subscriptions by spotId for batch processing.
 */
function getSubscriptionsGroupedBySpot() {
  const subs = readAll();
  const grouped = {};
  for (const sub of subs) {
    if (!grouped[sub.spotId]) grouped[sub.spotId] = [];
    grouped[sub.spotId].push(sub);
  }
  return grouped;
}

/**
 * Mark a subscription as notified.
 */
function markNotified(id, blockLabel) {
  const subs = readAll();
  const sub = subs.find(s => s.id === id);
  if (sub) {
    sub.lastNotifiedAt = new Date().toISOString();
    sub.lastNotifiedBlock = blockLabel;
    writeAll(subs);
  }
}

/**
 * Remove a subscription by id (for expired endpoints).
 */
function removeById(id) {
  const subs = readAll();
  const filtered = subs.filter(s => s.id !== id);
  if (filtered.length < subs.length) {
    writeAll(filtered);
    return true;
  }
  return false;
}

module.exports = {
  upsertSubscription,
  removeSubscription,
  getSubscriptionsByEndpoint,
  getSubscriptionsGroupedBySpot,
  markNotified,
  removeById
};
