const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const { getAllSpots } = require('../config/spots');
const logger = require('../utils/logger');

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * GET /api/nearest-spot
 * Detect visitor IP, geolocate, return nearest surf spot.
 */
router.get('/', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress;

  logger.info(`[Geo] Looking up IP: ${ip}`);

  const geo = geoip.lookup(ip);

  if (!geo || !geo.ll) {
    logger.warn(`[Geo] Could not geolocate IP: ${ip}`);
    return res.json({
      success: true,
      detected: false,
      location: null,
      nearestSpot: 'netanya_kontiki',
      nearestSpotName: 'Netanya Kontiki',
    });
  }

  const [userLat, userLon] = geo.ll;
  const city = geo.city || '';
  const country = geo.country || '';

  logger.info(`[Geo] Resolved: ${city}, ${country} (${userLat}, ${userLon})`);

  const spots = getAllSpots();
  let nearest = null;
  let minDist = Infinity;

  for (const spot of spots) {
    const dist = haversine(userLat, userLon, spot.location.lat, spot.location.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = spot;
    }
  }

  res.json({
    success: true,
    detected: true,
    location: { city, country },
    nearestSpot: nearest.id,
    nearestSpotName: nearest.name,
    distance: Math.round(minDist),
  });
});

module.exports = router;
