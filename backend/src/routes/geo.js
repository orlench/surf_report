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
 * Detect visitor location, return nearest surf spot.
 * Accepts optional ?lat=X&lon=Y query params for GPS-based detection (mobile apps).
 * Falls back to IP geolocation if lat/lon not provided.
 */
router.get('/', (req, res) => {
  const queryLat = parseFloat(req.query.lat);
  const queryLon = parseFloat(req.query.lon);
  const hasGpsCoords = !isNaN(queryLat) && !isNaN(queryLon);

  let userLat, userLon, city, country;

  if (hasGpsCoords) {
    userLat = queryLat;
    userLon = queryLon;
    city = '';
    country = '';
    logger.info(`[Geo] Using GPS coords: (${userLat}, ${userLon})`);
  } else {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket.remoteAddress;

    logger.info(`[Geo] Looking up IP: ${ip}`);

    const geo = geoip.lookup(ip);

    if (!geo || !geo.ll) {
      logger.warn(`[Geo] Could not geolocate IP: ${ip}`);
      const allSpots = getAllSpots();
      const fallbackNearby = allSpots.slice(0, 6).map(s => ({
        id: s.id,
        name: s.name,
        country: s.country || '',
      }));
      const first = allSpots[0];
      return res.json({
        success: true,
        detected: false,
        location: null,
        nearestSpot: first ? first.id : null,
        nearestSpotName: first ? first.name : null,
        nearbySpots: fallbackNearby,
      });
    }

    [userLat, userLon] = geo.ll;
    city = geo.city || '';
    country = geo.country || '';
  }

  logger.info(`[Geo] Resolved: ${city}, ${country} (${userLat}, ${userLon})`);

  const spots = getAllSpots();
  const withDist = spots.map(spot => ({
    spot,
    distance: haversine(userLat, userLon, spot.location.lat, spot.location.lon),
  }));
  withDist.sort((a, b) => a.distance - b.distance);

  const nearest = withDist[0];
  const nearbySpots = withDist.slice(0, 6).map(s => ({
    id: s.spot.id,
    name: s.spot.name,
    country: s.spot.country || '',
  }));

  res.json({
    success: true,
    detected: true,
    location: { city, country },
    nearestSpot: nearest.spot.id,
    nearestSpotName: nearest.spot.name,
    nearbySpots,
  });
});

module.exports = router;
