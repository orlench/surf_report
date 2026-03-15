const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { getAllSpots } = require('../config/spots');
const cache = require('../services/cache');
const logger = require('../utils/logger');

const FRONTEND_URL = 'https://shouldigo.surf';

/**
 * GET /openapi.yaml
 * Serve the OpenAPI 3.0 spec
 */
router.get('/openapi.yaml', (req, res) => {
  const specPath = path.join(__dirname, '..', '..', 'public', 'openapi.yaml');
  res.set('Content-Type', 'text/yaml');
  res.set('Access-Control-Allow-Origin', '*');
  res.sendFile(specPath);
});

/**
 * GET /sitemap.xml
 * Dynamic sitemap including all spots (hardcoded + user-created)
 */
router.get('/sitemap.xml', (req, res) => {
  const cached = cache.get('sitemap');
  if (cached) {
    res.set('Content-Type', 'application/xml');
    return res.send(cached);
  }

  const spots = getAllSpots();
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${FRONTEND_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${FRONTEND_URL}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

  for (const spot of spots) {
    xml += `
  <url>
    <loc>${FRONTEND_URL}/spot/${encodeURIComponent(spot.id)}</loc>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
  </url>`;
  }

  xml += '\n</urlset>';

  // Cache for 1 hour
  cache.set('sitemap', xml, 3600);

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

/**
 * GET /og/:spotId
 * Serve HTML page with dynamic OG meta tags for link previews.
 * Crawlers/bots get rich meta tags; the page redirects real users to the SPA.
 */
router.get('/og/:spotId', async (req, res) => {
  const { spotId } = req.params;
  const spots = getAllSpots();
  const spot = spots.find(s => s.id === spotId);

  if (!spot) {
    return res.redirect(`${FRONTEND_URL}/?spot=${encodeURIComponent(spotId)}`);
  }

  // Try to get cached conditions for richer meta tags
  const cached = cache.get(`conditions:${spotId}`);
  let title, description;

  if (cached && cached.score) {
    const score = cached.score.overall || 0;
    const rating = cached.score.rating || 'N/A';
    const waves = cached.conditions?.waves?.height;
    const wind = cached.conditions?.wind;

    title = `${spot.name} — ${score}/100 ${rating} | Should I Go?`;

    const parts = [];
    if (waves?.min != null && waves?.max != null) {
      parts.push(`Waves: ${waves.min.toFixed(1)}–${waves.max.toFixed(1)}m`);
    } else if (waves?.avg != null) {
      parts.push(`Waves: ${waves.avg.toFixed(1)}m`);
    }
    if (wind?.speed != null) {
      let w = `Wind: ${Math.round(wind.speed)} km/h`;
      if (wind.direction) w += ` ${wind.direction}`;
      parts.push(w);
    }
    description = parts.length > 0
      ? `${spot.name} surf report: ${parts.join(' | ')}. Score: ${score}/100 (${rating}).`
      : `${spot.name} surf conditions: ${score}/100 (${rating}). Check wave height, wind, swell & more.`;
  } else {
    title = `${spot.name} Surf Report | Should I Go?`;
    description = `Real-time surf conditions for ${spot.name}, ${spot.country || ''}. Check wave height, wind, swell period, and water temp.`.trim();
  }

  const url = `${FRONTEND_URL}/spot/${encodeURIComponent(spotId)}`;
  const image = `${FRONTEND_URL}/logo512.png`;

  // HTML with OG tags — serves as the indexable page for social crawlers
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Should I Go?" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${image}" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "${FRONTEND_URL}/" },
      { "@type": "ListItem", "position": 2, "name": "${escapeHtml(spot.name)}", "item": "${escapeHtml(url)}" }
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "name": "${escapeHtml(spot.name)} Surf Spot",
    "description": "${escapeHtml(description)}",
    "url": "${escapeHtml(url)}",
    "sport": "Surfing"${spot.location ? `,
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": ${spot.location.lat},
      "longitude": ${spot.location.lon}
    }` : ''}
  }
  </script>
  <link rel="canonical" href="${escapeHtml(url)}" />
</head>
<body>
  <h1>${escapeHtml(spot.name)} Surf Report</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeHtml(url)}">View live conditions for ${escapeHtml(spot.name)}</a></p>
  <script>window.location.replace("${escapeHtml(url)}");</script>
</body>
</html>`;

  res.set('Content-Type', 'text/html');
  res.send(html);
});

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = router;
