/**
 * Integration tests for Should I Go Surf API
 * Tests against the live production API at https://api.shouldigo.surf
 */

const BASE = 'https://api.shouldigo.surf/api';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '60bf53ffd9cce772c92ba0ed79047a1b0e2311f209d0bfc22b329d5c7ae17edf';

function adminHeaders() {
  return { 'x-admin-secret': ADMIN_SECRET };
}

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, 'Content-Type': 'application/json' }
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ─── Core API ───────────────────────────────────────────

describe('Core API', () => {
  test('GET /health returns ok', async () => {
    const { status, body } = await api('/health');
    expect(status).toBe(200);
    expect(body.status).toBe('healthy');
  });

  test('GET /spots returns spot list', async () => {
    const { status, body } = await api('/spots');
    expect(status).toBe(200);
    expect(Array.isArray(body.spots)).toBe(true);
    expect(body.spots.length).toBeGreaterThan(0);
    // Each spot should have id and name
    const spot = body.spots[0];
    expect(spot).toHaveProperty('id');
    expect(spot).toHaveProperty('name');
  });

  test('GET /conditions/:spotId returns conditions for a valid spot', async () => {
    const { status, body } = await api('/conditions/pipeline');
    expect(status).toBe(200);
    // Should have score or be processing
    expect(body).toHaveProperty('score');
  }, 30000);

  test('GET /conditions/:spotId returns error for invalid spot', async () => {
    const { status } = await api('/conditions/nonexistent_spot_xyz');
    // Should still return 200 (it fetches conditions for any location) or 400/404
    expect([200, 400, 404]).toContain(status);
  }, 30000);
});

// ─── Authentication ─────────────────────────────────────

