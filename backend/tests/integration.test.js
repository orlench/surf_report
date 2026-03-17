const mockSpots = [
  {
    id: 'pipeline',
    name: 'Pipeline',
    country: 'United States',
    location: { lat: 21.664, lon: -158.051 },
    description: 'North Shore reef break'
  },
  {
    id: 'teahupoo',
    name: 'Teahupoo',
    country: 'French Polynesia',
    location: { lat: -17.833, lon: -149.267 },
    description: 'Heavy reef break'
  }
];

const mockDynamicSpots = new Map();
let mockLatestReport = null;
let mockSubscriptions = [];

jest.mock('../src/utils/dataPath', () => {
  const os = require('os');
  const path = require('path');
  const mockBasePath = path.join(os.tmpdir(), 'surf-report-tests');

  return {
    resolve: jest.fn((name) => path.join(mockBasePath, name))
  };
});

function mockGetSpotById(id) {
  return mockSpots.find((spot) => spot.id === id) || mockDynamicSpots.get(id) || null;
}

function mockBuildConditions() {
  return {
    waves: {
      height: { min: 1.2, max: 1.8, avg: 1.5 },
      swell: { period: 14 }
    },
    wind: {
      speed: 12,
      direction: 'NE'
    },
    weather: {
      waterTemp: 23,
      temperature: 27
    }
  };
}

jest.mock('../src/config/spots', () => ({
  SPOTS: {},
  getAllSpots: jest.fn(() => [...mockSpots, ...mockDynamicSpots.values()]),
  getSpotById: jest.fn((id) => mockGetSpotById(id)),
  getSpotName: jest.fn((id) => mockGetSpotById(id)?.name || id),
  isValidSpot: jest.fn((id) => Boolean(mockGetSpotById(id))),
  getOrCreateSpot: jest.fn((id, data) => {
    const existing = mockGetSpotById(id);
    if (existing) return existing;
    const created = {
      id,
      name: data.name,
      country: data.country || '',
      location: { lat: data.lat, lon: data.lon },
      description: 'User-discovered spot'
    };
    mockDynamicSpots.set(id, created);
    return created;
  }),
  loadPersistedSpots: jest.fn()
}));

jest.mock('../src/services/scraper', () => ({
  fetchSurfData: jest.fn(async (spotId, onProgress) => {
    onProgress?.({ source: 'mock', status: 'success' });
    return [{ source: 'mock', timestamp: '2026-03-17T10:00:00.000Z', url: `https://example.com/${spotId}` }];
  }),
  fetchSurfDataByCoords: jest.fn(async (lat, lon, spotId) => ([
    { source: 'mock', timestamp: '2026-03-17T10:00:00.000Z', url: `https://example.com/${spotId}?lat=${lat}&lon=${lon}` }
  ])),
  aggregateData: jest.fn(() => mockBuildConditions()),
  aggregateHourlyData: jest.fn(() => [{ hour: '10:00', score: 72 }])
}));

jest.mock('../src/services/scoring', () => ({
  WEIGHTS: {
    waveHeight: 0.3,
    wavePeriod: 0.2,
    swellQuality: 0.2,
    windSpeed: 0.1,
    windDirection: 0.1,
    waveDirection: 0.1
  },
  calculateSurfScore: jest.fn(() => ({
    overall: 72,
    rating: 'GOOD',
    explanation: 'Clean surf with enough size.'
  }))
}));

jest.mock('../src/services/trend', () => ({
  generateTrend: jest.fn(() => ({
    direction: 'improving',
    bestWindow: 'Late morning',
    message: 'Conditions improve through the day.'
  }))
}));

jest.mock('../src/services/boardRecommendation', () => ({
  recommendBoard: jest.fn(() => ({
    boardName: 'Shortboard',
    boardType: 'shortboard'
  })),
  recommendBoardPersonalized: jest.fn(() => ({
    boardName: 'Step-up',
    boardType: 'step-up',
    volume: { recommended: '31-33L' }
  }))
}));

jest.mock('../src/services/analyticsClient', () => ({
  getDashboard: jest.fn(async () => ({
    overview: { sessions: 321 },
    sources: [],
    pages: []
  })),
  getDailyTrend: jest.fn(async () => ({
    rows: [{ date: '2026-03-16', sessions: 100 }]
  })),
  getErrors: jest.fn(async () => ({
    rows: [{ eventName: 'js_error', eventCount: '2' }]
  })),
  getOverview: jest.fn(async () => ({
    totals: { sessions: '123' }
  })),
  getTrafficSources: jest.fn(async () => ({
    rows: [{ sessionSource: 'google', sessionMedium: 'organic', sessions: '15' }]
  })),
  getTopPages: jest.fn(async () => ({
    rows: [{ pagePath: '/', screenPageViews: '20' }]
  }))
}));

