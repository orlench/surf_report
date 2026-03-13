const axios = require('axios');
const logger = require('../../utils/logger');
const { getToken, GRAPH_API_BASE } = require('./tokenManager');

// Persistent IDs — created once, reused across restarts
// In production, these should be stored in a DB or env vars after first setup
let campaignId = process.env.META_CAMPAIGN_ID || null;
let adSetId = process.env.META_ADSET_ID || null;

/**
 * Create an Advantage+ traffic campaign (one-time setup)
 */
async function createCampaign() {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const token = getToken();
  if (!adAccountId || !token) throw new Error('Missing META_AD_ACCOUNT_ID or access token');

  const { data } = await axios.post(
    `${GRAPH_API_BASE}/act_${adAccountId}/campaigns`,
    {
      name: 'Should I Go Surf — Instagram Traffic',
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED', // Start paused, activate when ad is ready
      special_ad_categories: '[]',
      buying_type: 'AUCTION',
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

  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const token = getToken();

  const dailyBudget = process.env.META_AD_DAILY_BUDGET || '1000'; // cents

  // Minimal targeting — let Meta's Advantage+ optimize everything
  const targeting = {
    age_min: 18,
    age_max: 65
  };

  const params = {
    name: 'SIG Surfers — All Placements',
    campaign_id: campaignId,
    daily_budget: dailyBudget,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LINK_CLICKS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: JSON.stringify(targeting),
    status: 'PAUSED',
    access_token: token
  };

  const { data } = await axios.post(
    `${GRAPH_API_BASE}/act_${adAccountId}/adsets`,
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

  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const token = getToken();

  const { data } = await axios.post(
    `${GRAPH_API_BASE}/act_${adAccountId}/ads`,
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
  const token = getToken();
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
  const token = getToken();
  if (!campaignId) throw new Error('No campaign to pause');

  await axios.post(`${GRAPH_API_BASE}/${campaignId}`, { status: 'PAUSED', access_token: token });
  logger.info('[Marketing] Campaign paused');
}

/**
 * Resume the campaign
 */
async function resumeCampaign() {
  const token = getToken();
  if (!campaignId) throw new Error('No campaign to resume');

  await axios.post(`${GRAPH_API_BASE}/${campaignId}`, { status: 'ACTIVE', access_token: token });
  logger.info('[Marketing] Campaign resumed');
}

/**
 * Get campaign status and insights
 */
async function getCampaignStatus() {
  const token = getToken();

  const result = { campaign: null, adSet: null, insights: null };

  if (campaignId) {
    const { data } = await axios.get(`${GRAPH_API_BASE}/${campaignId}`, {
      params: { fields: 'name,status,daily_budget,lifetime_budget', access_token: token }
    });
    result.campaign = data;
  }

  if (adSetId) {
    const { data } = await axios.get(`${GRAPH_API_BASE}/${adSetId}`, {
      params: { fields: 'name,status,daily_budget', access_token: token }
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

  return result;
}

/**
 * Full setup: create campaign → ad set (one-time)
 */
async function setup() {
  await createCampaign();
  await createAdSet();
  return { campaignId, adSetId };
}

module.exports = {
  setup,
  createAd,
  activateCampaign,
  pauseCampaign,
  resumeCampaign,
  getCampaignStatus,
  getCampaignId: () => campaignId,
  getAdSetId: () => adSetId
};
