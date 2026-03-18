const axios = require('axios');
const logger = require('../../utils/logger');
const { ensureFreshToken, GRAPH_API_BASE, META_AD_ACCOUNT_ID } = require('./tokenManager');

// Active campaign IDs — hardcoded after creation, overridable via env
let campaignId = process.env.META_CAMPAIGN_ID || '120242229788240189';
let adSetId = process.env.META_ADSET_ID || '120242229793340189';

/**
 * Create an Advantage+ traffic campaign (one-time setup)
 */
async function createCampaign() {
  const token = await ensureFreshToken();
  if (!token) throw new Error('Missing access token');

  const { data } = await axios.post(
    `${GRAPH_API_BASE}/act_${META_AD_ACCOUNT_ID}/campaigns`,
    {
      name: 'Should I Go Surf — Instagram Traffic',
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: JSON.stringify([]),
      buying_type: 'AUCTION',
      is_adset_budget_sharing_enabled: false,
      access_token: token
    }
  );

  campaignId = data.id;
  logger.info(`[Marketing] Created campaign — ID: ${campaignId}`);
  return campaignId;
}

/**
 * Create an ad set targeting surfers on Instagram
 */
async function createAdSet() {
  if (!campaignId) throw new Error('Campaign must be created first');

  const token = await ensureFreshToken();
  const dailyBudget = process.env.META_AD_DAILY_BUDGET || '500'; // cents ($5/day)

  // Broad targeting across surf countries — let Meta's Advantage+ optimize delivery
  const targeting = {
    age_min: 18,
    age_max: 65,
    geo_locations: {
      location_types: ['home'],
      countries: ['US', 'AU', 'GB', 'PT', 'ES', 'FR', 'ID', 'ZA', 'BR', 'MX', 'JP', 'NZ', 'CR', 'MA']
    }
  };

  const params = {
    name: 'SIG Surfers — All Placements',
    campaign_id: campaignId,
    daily_budget: dailyBudget,
    destination_type: 'WEBSITE',
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LINK_CLICKS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: JSON.stringify(targeting),
    is_dynamic_creative: true,
    dsa_beneficiary: 'Should I Go Surf',
    dsa_payor: 'Should I Go Surf',
    status: 'PAUSED',
    access_token: token
  };

  const { data } = await axios.post(
    `${GRAPH_API_BASE}/act_${META_AD_ACCOUNT_ID}/adsets`,
    params
  );

  adSetId = data.id;
  logger.info(`[Marketing] Created ad set — ID: ${adSetId}`);
  return adSetId;
}

/**
 * Create an ad linking a creative to the ad set
 * @param {string} creativeId - ID from creativeUploader.createCreative()
 */
async function createAd(creativeId) {
  if (!adSetId) throw new Error('Ad set must be created first');

  const token = await ensureFreshToken();

  const { data } = await axios.post(
    `${GRAPH_API_BASE}/act_${META_AD_ACCOUNT_ID}/ads`,
    {
      name: `SIG Ad ${new Date().toISOString().slice(0, 10)}`,
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: creativeId }),
      status: 'ACTIVE',
      access_token: token
    }
  );

  logger.info(`[Marketing] Created ad — ID: ${data.id}`);
  return data.id;
}

/**
 * Activate campaign and ad set (called after first ad is created)
 */
async function activateCampaign() {
  const token = await ensureFreshToken();
  if (!campaignId || !adSetId) return;

  await Promise.all([
    axios.post(`${GRAPH_API_BASE}/${campaignId}`, { status: 'ACTIVE', access_token: token }),
    axios.post(`${GRAPH_API_BASE}/${adSetId}`, { status: 'ACTIVE', access_token: token })
  ]);

  logger.info('[Marketing] Campaign and ad set activated');
}

/**
 * Pause the campaign
 */
async function pauseCampaign() {
  const token = await ensureFreshToken();
  if (!campaignId) throw new Error('No campaign to pause');

  await axios.post(`${GRAPH_API_BASE}/${campaignId}`, { status: 'PAUSED', access_token: token });
  logger.info('[Marketing] Campaign paused');
}

