const axios = require('axios');
const logger = require('../../utils/logger');

const PREDIS_API_BASE = 'https://brain.predis.ai/predis_api/v1';

/**
 * Create a post via Predis.ai API
 * Returns post_id(s) — post is generated async, results come via webhook or polling
 *
 * @param {string} text - Topic/prompt for the post (min 20 chars, 3+ words)
 * @param {Object} opts
 * @param {string} opts.mediaType - single_image | carousel | video
 * @param {string} opts.modelVersion - "2" (all types) or "4" (image/carousel only)
 * @param {number} opts.nPosts - Number of posts to generate (1-10)
 * @param {string[]} opts.mediaUrls - Optional custom image/video URLs
 * @returns {Object} { postIds, status, errors }
 */
async function createPost(text, opts = {}) {
  const apiKey = process.env.PREDIS_API_KEY;
  const brandId = process.env.PREDIS_BRAND_ID;

  if (!apiKey || !brandId) {
    throw new Error('Missing PREDIS_API_KEY or PREDIS_BRAND_ID');
  }

  const {
    mediaType = 'single_image',
    modelVersion = '4',
    nPosts = 1,
    mediaUrls = []
  } = opts;

  const formData = {
    brand_id: brandId,
    text,
    media_type: mediaType,
    model_version: modelVersion,
    n_posts: nPosts
  };

  if (mediaUrls.length > 0) {
    formData.media_urls = JSON.stringify(mediaUrls);
  }

  try {
    const { data } = await axios.post(
      `${PREDIS_API_BASE}/create_content/`,
      formData,
      {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000
      }
    );

    const postIds = data.post_ids || [];
    logger.info(`[Predis] Created ${postIds.length} post(s) — IDs: ${postIds.join(', ')}`);

    return {
      postIds,
      status: data.post_status || 'inProgress',
      errors: data.errors || []
    };
  } catch (err) {
    const errMsg = err.response?.data?.errors?.[0]?.detail || err.message;
    logger.error(`[Predis] Create post failed: ${errMsg}`);
    throw new Error(errMsg);
  }
}

/**
 * Get generated posts (poll for completed results)
 * Images are deleted from Predis servers after 1 hour
 *
 * @param {Object} opts
 * @param {string} opts.mediaType - single_image | carousel | video
 * @param {number} opts.page - Page number (default 1)
 * @param {number} opts.items - Items per page (1-20)
 * @returns {Object} { posts: [{ post_id, urls, caption, media_type }], totalPages }
 */
async function getPosts(opts = {}) {
  const apiKey = process.env.PREDIS_API_KEY;
  const brandId = process.env.PREDIS_BRAND_ID;

  if (!apiKey || !brandId) {
    throw new Error('Missing PREDIS_API_KEY or PREDIS_BRAND_ID');
  }

  const { mediaType = 'single_image', page = 1, items = 5 } = opts;

  try {
    const { data } = await axios.get(`${PREDIS_API_BASE}/get_posts/`, {
      params: {
        brand_id: brandId,
        media_type: mediaType,
        page_n: page,
        items_n: items
      },
      headers: { 'Authorization': apiKey },
      timeout: 15000
    });

    return {
      posts: data.posts || [],
      totalPages: data.total_pages || 0,
      errors: data.errors || []
    };
  } catch (err) {
    const errMsg = err.response?.data?.errors?.[0]?.detail || err.message;
    logger.error(`[Predis] Get posts failed: ${errMsg}`);
    throw new Error(errMsg);
  }
}

/**
 * Create a post and poll until it's ready (up to 2 minutes)
 * @param {string} text - Prompt
 * @param {Object} opts - Same as createPost opts
 * @returns {Object|null} { post_id, urls, caption, media_type } or null if timeout
 */
async function createAndWait(text, opts = {}) {
  const { postIds } = await createPost(text, opts);
  if (!postIds.length) return null;

  const targetId = postIds[0];
  const maxAttempts = 12; // 12 * 10s = 2 minutes
  const pollInterval = 10000; // 10 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const { posts } = await getPosts({
      mediaType: opts.mediaType || 'single_image',
      items: 20
    });

    const found = posts.find(p => p.post_id === targetId);
    if (found && found.urls && found.urls.length > 0) {
      logger.info(`[Predis] Post ${targetId} ready — ${found.urls.length} image(s)`);
      return found;
    }
  }

  logger.warn(`[Predis] Post ${targetId} not ready after 2 minutes`);
  return null;
}

/**
 * Check if Predis is configured
 */
function isConfigured() {
  return !!(process.env.PREDIS_API_KEY && process.env.PREDIS_BRAND_ID);
}

/**
 * Build a surf-themed prompt from conditions data
 */
function buildSurfPrompt(spotName, conditionsData) {
  const score = conditionsData?.score?.overall || 0;
  const rating = conditionsData?.score?.rating || 'Unknown';
  const waveHeight = conditionsData?.conditions?.waves?.height;
  const wavePeriod = conditionsData?.conditions?.waves?.period;
  const windSpeed = conditionsData?.conditions?.wind?.speed;

  const waveStr = waveHeight ? `${waveHeight}m waves` : '';
  const periodStr = wavePeriod ? `${wavePeriod}s period` : '';
  const windStr = windSpeed ? `${windSpeed}km/h wind` : '';
  const details = [waveStr, periodStr, windStr].filter(Boolean).join(', ');

  const prompts = [
    `Create an Instagram post for a surf conditions app called "Should I Go Surf?" showing that ${spotName} is currently scoring ${score}/100 (${rating}). ${details}. Use ocean blues and surf vibes. Include the website shouldigo.surf`,
    `Design a surf check Instagram post: ${spotName} conditions right now — score ${score}/100. ${details}. Surf lifestyle aesthetic with clean modern design. App: shouldigo.surf`,
    `Make an eye-catching Instagram post about real-time surf conditions. ${spotName}: ${score}/100 ${rating}. ${details}. Beach vibes, surfer lifestyle. Check conditions at shouldigo.surf`
  ];

  // Rotate based on day of week
  return prompts[new Date().getDay() % prompts.length];
}

module.exports = {
  createPost,
  getPosts,
  createAndWait,
  isConfigured,
  buildSurfPrompt
};
