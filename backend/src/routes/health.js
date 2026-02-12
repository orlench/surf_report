const express = require('express');
const router = express.Router();
const cache = require('../services/cache');
const logger = require('../utils/logger');

/**
 * GET /api/health
 * Health check endpoint - returns server and cache status
 */
router.get('/', (req, res) => {
  logger.debug(`[API] GET /api/health`);

  const cacheStats = cache.getStats();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    cache: {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      keys: cacheStats.keys,
      hitRate: cacheStats.hits + cacheStats.misses > 0
        ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)
        : 0
    }
  });
});

module.exports = router;