/**
 * Resume the campaign
 */
async function resumeCampaign() {
  const token = await ensureFreshToken();
  if (!campaignId) throw new Error('No campaign to resume');

  await axios.post(`${GRAPH_API_BASE}/${campaignId}`, { status: 'ACTIVE', access_token: token });
  logger.info('[Marketing] Campaign resumed');
}

/**
 * Get campaign status and insights
 */
async function getCampaignStatus() {
  const token = await ensureFreshToken();

  const result = { account: null, campaign: null, adSet: null, insights: null, deliveryEstimate: null };

  try {
    const { data } = await axios.get(`${GRAPH_API_BASE}/act_${META_AD_ACCOUNT_ID}`, {
      params: {
        fields: 'currency,amount_spent,account_status,disable_reason,balance,spend_cap',
        access_token: token
      }
    });
    result.account = data;
  } catch (e) {
    result.account = null;
  }

  if (campaignId) {
    const { data } = await axios.get(`${GRAPH_API_BASE}/${campaignId}`, {
      params: { fields: 'name,status,daily_budget,lifetime_budget', access_token: token }
    });
    result.campaign = data;
  }

  if (adSetId) {
    const { data } = await axios.get(`${GRAPH_API_BASE}/${adSetId}`, {
      params: { fields: 'name,status,daily_budget,destination_type', access_token: token }
    });
    result.adSet = data;
  }

  // Get spend/performance insights for last 7 days
  if (campaignId) {
    try {
      const { data } = await axios.get(`${GRAPH_API_BASE}/${campaignId}/insights`, {
        params: {
          fields: 'spend,impressions,clicks,cpc,ctr,reach',
          date_preset: 'last_7d',
          access_token: token
        }
      });
      result.insights = data.data?.[0] || null;
    } catch (e) {
      // Insights may not be available yet
      result.insights = null;
    }
  }

  if (adSetId) {
    try {
      const { data } = await axios.get(`${GRAPH_API_BASE}/${adSetId}/delivery_estimate`, {
        params: {
          optimization_goal: 'LINK_CLICKS',
          access_token: token
        }
      });
      result.deliveryEstimate = data.data?.[0] || null;
    } catch (e) {
      result.deliveryEstimate = null;
    }
  }

  return result;
}

async function pauseOtherAds(keepAdId) {
  if (!adSetId) return [];

  const token = await ensureFreshToken();
  const { data } = await axios.get(`${GRAPH_API_BASE}/${adSetId}/ads`, {
    params: {
      fields: 'id,name,status,effective_status',
      limit: 200,
      access_token: token,
    },
  });

  const ads = data.data || [];
  const pausedIds = [];

  for (const ad of ads) {
    if (!ad?.id || ad.id === keepAdId) continue;

    const effectiveStatus = Array.isArray(ad.effective_status)
      ? ad.effective_status[0]
      : ad.effective_status;

    if (ad.status === 'PAUSED' || effectiveStatus === 'PAUSED') continue;

    await axios.post(`${GRAPH_API_BASE}/${ad.id}`, {
      status: 'PAUSED',
      access_token: token,
    });
    pausedIds.push(ad.id);
  }

  if (pausedIds.length > 0) {
    logger.info(`[Marketing] Paused ${pausedIds.length} older ad(s) after creative refresh`);
  }

  return pausedIds;
}

/**
 * Full setup: create campaign → ad set (one-time)
 */
async function setup() {
  try {
    await createCampaign();
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`Campaign creation failed: ${msg}`);
  }
  try {
    await createAdSet();
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`Ad set creation failed: ${msg}`);
  }
  return { campaignId, adSetId };
}

module.exports = {
  setup,
  createAd,
  activateCampaign,
  pauseOtherAds,
  pauseCampaign,
  resumeCampaign,
  getCampaignStatus,
  getCampaignId: () => campaignId,
  getAdSetId: () => adSetId
};