jest.mock('../src/services/searchConsole', () => ({
  getIndexingStatus: jest.fn(async () => ({
    sitemaps: [{ path: '/sitemap.xml', submitted: 10, indexed: 10 }]
  })),
  getSearchAnalytics: jest.fn(async ({ dimension }) => ({
    dimension,
    rows: [{ keys: ['pipeline'], clicks: 5, impressions: 20 }]
  })),
  inspectUrl: jest.fn(async (url) => ({
    url,
    verdict: 'PASS'
  }))
}));

jest.mock('../src/services/dailyReport', () => ({
  generateReport: jest.fn(async () => mockLatestReport),
  getLatestReport: jest.fn(() => mockLatestReport),
  runAndEmail: jest.fn(async () => {
    mockLatestReport = {
      date: '2026-03-17',
      ga4: { yesterday: { sessions: '123' } },
      alerts: []
    };
    return mockLatestReport;
  }),
  startDailyReportScheduler: jest.fn(),
  stopDailyReportScheduler: jest.fn()
}));

jest.mock('../src/services/llm', () => ({
  interpretFeedback: jest.fn(async () => ({
    waveHeight: 1.1,
    wavePeriod: 1.05,
    swellQuality: 1.0,
    windSpeed: 0.95,
    windDirection: 1.0,
    waveDirection: 1.0
  }))
}));

jest.mock('../src/services/pushSubscriptions', () => ({
  upsertSubscription: jest.fn((subscription, spotId, threshold) => {
    const existingIndex = mockSubscriptions.findIndex(
      (entry) => entry.endpoint === subscription.endpoint && entry.spotId === spotId
    );
    const record = {
      id: `${subscription.endpoint}:${spotId}`,
      endpoint: subscription.endpoint,
      spotId,
      threshold
    };
    if (existingIndex >= 0) {
      mockSubscriptions[existingIndex] = record;
    } else {
      mockSubscriptions.push(record);
    }
    return {
      id: record.id,
      count: mockSubscriptions.filter((entry) => entry.endpoint === subscription.endpoint).length
    };
  }),
  removeSubscription: jest.fn((endpoint, spotId) => {
    const before = mockSubscriptions.length;
    mockSubscriptions = mockSubscriptions.filter((entry) => !(entry.endpoint === endpoint && entry.spotId === spotId));
    return mockSubscriptions.length < before;
  }),
  getSubscriptionsByEndpoint: jest.fn((endpoint) => (
    mockSubscriptions.filter((entry) => entry.endpoint === endpoint)
  ))
}));

jest.mock('geoip-lite', () => ({
  lookup: jest.fn(() => ({
    ll: [21.664, -158.051],
    city: 'Haleiwa',
    country: 'US'
  }))
}));

jest.mock('../src/services/instagram/tokenManager', () => ({
  isConfigured: jest.fn(() => false),
  startTokenRefresh: jest.fn(),
  getToken: jest.fn(() => null),
  getTokenExpiry: jest.fn(() => null),
  GRAPH_API_BASE: 'https://graph.example.com'
}));

jest.mock('../src/services/instagram/campaignManager', () => ({
  setup: jest.fn(),
  createAd: jest.fn(),
  activateCampaign: jest.fn(),
  pauseCampaign: jest.fn(),
  resumeCampaign: jest.fn(),
  getCampaignStatus: jest.fn(async () => ({
    campaign: { status: 'ACTIVE' },
    insights: { cpc: '0.25' }
  }))
}));

jest.mock('../src/services/instagram/creativeUploader', () => ({
  uploadImage: jest.fn(),
  createCreative: jest.fn(),
  generateLocationAdContent: jest.fn(() => ({
    primaryTexts: [],
    headlines: [],
    descriptions: []
  }))
}));

jest.mock('../src/services/instagram/scheduler', () => ({
  refreshCreatives: jest.fn(),
  startMarketingScheduler: jest.fn()
}));

jest.mock('../src/services/pushNotifier', () => ({
  startNotificationScheduler: jest.fn()
}));

