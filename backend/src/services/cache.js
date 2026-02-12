const NodeCache = require('node-cache');
const logger = require('../utils/logger');

/**
 * Cache service for storing scraped surf data
 * Uses node-cache for in-memory caching
 */

// Create cache instance with 10-minute default TTL
const cache = new NodeCache({
  stdTTL: 600, // 10 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Don't clone data (better performance)
});

/**
 * Get data from cache
 */
function get(key) {
  const value = cache.get(key);
  if (value) {
    logger.debug(`[Cache] HIT: ${key}`);
  } else {
    logger.debug(`[Cache] MISS: ${key}`);
  }
  return value;
}

/**
 * Set data in cache
 */
function set(key, value, ttl = null) {
  const success = ttl ? cache.set(key, value, ttl) : cache.set(key, value);
  if (success) {
    logger.debug(`[Cache] SET: ${key} (TTL: ${ttl || cache.options.stdTTL}s)`);
  }
  return success;
}

/**
 * Delete data from cache
 */
function del(key) {
  const count = cache.del(key);
  if (count > 0) {
    logger.debug(`[Cache] DEL: ${key}`);
  }
  return count;
}

/**
 * Flush all cache
 */
function flush() {
  cache.flushAll();
  logger.info(`[Cache] FLUSH: All cache cleared`);
}

/**
 * Get cache age for a key (in seconds)
 */
function getAge(key) {
  const ttl = cache.getTtl(key);
  if (!ttl) return null;

  const now = Date.now();
  const maxAge = cache.options.stdTTL * 1000;
  return Math.floor((now - (ttl - maxAge)) / 1000);
}

/**
 * Get cache statistics
 */
function getStats() {
  return cache.getStats();
}

/**
 * Check if key exists in cache
 */
function has(key) {
  return cache.has(key);
}

module.exports = {
  get,
  set,
  del,
  flush,
  getAge,
  getStats,
  has
};
