const logger = require('./logger');

const warnedFallbacks = new Set();

function decodeServiceAccount(encoded, envName) {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch (err) {
    throw new Error(`${envName} is not valid base64-encoded JSON`);
  }
}

function loadServiceAccount(primaryEnv, options = {}) {
  const fallbackEnv = options.fallbackEnv || null;
  const required = options.required !== false;

  const primaryValue = process.env[primaryEnv];
  if (primaryValue) {
    return decodeServiceAccount(primaryValue, primaryEnv);
  }

  if (fallbackEnv && process.env[fallbackEnv]) {
    const warningKey = `${primaryEnv}:${fallbackEnv}`;
    if (!warnedFallbacks.has(warningKey)) {
      warnedFallbacks.add(warningKey);
      logger.warn(`[GoogleAuth] ${primaryEnv} not set — falling back to ${fallbackEnv}`);
    }
    return decodeServiceAccount(process.env[fallbackEnv], fallbackEnv);
  }

  if (!required) return null;

  if (fallbackEnv) {
    throw new Error(`${primaryEnv} or ${fallbackEnv} not set`);
  }

  throw new Error(`${primaryEnv} not set`);
}

module.exports = { loadServiceAccount };