describe('Surf Report API', () => {
  let server;
  let apiBase;
  let cache;

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return { status: response.status, body, headers: response.headers };
  }

  beforeAll(async () => {
    jest.resetModules();
    process.env.ADMIN_SECRET = 'test-admin-secret';
    process.env.NODE_ENV = 'test';
    delete process.env.VAPID_PUBLIC_KEY;

    ({ flush: cache } = require('../src/services/cache'));
    const { createApp } = require('../src/server');
    const app = createApp();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        apiBase = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    const fs = require('fs');
    const { resolve } = require('../src/utils/dataPath');
    mockLatestReport = null;
    mockSubscriptions = [];
    mockDynamicSpots.clear();
    fs.rmSync(resolve('spotFeedback.json'), { force: true });
    fs.rmSync(resolve('userSpots.json'), { force: true });
    cache();
    jest.clearAllMocks();
  });

  describe('Core API', () => {
    test('GET / serves a CSP that allows the web API and map assets', async () => {
      const { status, headers } = await api('/');
      const csp = headers.get('content-security-policy') || '';
      expect(status).toBe(200);
      expect(csp).toContain("connect-src");
      expect(csp).toContain('https://api.shouldigo.surf');
      expect(csp).toContain('https://tiles.openfreemap.org');
    });

    test('GET /api returns API info', async () => {
      const { status, body } = await api('/api');
      expect(status).toBe(200);
      expect(body).toHaveProperty('name', 'Surf Report API');
      expect(body).toHaveProperty('endpoints.spots', '/api/spots');
    });

    test('GET /api/health returns ok', async () => {
      const { status, body } = await api('/api/health');
      expect(status).toBe(200);
      expect(body.status).toBe('healthy');
    });

    test('GET /api/spots returns spot list', async () => {
      const { status, body } = await api('/api/spots');
      expect(status).toBe(200);
      expect(Array.isArray(body.spots)).toBe(true);
      expect(body.spots[0]).toHaveProperty('id', 'pipeline');
      expect(body.spots[0]).toHaveProperty('name', 'Pipeline');
    });

    test('GET /api/spots/:spotId returns a valid spot', async () => {
      const { status, body } = await api('/api/spots/pipeline');
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.spot).toHaveProperty('id', 'pipeline');
    });

    test('GET /api/spots/:spotId returns 404 for unknown spot', async () => {
      const { status, body } = await api('/api/spots/unknown_spot');
      expect(status).toBe(404);
      expect(body.success).toBe(false);
    });
  });

  describe('Conditions', () => {
    test('GET /api/conditions/:spotId returns conditions for a valid spot', async () => {
      const { status, body } = await api('/api/conditions/pipeline');
      expect(status).toBe(200);
      expect(body).toHaveProperty('spotId', 'pipeline');
      expect(body).toHaveProperty('score.overall', 72);
      expect(body).toHaveProperty('boardRecommendation.boardName', 'Shortboard');
    });

    test('GET /api/conditions returns all spots overview', async () => {
      const { status, body } = await api('/api/conditions');
      expect(status).toBe(200);
      expect(Array.isArray(body.spots)).toBe(true);
      expect(body.spots.length).toBeGreaterThan(0);
      expect(body).toHaveProperty('timestamp');
    });

    test('GET /api/conditions/:spotId rejects invalid weight', async () => {
      const { status, body } = await api('/api/conditions/pipeline?weight=999');
      expect(status).toBe(400);
      expect(body.error).toMatch(/weight/i);
    });

    test('GET /api/conditions/:spotId rejects invalid skill', async () => {
      const { status, body } = await api('/api/conditions/pipeline?skill=ninja');
      expect(status).toBe(400);
      expect(body.error).toMatch(/skill/i);
    });

    test('GET /api/conditions/:spotId with valid weight and skill returns personalized board data', async () => {
      const { status, body } = await api('/api/conditions/pipeline?weight=75&skill=advanced');
      expect(status).toBe(200);
      expect(body.boardRecommendation.volume).toHaveProperty('recommended', '31-33L');
    });

    test('GET /api/conditions/custom applies personalized board data for custom spots', async () => {
      const { status, body } = await api('/api/conditions/custom?lat=32.1&lon=34.7&name=Hilton%20Beach&weight=75&skill=advanced');
      expect(status).toBe(200);
      expect(body).toHaveProperty('spotId', 'hilton_beach');
      expect(body.boardRecommendation.volume).toHaveProperty('recommended', '31-33L');
    });
  });

  describe('Agent API', () => {
    test('GET /api/agent/schema returns JSON Schema', async () => {
      const { status, body } = await api('/api/agent/schema');
      expect(status).toBe(200);
      expect(body).toHaveProperty('$schema');
      expect(body.properties).toHaveProperty('score');
    });

    test('GET /api/agent/:spotId returns agent-formatted conditions', async () => {
      const { status, body } = await api('/api/agent/pipeline');
      expect(status).toBe(200);
      expect(body.spot).toHaveProperty('id', 'pipeline');
      expect(body).toHaveProperty('score', 72);
      expect(body).toHaveProperty('verdict', 'Yes, go surfing.');
    });

    test('GET /api/agent/nearest returns the nearest spot conditions', async () => {
      const { status, body } = await api('/api/agent/nearest');
      expect(status).toBe(200);
      expect(body.spot).toHaveProperty('id', 'pipeline');
    });
  });

  describe('Geolocation', () => {
    test('GET /api/nearest-spot returns nearest spot data', async () => {
      const { status, body } = await api('/api/nearest-spot');
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('nearestSpot', 'pipeline');
      expect(Array.isArray(body.nearbySpots)).toBe(true);
    });

    test('GET /api/nearest-spot with coords uses the provided coordinates', async () => {
      const { status, body } = await api('/api/nearest-spot?lat=21.665&lon=-158.053');
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.detected).toBe(true);
      expect(body).toHaveProperty('nearestSpot', 'pipeline');
    });
  });

  describe('Feedback', () => {
    test('POST /api/spots/:spotId/feedback accepts valid feedback', async () => {
      const { status, body } = await api('/api/spots/pipeline/feedback', {
        method: 'POST',
        body: JSON.stringify({ text: 'This spot likes long period swell and hates hard onshore wind.' })
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.feedbackCount).toBe(1);
      expect(body.yourMultipliers).toHaveProperty('waveHeight');
    });

    test('GET /api/spots/:spotId/feedback returns feedback data', async () => {
      const { status, body } = await api('/api/spots/pipeline/feedback');
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('feedbackCount');
      expect(Array.isArray(body.recentFeedback)).toBe(true);
    });
  });

  describe('Marketing', () => {
    test('admin endpoints reject requests without secret', async () => {
      const { status, body } = await api('/api/marketing/analytics');
      expect(status).toBe(401);
      expect(body.error).toMatch(/Unauthorized/i);
    });

    test('admin endpoints reject requests with wrong secret', async () => {
      const { status, body } = await api('/api/marketing/analytics', {
        headers: { 'x-admin-secret': 'wrong-secret' }
      });
      expect(status).toBe(401);
      expect(body.error).toMatch(/Unauthorized/i);
    });

    test('GET /api/marketing/analytics returns overview data', async () => {
      const { status, body } = await api('/api/marketing/analytics', {
        headers: { 'x-admin-secret': process.env.ADMIN_SECRET }
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('overview.sessions', 321);
    });

    test('GET /api/marketing/search-console/indexing returns sitemap data', async () => {
      const { status, body } = await api('/api/marketing/search-console/indexing', {
        headers: { 'x-admin-secret': process.env.ADMIN_SECRET }
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.sitemaps)).toBe(true);
    });

    test('POST /api/marketing/daily-report/generate creates a report', async () => {
      const { status, body } = await api('/api/marketing/daily-report/generate', {
        method: 'POST',
        headers: { 'x-admin-secret': process.env.ADMIN_SECRET }
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('date', '2026-03-17');
    });

    test('GET /api/marketing/daily-report returns the cached report', async () => {
      await api('/api/marketing/daily-report/generate', {
        method: 'POST',
        headers: { 'x-admin-secret': process.env.ADMIN_SECRET }
      });
      const { status, body } = await api('/api/marketing/daily-report', {
        headers: { 'x-admin-secret': process.env.ADMIN_SECRET }
      });
      expect(status).toBe(200);
      expect(body).toHaveProperty('date', '2026-03-17');
    });
  });

  describe('Push Notifications', () => {
    test('GET /api/push/vapid-public-key returns 500 when not configured', async () => {
      const { status, body } = await api('/api/push/vapid-public-key');
      expect(status).toBe(500);
      expect(body.success).toBe(false);
    });

    test('POST /api/push/subscribe rejects invalid subscription', async () => {
      const { status, body } = await api('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: {}, spotId: 'pipeline', threshold: 65 })
      });
      expect(status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('unknown endpoints return JSON 404', async () => {
      const { status, body } = await api('/api/nonexistent');
      expect(status).toBe(404);
      expect(body.error).toMatch(/not found/i);
    });
  });
});
