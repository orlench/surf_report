const axios = require('axios');
const logger = require('../../utils/logger');

const GRAPH_API_BASE = 'https://graph.facebook.com/v22.0';

// In-memory token store (refreshed on startup + periodically)
let currentToken = process.env.META_ACCESS_TOKEN || null;
let tokenExpiresAt = null;

/**
 * Exchange a short-lived or long-lived token for a new long-lived token.
 * Long-lived tokens last ~60 days.
 */
async function refreshToken() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret || !currentToken) {
    logger.warn('[Marketing] Missing META_APP_ID, META_APP_SECRET, or META_ACCESS_TOKEN — token refresh skipped');
    return;
  }

  try {
    const { data } = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: currentToken
      }
    });

    currentToken = data.access_token;
    // Long-lived tokens expire in ~60 days (5184000 seconds)
    const expiresIn = data.expires_in || 5184000;
    tokenExpiresAt = Date.now() + expiresIn * 1000;

    const daysLeft = Math.round(expiresIn / 86400);
    logger.info(`[Marketing] Token refreshed — expires in ${daysLeft} days`);
  } catch (err) {
    logger.error(`[Marketing] Token refresh failed: ${err.response?.data?.error?.message || err.message}`);
  }
}

/**
 * Get the current valid access token
 */
function getToken() {
  return currentToken;
}

/**
 * Check if token is configured
 */
function isConfigured() {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET && currentToken);
}

/**
 * Start periodic token refresh (every 50 days)
 */
function startTokenRefresh() {
  if (!isConfigured()) {
    logger.info('[Marketing] Meta credentials not configured — token refresh disabled');
    return;
  }

  // Refresh on startup (after 10 second delay)
  setTimeout(() => refreshToken(), 10000);

  // Then refresh every 50 days
  const FIFTY_DAYS_MS = 50 * 24 * 60 * 60 * 1000;
  setInterval(() => refreshToken(), FIFTY_DAYS_MS);
}

module.exports = { getToken, isConfigured, refreshToken, startTokenRefresh, GRAPH_API_BASE };
