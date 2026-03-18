const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const logger = require('../utils/logger');

const oidcClient = new OAuth2Client();
let warnedLegacySecret = false;

function buildError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function getAllowedAdminEmails() {
  const values = [
    process.env.MARKETING_ADMIN_EMAILS,
    process.env.SCHEDULER_SERVICE_ACCOUNT_EMAIL,
  ].filter(Boolean);

  return new Set(
    values
      .flatMap((value) => value.split(','))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function authenticateGoogleToken(token) {
  const allowedEmails = getAllowedAdminEmails();
  if (allowedEmails.size === 0) {
    throw buildError(503, 'MARKETING_ADMIN_EMAILS or SCHEDULER_SERVICE_ACCOUNT_EMAIL not configured');
  }

  const audience = process.env.GOOGLE_OIDC_AUDIENCE || process.env.API_ORIGIN || 'https://api.shouldigo.surf';
  const ticket = await oidcClient.verifyIdToken({
    idToken: token,
    audience,
  });
  const payload = ticket.getPayload() || {};
  const email = (payload.email || '').toLowerCase();

  if (!email || payload.email_verified === false) {
    throw buildError(401, 'Unauthorized');
  }

  if (!allowedEmails.has(email)) {
    throw buildError(403, 'Forbidden');
  }

  return { method: 'google-oidc', email };
}

function authenticateLegacySecret(secret) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    throw buildError(503, 'ADMIN_SECRET not configured');
  }

  const provided = Buffer.from(secret);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) {
    throw buildError(401, 'Unauthorized');
  }

  if (!warnedLegacySecret) {
    warnedLegacySecret = true;
    // Keep backward compatibility, but steer production usage to OIDC.
    logger.warn('[AdminAuth] Using legacy x-admin-secret auth. Prefer Google OIDC bearer tokens in production.');
  }

  return { method: 'legacy-secret' };
}

async function authenticateAdminRequest(req) {
  const authorization = req.headers.authorization;
  if (authorization && authorization.startsWith('Bearer ')) {
    return authenticateGoogleToken(authorization.slice('Bearer '.length).trim());
  }

  const providedSecret = req.headers['x-admin-secret'];
  if (typeof providedSecret === 'string' && providedSecret.trim()) {
    return authenticateLegacySecret(providedSecret);
  }

  if (getAllowedAdminEmails().size > 0 || process.env.GOOGLE_OIDC_AUDIENCE) {
    throw buildError(401, 'Unauthorized');
  }

  if (process.env.ADMIN_SECRET) {
    throw buildError(401, 'Unauthorized');
  }

  throw buildError(503, 'Admin authentication not configured');
}

function requireAdmin(req, res, next) {
  authenticateAdminRequest(req)
    .then((auth) => {
      req.adminAuth = auth;
      next();
    })
    .catch((err) => {
      res.status(err.statusCode || 500).json({ error: err.message || 'Unauthorized' });
    });
}

module.exports = {
  authenticateAdminRequest,
  requireAdmin,
};