describe('Admin Authentication', () => {
  test('admin endpoints reject requests without secret', async () => {
    const { status, body } = await api('/marketing/analytics');
    expect(status).toBe(401);
    expect(body.error).toMatch(/Unauthorized/i);
  });

  test('admin endpoints reject requests with wrong secret', async () => {
    const { status, body } = await api('/marketing/analytics', {
      headers: { 'x-admin-secret': 'wrong_secret_here' }
    });
    expect(status).toBe(401);
    expect(body.error).toMatch(/Unauthorized/i);
  });

  test('admin endpoints accept valid secret', async () => {
    const { status, body } = await api('/marketing/analytics', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── GA4 Analytics ──────────────────────────────────────

describe('GA4 Analytics', () => {
  test('GET /marketing/analytics returns overview data', async () => {
    const { status, body } = await api('/marketing/analytics', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('overview');
  });

  test('GET /marketing/analytics/trend returns trend data', async () => {
    const { status, body } = await api('/marketing/analytics/trend', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.rows)).toBe(true);
  });

  test('GET /marketing/analytics/errors returns error data', async () => {
    const { status, body } = await api('/marketing/analytics/errors', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Google Search Console ──────────────────────────────

describe('Google Search Console', () => {
  test('GET /marketing/search-console/indexing returns sitemap data', async () => {
    const { status, body } = await api('/marketing/search-console/indexing', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.sitemaps)).toBe(true);
  });

  test('GET /marketing/search-console/queries returns search data', async () => {
    const { status, body } = await api('/marketing/search-console/queries', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  test('GET /marketing/search-console/pages returns page data', async () => {
    const { status, body } = await api('/marketing/search-console/pages', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── Daily Report ───────────────────────────────────────

describe('Daily Report', () => {
  test('POST /marketing/daily-report/generate creates a report', async () => {
    const { status, body } = await api('/marketing/daily-report/generate', {
      method: 'POST',
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('date');
    expect(body).toHaveProperty('ga4');
  }, 30000);

  test('GET /marketing/daily-report returns cached report', async () => {
    const { status, body } = await api('/marketing/daily-report', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body).toHaveProperty('date');
  });
});

// ─── 404 handling ───────────────────────────────────────

describe('Error Handling', () => {
  test('unknown endpoints return 404', async () => {
    const { status, body } = await api('/nonexistent');
    expect(status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });
});

// ─── Spot Details ──────────────────────────────────────

describe('Spot Details', () => {
  test('GET /spots/:spotId returns a valid spot', async () => {
    const { status, body } = await api('/spots/pipeline');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.spot).toHaveProperty('id', 'pipeline');
    expect(body.spot).toHaveProperty('name');
    expect(body.spot).toHaveProperty('location');
  });

  test('GET /spots/:spotId returns 404 for unknown spot', async () => {
    const { status, body } = await api('/spots/nonexistent_spot_xyz');
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  test('GET /spots/:spotId/feedback returns feedback data', async () => {
    const { status, body } = await api('/spots/pipeline/feedback');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('feedbackCount');
    expect(body).toHaveProperty('recentFeedback');
    expect(Array.isArray(body.recentFeedback)).toBe(true);
  });
});

// ─── Geolocation ───────────────────────────────────────

describe('Geolocation', () => {
  test('GET /nearest-spot returns nearest spot data', async () => {
    const { status, body } = await api('/nearest-spot');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('nearestSpot');
    expect(body).toHaveProperty('nearbySpots');
    expect(Array.isArray(body.nearbySpots)).toBe(true);
  });

  test('GET /nearest-spot with coords returns relevant spot', async () => {
    // Coordinates near Pipeline, North Shore Oahu
    const { status, body } = await api('/nearest-spot?lat=21.665&lon=-158.053');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.detected).toBe(true);
    expect(body.nearestSpot).toBeDefined();
    expect(body.nearbySpots.length).toBeGreaterThan(0);
  });
});

// ─── Agent API ─────────────────────────────────────────

describe('Agent API', () => {
  test('GET /agent/schema returns JSON Schema', async () => {
    const { status, body } = await api('/agent/schema');
    expect(status).toBe(200);
    expect(body).toHaveProperty('$schema');
    expect(body).toHaveProperty('properties');
    expect(body.properties).toHaveProperty('score');
    expect(body.properties).toHaveProperty('verdict');
  });

  test('GET /agent/:spotId returns agent-formatted conditions', async () => {
    const { status, body } = await api('/agent/pipeline');
    expect(status).toBe(200);
    expect(body).toHaveProperty('spot');
    expect(body.spot).toHaveProperty('id');
    expect(body.spot).toHaveProperty('name');
    expect(body).toHaveProperty('score');
    expect(body).toHaveProperty('rating');
    expect(body).toHaveProperty('verdict');
    expect(body).toHaveProperty('conditions');
    expect(body).toHaveProperty('links');
    expect(['Yes, go surfing.', 'Maybe, conditions are marginal.', 'No, not worth it today.']).toContain(body.verdict);
  }, 30000);

  test('GET /agent/:spotId returns 404 for unknown spot', async () => {
    const { status, body } = await api('/agent/nonexistent_spot_xyz');
    expect(status).toBe(404);
    expect(body).toHaveProperty('error');
  });

  test('GET /agent/nearest returns conditions for closest spot', async () => {
    const { status, body } = await api('/agent/nearest');
    expect(status).toBe(200);
    expect(body).toHaveProperty('spot');
    expect(body).toHaveProperty('score');
    expect(body).toHaveProperty('verdict');
  }, 30000);
});

// ─── Conditions Edge Cases ─────────────────────────────

describe('Conditions Edge Cases', () => {
  test('GET /conditions returns all spots overview', async () => {
    const { status, body } = await api('/conditions');
    expect(status).toBe(200);
    expect(body).toHaveProperty('spots');
    expect(Array.isArray(body.spots)).toBe(true);
    expect(body.spots.length).toBeGreaterThan(0);
    expect(body).toHaveProperty('timestamp');
  });

  test('GET /conditions/:spotId with valid weight and skill returns personalized data', async () => {
    const { status, body } = await api('/conditions/pipeline?weight=75&skill=advanced');
    expect(status).toBe(200);
    expect(body).toHaveProperty('boardRecommendation');
    if (body.boardRecommendation?.volume) {
      expect(body.boardRecommendation.volume).toHaveProperty('recommended');
    }
  }, 30000);

  test('GET /conditions/:spotId rejects invalid weight', async () => {
    const { status, body } = await api('/conditions/pipeline?weight=999');
    expect(status).toBe(400);
    expect(body.error).toMatch(/weight/i);
  });

  test('GET /conditions/:spotId rejects invalid skill', async () => {
    const { status, body } = await api('/conditions/pipeline?skill=ninja');
    expect(status).toBe(400);
    expect(body.error).toMatch(/skill/i);
  });
});

// ─── Push Notifications ────────────────────────────────

describe('Push Notifications', () => {
  test('GET /push/vapid-public-key returns VAPID key', async () => {
    const { status, body } = await api('/push/vapid-public-key');
    // 200 if configured, 500 if not — both are valid states
    expect([200, 500]).toContain(status);
    if (status === 200) {
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('key');
    }
  });

  test('POST /push/subscribe rejects invalid subscription', async () => {
    const { status, body } = await api('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: {}, spotId: 'pipeline', threshold: 65 })
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  test('POST /push/subscribe rejects invalid threshold', async () => {
    const { status, body } = await api('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        subscription: { endpoint: 'https://test.example.com', keys: { p256dh: 'abc', auth: 'def' } },
        spotId: 'pipeline',
        threshold: 42
      })
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/threshold/i);
  });

  test('POST /push/unsubscribe rejects missing fields', async () => {
    const { status, body } = await api('/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({})
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});

// ─── Input Validation ──────────────────────────────────

describe('Input Validation', () => {
  test('POST /spots rejects missing required fields', async () => {
    const { status, body } = await api('/spots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Spot' })
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/missing/i);
  });

  test('POST /spots rejects invalid latitude', async () => {
    const { status, body } = await api('/spots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad Spot', lat: 999, lon: 0 })
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/latitude/i);
  });

  test('POST /spots rejects invalid longitude', async () => {
    const { status, body } = await api('/spots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad Spot', lat: 0, lon: 999 })
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/longitude/i);
  });

  test('POST /spots/:spotId/feedback rejects short feedback', async () => {
    const { status, body } = await api('/spots/pipeline/feedback', {
      method: 'POST',
      body: JSON.stringify({ text: 'hi' })
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/10 characters/i);
  });

  test('GET /conditions/custom rejects missing params', async () => {
    const { status, body } = await api('/conditions/custom');
    expect(status).toBe(400);
    expect(body.error).toMatch(/missing/i);
  });

  test('GET /conditions/custom rejects invalid coordinates', async () => {
    const { status, body } = await api('/conditions/custom?lat=999&lon=0&name=test');
    expect(status).toBe(400);
    expect(body.error).toMatch(/latitude/i);
  });
});

// ─── SEO Endpoints ─────────────────────────────────────

describe('SEO Endpoints', () => {
  test('GET / returns API info', async () => {
    const res = await fetch('https://api.shouldigo.surf/');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('endpoints');
  });

  test('GET /sitemap.xml returns valid XML', async () => {
    const res = await fetch('https://api.shouldigo.surf/sitemap.xml');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(res.headers.get('content-type')).toMatch(/xml/);
    expect(text).toContain('<urlset');
    expect(text).toContain('shouldigo.surf');
    expect(text).toContain('<loc>');
  });

  test('GET /og/:spotId returns HTML with OG tags', async () => {
    const res = await fetch('https://api.shouldigo.surf/og/pipeline');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(res.headers.get('content-type')).toMatch(/html/);
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
    expect(html).toContain('Pipeline');
  });

  test('GET /og/:spotId redirects for unknown spot', async () => {
    const res = await fetch('https://api.shouldigo.surf/og/nonexistent_xyz', { redirect: 'manual' });
    expect(res.status).toBe(302);
  });
});

// ─── Marketing Edge Cases ──────────────────────────────

describe('Marketing Edge Cases', () => {
  test('GET /marketing/analytics accepts range param', async () => {
    const { status, body } = await api('/marketing/analytics?range=yesterday', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.range).toBe('yesterday');
  });

  test('GET /marketing/search-console/queries accepts days param', async () => {
    const { status, body } = await api('/marketing/search-console/queries?days=28&limit=5', {
      headers: adminHeaders()
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  test('GET /marketing/search-console/inspect requires url param', async () => {
    const { status, body } = await api('/marketing/search-console/inspect', {
      headers: adminHeaders()
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/url/i);
  });
});
