const axios = require('axios');
const FormData = require('form-data');
const logger = require('../../utils/logger');
const { getToken, GRAPH_API_BASE } = require('./tokenManager');

// Only allow image downloads from trusted domains
const ALLOWED_IMAGE_HOSTS = ['shouldigo.surf', 'www.shouldigo.surf'];

/**
 * Upload an image to the Meta Ad Account's image library
 * Downloads the image first, then uploads as multipart form data
 * @param {string} imageUrl - Public URL of the image (must be from allowed domains)
 * @returns {string|null} Image hash for use in creatives
 */
async function uploadImage(imageUrl) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const token = getToken();
  if (!adAccountId || !token) return null;

  try {
    // Validate URL against allowlist to prevent SSRF
    const parsed = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || !ALLOWED_IMAGE_HOSTS.includes(parsed.hostname)) {
      logger.error(`[Marketing] Image upload blocked — untrusted host: ${parsed.hostname}`);
      return null;
    }

    // Download image first
    const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
    const filename = imageUrl.split('/').pop() || 'image.png';

    // Upload as multipart form
    const form = new FormData();
    form.append('filename', Buffer.from(imgResponse.data), { filename });
    form.append('access_token', token);

    const { data } = await axios.post(
      `${GRAPH_API_BASE}/act_${adAccountId}/adimages`,
      form,
      { headers: form.getHeaders() }
    );

    const images = data.images;
    const firstKey = Object.keys(images)[0];
    const hash = images[firstKey]?.hash;
    logger.info(`[Marketing] Uploaded image — hash: ${hash}`);
    return hash;
  } catch (err) {
    logger.error(`[Marketing] Image upload failed: ${err.response?.data?.error?.message || err.message}`);
    return null;
  }
}

/**
 * Create an Advantage+ ad creative with multiple text variations
 * and AI-powered enhancements enabled
 *
 * @param {Object} opts
 * @param {string[]} opts.imageHashes - Array of uploaded image hashes
 * @param {string[]} opts.primaryTexts - Array of primary text variations
 * @param {string} opts.headline - Ad headline
 * @param {string} opts.linkUrl - Destination URL
 * @returns {string|null} Creative ID
 */
async function createCreative({ imageHashes, primaryTexts, headline, linkUrl }) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const pageId = process.env.META_PAGE_ID;
  const igAccountId = process.env.META_IG_ACCOUNT_ID;
  const token = getToken();

  if (!adAccountId || !pageId || !token) {
    logger.error('[Marketing] Missing META_AD_ACCOUNT_ID, META_PAGE_ID, or access token');
    return null;
  }

  try {
    // Build asset feed with multiple images and text variations
    const bodies = primaryTexts.map(text => ({ text }));
    const images = imageHashes.map(hash => ({ hash }));
    const titles = [{ text: headline || 'Should I Go Surf?' }];
    const descriptions = [{ text: 'Real-time surf conditions for any beach' }];
    const linkUrls = [{ website_url: linkUrl }];
    const callToActions = [{ type: 'LEARN_MORE' }];

    const assetFeedSpec = {
      bodies,
      images,
      titles,
      descriptions,
      link_urls: linkUrls,
      call_to_action_types_field: callToActions,
      ad_formats: ['SINGLE_IMAGE']
    };

    // Enable Advantage+ creative AI enhancements
    const degreesOfFreedomSpec = {
      creative_features_spec: {
        standard_enhancements: { enroll_status: 'OPT_IN' }
      }
    };

    const objectStorySpec = {
      page_id: pageId,
      ...(igAccountId && { instagram_actor_id: igAccountId })
    };

    const { data } = await axios.post(
      `${GRAPH_API_BASE}/act_${adAccountId}/adcreatives`,
      {
        name: `SIG Creative ${new Date().toISOString().slice(0, 10)}`,
        asset_feed_spec: JSON.stringify(assetFeedSpec),
        degrees_of_freedom_spec: JSON.stringify(degreesOfFreedomSpec),
        object_story_spec: JSON.stringify(objectStorySpec),
        access_token: token
      }
    );

    logger.info(`[Marketing] Created creative — ID: ${data.id}`);
    return data.id;
  } catch (err) {
    logger.error(`[Marketing] Creative creation failed: ${err.response?.data?.error?.message || err.message}`);
    return null;
  }
}

/**
 * Generate ad content from live surf conditions
 * @param {Object} conditionsData - Conditions response from our API
 * @param {string} spotName - Human-readable spot name
 * @returns {Object} { primaryTexts, headline }
 */
function generateAdContent(conditionsData, spotName) {
  const score = conditionsData?.score?.overall || 0;
  const rating = conditionsData?.score?.rating || 'Unknown';
  const waveHeight = conditionsData?.conditions?.waves?.height;
  const wavePeriod = conditionsData?.conditions?.waves?.period;
  const windSpeed = conditionsData?.conditions?.wind?.speed;

  const waveStr = waveHeight ? `${waveHeight}m waves` : 'waves';
  const periodStr = wavePeriod ? ` @ ${wavePeriod}s` : '';
  const windStr = windSpeed ? `, ${windSpeed}km/h wind` : '';

  const primaryTexts = [
    `${spotName} is scoring ${score}/100 right now. ${waveStr}${periodStr}${windStr}. Should you go? Check it out.`,
    `Real-time surf score: ${score}/100 (${rating}). ${waveStr}${periodStr}. Get conditions for any beach instantly.`,
    `Should you go surf today? ${spotName}: ${score}/100. Know before you go.`
  ];

  const headline = score >= 70
    ? `${spotName}: ${rating}! ${score}/100`
    : `Check Surf Conditions Now`;

  return { primaryTexts, headline };
}

module.exports = { uploadImage, createCreative, generateAdContent };
