const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { loadServiceAccount } = require('../utils/googleServiceAccount');

const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID || '';

let client = null;

function getClient() {
  if (client) return client;

  if (!GA_PROPERTY_ID) {
    throw new Error('GA_PROPERTY_ID not set');
  }

  const credentials = loadServiceAccount('GA_SERVICE_ACCOUNT', {
    fallbackEnv: 'FIREBASE_SERVICE_ACCOUNT',
  });
  client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId: credentials.project_id,
  });

  return client;
}

/**
 * Run a GA4 report
 */
async function runReport({ dimensions = [], metrics = [], dateRange = 'last7days', limit = 10 }) {
  const analyticsClient = getClient();

  const dateRanges = {
    today: { startDate: 'today', endDate: 'today' },
    yesterday: { startDate: 'yesterday', endDate: 'yesterday' },
    last7days: { startDate: '7daysAgo', endDate: 'today' },
    last28days: { startDate: '28daysAgo', endDate: 'today' },
    last90days: { startDate: '90daysAgo', endDate: 'today' },
  };

  const range = dateRanges[dateRange] || dateRanges.last7days;

  const [response] = await analyticsClient.runReport({
    property: `properties/${GA_PROPERTY_ID}`,
    dateRanges: [range],
    dimensions: dimensions.map(name => ({ name })),
    metrics: metrics.map(name => ({ name })),
    limit,
  });

  return formatResponse(response);
}

function formatResponse(response) {
  if (!response || !response.rows) return { rows: [], totals: null };

  const dimensionHeaders = (response.dimensionHeaders || []).map(h => h.name);
  const metricHeaders = (response.metricHeaders || []).map(h => h.name);

  const rows = response.rows.map(row => {
    const obj = {};
    (row.dimensionValues || []).forEach((val, i) => {
      obj[dimensionHeaders[i]] = val.value;
    });
    (row.metricValues || []).forEach((val, i) => {
      obj[metricHeaders[i]] = val.value;
    });
    return obj;
  });

  let totals = null;
  if (response.totals && response.totals.length > 0) {
    totals = {};
    response.totals[0].metricValues.forEach((val, i) => {
      totals[metricHeaders[i]] = val.value;
    });
  }

  return { rows, totals };
}

/**
 * Get overview: sessions, users, pageviews, avg engagement time
 */
async function getOverview(dateRange = 'last7days') {
  return runReport({
    metrics: ['sessions', 'totalUsers', 'screenPageViews', 'averageSessionDuration', 'bounceRate'],
    dateRange,
  });
}

/**
 * Get traffic sources breakdown
 */
async function getTrafficSources(dateRange = 'last7days') {
  return runReport({
    dimensions: ['sessionSource', 'sessionMedium'],
    metrics: ['sessions', 'totalUsers', 'screenPageViews'],
    dateRange,
    limit: 20,
  });
}

/**
 * Get top pages
 */
async function getTopPages(dateRange = 'last7days') {
  return runReport({
    dimensions: ['pagePath'],
    metrics: ['screenPageViews', 'totalUsers', 'averageSessionDuration'],
    dateRange,
    limit: 20,
  });
}

/**
 * Get UTM campaign performance (for tracking Instagram ads)
 */
async function getCampaignPerformance(dateRange = 'last7days') {
  return runReport({
    dimensions: ['sessionCampaignName', 'sessionSource', 'sessionMedium'],
    metrics: ['sessions', 'totalUsers', 'screenPageViews', 'averageSessionDuration'],
    dateRange,
    limit: 20,
  });
}

/**
 * Get daily trend
 */
async function getDailyTrend(dateRange = 'last28days') {
  return runReport({
    dimensions: ['date'],
    metrics: ['sessions', 'totalUsers', 'screenPageViews'],
    dateRange,
    limit: 90,
  });
}

/**
 * Get device breakdown
 */
async function getDevices(dateRange = 'last7days') {
  return runReport({
    dimensions: ['deviceCategory'],
    metrics: ['sessions', 'totalUsers'],
    dateRange,
  });
}

/**
 * Get country breakdown
 */
async function getCountries(dateRange = 'last7days') {
  return runReport({
    dimensions: ['country'],
    metrics: ['sessions', 'totalUsers'],
    dateRange,
    limit: 20,
  });
}

/**
 * Get JS errors tracked via gtag
 */
async function getErrors(dateRange = 'last7days') {
  const analyticsClient = getClient();

  const dateRanges = {
    today: { startDate: 'today', endDate: 'today' },
    yesterday: { startDate: 'yesterday', endDate: 'yesterday' },
    last7days: { startDate: '7daysAgo', endDate: 'today' },
    last28days: { startDate: '28daysAgo', endDate: 'today' },
    last90days: { startDate: '90daysAgo', endDate: 'today' },
  };

  const range = dateRanges[dateRange] || dateRanges.last7days;

  const [response] = await analyticsClient.runReport({
    property: `properties/${GA_PROPERTY_ID}`,
    dateRanges: [range],
    dimensions: [
      { name: 'customEvent:error_message' },
      { name: 'customEvent:error_source' },
      { name: 'customEvent:error_line' },
      { name: 'deviceCategory' },
      { name: 'browser' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { value: 'js_error' },
      },
    },
    limit: 50,
  });

  return formatResponse(response);
}

/**
 * Full dashboard: all reports combined
 */
async function getDashboard(dateRange = 'last7days') {
  const [overview, sources, topPages, campaigns, devices, countries] = await Promise.all([
    getOverview(dateRange),
    getTrafficSources(dateRange),
    getTopPages(dateRange),
    getCampaignPerformance(dateRange),
    getDevices(dateRange),
    getCountries(dateRange),
  ]);

  return { overview, sources, topPages, campaigns, devices, countries };
}

module.exports = {
  getOverview,
  getTrafficSources,
  getTopPages,
  getCampaignPerformance,
  getDailyTrend,
  getDevices,
  getCountries,
  getErrors,
  getDashboard,
};
