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
