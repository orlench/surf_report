const { google } = require('googleapis');
const logger = require('../utils/logger');

const SITE_URL = 'sc-domain:shouldigo.surf';

let auth = null;

function getAuth() {
  if (auth) return auth;

  const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountB64) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');

  const credentials = JSON.parse(Buffer.from(serviceAccountB64, 'base64').toString('utf8'));
  auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/webmasters.readonly']
  );
  return auth;
}

/**
 * Get indexing status — pages indexed, not indexed, and reasons
 */
async function getIndexingStatus() {
  const authClient = getAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

  // Use URL Inspection API isn't batch-friendly, so use sitemaps endpoint
  const webmasters = google.webmasters({ version: 'v3', auth: authClient });

  // Get sitemaps info (shows indexed vs submitted counts)
  const { data: sitemaps } = await webmasters.sitemaps.list({ siteUrl: SITE_URL });

  return {
    sitemaps: (sitemaps.sitemap || []).map(s => ({
      path: s.path,
      lastSubmitted: s.lastSubmitted,
      lastDownloaded: s.lastDownloaded,
      isPending: s.isPending,
      warnings: s.warnings,
      errors: s.errors,
      contents: (s.contents || []).map(c => ({
        type: c.type,
        submitted: c.submitted,
        indexed: c.indexed,
      })),
    })),
  };
}

/**
 * Get search analytics — queries, pages, clicks, impressions, CTR, position
 */
async function getSearchAnalytics({ dimension = 'query', days = 7, limit = 20 } = {}) {
  const authClient = getAuth();
  const webmasters = google.webmasters({ version: 'v3', auth: authClient });

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // yesterday
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await webmasters.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      dimensions: [dimension],
      rowLimit: limit,
    },
  });

  return {
    rows: (data.rows || []).map(r => ({
      key: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: (r.ctr * 100).toFixed(2) + '%',
      position: r.position.toFixed(1),
    })),
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };
}

/**
 * Inspect a specific URL's indexing status
 */
async function inspectUrl(url) {
  const authClient = getAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

  const { data } = await searchconsole.urlInspection.index.inspect({
    requestBody: {
      inspectionUrl: url,
      siteUrl: SITE_URL,
    },
  });

  const result = data.inspectionResult?.indexStatusResult || {};
  return {
    url,
    verdict: result.verdict,
    coverageState: result.coverageState,
    robotsTxtState: result.robotsTxtState,
    indexingState: result.indexingState,
    lastCrawlTime: result.lastCrawlTime,
    pageFetchState: result.pageFetchState,
    crawledAs: result.crawledAs,
    referringUrls: result.referringUrls,
  };
}

module.exports = { getIndexingStatus, getSearchAnalytics, inspectUrl };
