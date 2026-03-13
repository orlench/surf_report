#!/usr/bin/env node
/**
 * Generate sitemap.xml from the default spots list + fetch user spots from API.
 * Run during build: node scripts/generate-sitemap.js
 */
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = 'https://shouldigo.surf';
const API_URL = process.env.REACT_APP_API_URL || 'https://api.shouldigo.surf/api';
const OUTPUT = path.join(__dirname, '..', 'public', 'sitemap.xml');

// Load hardcoded spots from backend
const defaultSpots = require('../../backend/data/defaultSpots.json');

async function fetchUserSpots() {
  try {
    const res = await fetch(`${API_URL}/spots`);
    if (!res.ok) return [];
    const data = await res.json();
    // API returns { spots: [...] } — extract IDs not already in defaults
    const defaultIds = new Set(defaultSpots.map(s => s.id));
    return (data.spots || []).filter(s => !defaultIds.has(s.id));
  } catch {
    console.log('Could not fetch user spots from API, using defaults only');
    return [];
  }
}

async function main() {
  const userSpots = await fetchUserSpots();
  const allSpots = [...defaultSpots, ...userSpots];
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

  for (const spot of allSpots) {
    xml += `
  <url>
    <loc>${FRONTEND_URL}/spot/${encodeURIComponent(spot.id)}</loc>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
  </url>`;
  }

  xml += '\n</urlset>\n';

  fs.writeFileSync(OUTPUT, xml);
  console.log(`Sitemap generated: ${allSpots.length} spots → ${OUTPUT}`);
}

main();
