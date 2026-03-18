const axios = require('axios');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const analytics = require('./analyticsClient');
const searchConsole = require('./searchConsole');
const { getCampaignStatus, getCampaignId } = require('./instagram/campaignManager');
const { ensureFreshToken, getTokenExpiry, isConfigured: isMetaConfigured, GRAPH_API_BASE } = require('./instagram/tokenManager');
const dataPath = require('../utils/dataPath');

const cache = new NodeCache({ stdTTL: 48 * 60 * 60 }); // 48h TTL
let intervalHandle = null;
let timeoutHandle = null;

const LATEST_REPORT_FILE = dataPath.resolve('daily-report-latest.json');

function persistReport(report) {
  cache.set('latest', report);
  cache.set(`report_${report.date}`, report);

  fs.mkdirSync(path.dirname(LATEST_REPORT_FILE), { recursive: true });
  fs.writeFileSync(LATEST_REPORT_FILE, JSON.stringify(report, null, 2));
}

function loadPersistedReport() {
  try {
    if (!fs.existsSync(LATEST_REPORT_FILE)) return null;
    return JSON.parse(fs.readFileSync(LATEST_REPORT_FILE, 'utf8'));
  } catch (err) {
    logger.warn(`[DailyReport] Failed to read persisted report: ${err.message}`);
    return null;
  }
}

/**
 * Get Meta Ads spend/impressions breakdown by country (last 7 days)
 */
async function getAdCountryBreakdown() {
  const token = await ensureFreshToken();
  const campaignId = getCampaignId();
  if (!token || !campaignId) return null;

  const { data } = await axios.get(`${GRAPH_API_BASE}/${campaignId}/insights`, {
    params: {
      fields: 'spend,impressions,clicks,reach',
      breakdowns: 'country',
      date_preset: 'last_7d',
      access_token: token
    }
  });
  return data.data || [];
}

async function generateReport() {
  logger.info('[DailyReport] Generating report...');
  const timestamp = new Date().toISOString();

  // Fetch all data in parallel — GA4 always, Meta only if configured
  const promises = [
    analytics.getOverview('yesterday').catch(err => { logger.error(`[DailyReport] GA4 overview (yesterday) failed: ${err.message}`); return null; }),
    analytics.getOverview('last7days').catch(err => { logger.error(`[DailyReport] GA4 overview (7d) failed: ${err.message}`); return null; }),
    analytics.getTrafficSources('yesterday').catch(err => { logger.error(`[DailyReport] GA4 sources failed: ${err.message}`); return null; }),
    analytics.getErrors('yesterday').catch(err => { logger.error(`[DailyReport] GA4 errors failed: ${err.message}`); return null; }),
    analytics.getDailyTrend('last7days').catch(err => { logger.error(`[DailyReport] GA4 trend failed: ${err.message}`); return null; }),
    analytics.getTopPages('yesterday').catch(err => { logger.error(`[DailyReport] GA4 pages failed: ${err.message}`); return null; }),
    analytics.getCampaignPerformance('last7days').catch(err => { logger.error(`[DailyReport] GA4 campaigns failed: ${err.message}`); return null; }),
    searchConsole.getIndexingStatus().catch(err => { logger.error(`[DailyReport] Search Console indexing failed: ${err.message}`); return null; }),
    searchConsole.getSearchAnalytics({ dimension: 'query', days: 7, limit: 10 }).catch(err => { logger.error(`[DailyReport] Search Console queries failed: ${err.message}`); return null; }),
    searchConsole.getSearchAnalytics({ dimension: 'page', days: 7, limit: 10 }).catch(err => { logger.error(`[DailyReport] Search Console pages failed: ${err.message}`); return null; }),
    isMetaConfigured()
      ? getCampaignStatus().catch(err => { logger.error(`[DailyReport] Meta status failed: ${err.message}`); return null; })
      : Promise.resolve(null),
    isMetaConfigured()
      ? getAdCountryBreakdown().catch(err => { logger.error(`[DailyReport] Meta countries failed: ${err.message}`); return null; })
      : Promise.resolve(null),
  ];

  const [yesterday, last7days, sources, errors, trend, pages, campaigns, indexing, searchQueries, searchPages, metaStatus, adCountries] = await Promise.all(promises);

  // Build alerts
  const alerts = [];

  // Meta alerts
  if (isMetaConfigured()) {
    if (metaStatus?.campaign && metaStatus.campaign.status !== 'ACTIVE') {
      alerts.push({ level: 'warning', message: `Campaign is ${metaStatus.campaign.status}` });
    }
    if (metaStatus && !metaStatus.insights) {
      alerts.push({ level: 'warning', message: 'No Meta ad insights available (new campaign or no spend)' });
    }
    if (metaStatus?.insights?.cpc && parseFloat(metaStatus.insights.cpc) > 0.50) {
      alerts.push({ level: 'warning', message: `High CPC: $${parseFloat(metaStatus.insights.cpc).toFixed(2)}` });
    }

    const tokenExpiry = getTokenExpiry();
    if (tokenExpiry) {
      const daysLeft = Math.round((tokenExpiry - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 14) {
        alerts.push({ level: 'critical', message: `Meta token expires in ${daysLeft} days — refresh needed` });
      }
    }
  }

  // GA4 alerts
  if (errors && errors.rows && errors.rows.length > 0) {
    const totalErrors = errors.rows.reduce((sum, r) => sum + parseInt(r.eventCount || 0), 0);
    alerts.push({ level: 'warning', message: `${totalErrors} JS error(s) detected yesterday` });
  }

  if (yesterday?.totals && last7days?.totals) {
    const yesterdaySessions = parseInt(yesterday.totals.sessions || 0);
    const weekSessions = parseInt(last7days.totals.sessions || 0);
    const dailyAvg = weekSessions / 7;
    if (dailyAvg > 0 && yesterdaySessions < dailyAvg * 0.7) {
      alerts.push({ level: 'warning', message: `Sessions dropped: ${yesterdaySessions} yesterday vs ${Math.round(dailyAvg)} daily avg` });
    }
  }

  // Check for paid traffic
  if (sources?.rows) {
    const paidSessions = sources.rows
      .filter(r => r.sessionMedium === 'paid' || r.sessionMedium === 'cpc' || r.sessionSource === 'instagram')
      .reduce((sum, r) => sum + parseInt(r.sessions || 0), 0);
    if (isMetaConfigured() && paidSessions === 0) {
      alerts.push({ level: 'info', message: 'No paid/Instagram traffic yesterday' });
    }
  }

  // Spot distribution alerts
  if (pages?.rows) {
    const spotPages = pages.rows.filter(r => r.pagePath && r.pagePath !== '/' && r.pagePath.startsWith('/spot/'));
    const totalViews = pages.rows.reduce((sum, r) => sum + parseInt(r.screenPageViews || 0), 0);
    const homepageViews = pages.rows.find(r => r.pagePath === '/')?.screenPageViews || 0;
    const homepagePercent = totalViews > 0 ? Math.round((parseInt(homepageViews) / totalViews) * 100) : 0;

    if (homepagePercent > 80) {
      alerts.push({ level: 'warning', message: `${homepagePercent}% of views are homepage only — users may not be loading spots` });
    }
    if (spotPages.length > 0 && spotPages.length <= 2) {
      const spotNames = spotPages.map(r => r.pagePath.replace('/spot/', '')).join(', ');
      alerts.push({ level: 'info', message: `Only ${spotPages.length} spot(s) viewed: ${spotNames} — narrow audience or targeting issue?` });
    }
  }

  // Ad country concentration alert
  if (adCountries && adCountries.length > 0) {
    const totalSpend = adCountries.reduce((sum, r) => sum + parseFloat(r.spend || 0), 0);
    if (totalSpend > 0) {
      const sorted = [...adCountries].sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));
      const topCountrySpend = parseFloat(sorted[0]?.spend || 0);
      const topCountryPct = Math.round((topCountrySpend / totalSpend) * 100);
      if (topCountryPct > 60) {
        alerts.push({ level: 'warning', message: `Ad spend concentrated: ${sorted[0].country} has ${topCountryPct}% of spend — Meta may be chasing cheap clicks` });
      }
    }
  }

  const report = {
    timestamp,
    date: new Date().toISOString().slice(0, 10),
    alerts,
    ga4: {
      yesterday: yesterday?.totals || null,
      last7days: last7days?.totals || null,
      sources: sources?.rows || [],
      pages: pages?.rows || [],
      errors: errors?.rows || [],
      errorCount: errors?.rows?.length || 0,
      trend: trend?.rows || [],
      campaigns: campaigns?.rows || [],
    },
    searchConsole: {
      indexing: indexing?.sitemaps || [],
      queries: searchQueries?.rows || [],
      pages: searchPages?.rows || [],
    },
    meta: metaStatus,
    metaCountries: adCountries,
    emailDelivery: null,
  };

  persistReport(report);

  logger.info(`[DailyReport] Report generated — ${alerts.length} alert(s)`);
  return report;
}

function getLatestReport() {
  return cache.get('latest') || loadPersistedReport() || null;
}

async function runAndEmail(options = {}) {
  const { force = false } = options;
  const today = new Date().toISOString().slice(0, 10);
  const existing = getLatestReport();
  if (!force && existing?.date === today && existing.emailDelivery?.status === 'sent') {
    logger.info('[DailyReport] Returning already-sent report for today');
    return existing;
  }

  const report = await generateReport();
  const { sendDailyReport } = require('./emailSender');
  try {
    report.emailDelivery = await sendDailyReport(report);
    persistReport(report);
    return report;
  } catch (err) {
    report.emailDelivery = {
      status: 'failed',
      provider: 'gmail',
      recipient: process.env.REPORT_EMAIL || null,
      attemptedAt: new Date().toISOString(),
      error: err.message,
    };
    persistReport(report);
    err.statusCode = err.statusCode || 502;
    throw err;
  }
}

function startDailyReportScheduler() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Calculate ms until next 04:00 UTC (7:00 AM Israel)
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(4, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const msUntilNext = next - now;

  const hoursUntil = (msUntilNext / (1000 * 60 * 60)).toFixed(1);
  logger.info(`[DailyReport] Scheduler started — first run in ${hoursUntil}h (04:00 UTC / 07:00 IST)`);

  const safeRun = () => runAndEmail().catch(err => logger.error(`[DailyReport] Scheduled run failed: ${err.message}`));
  timeoutHandle = setTimeout(() => {
    safeRun();
    intervalHandle = setInterval(safeRun, TWENTY_FOUR_HOURS);
  }, msUntilNext);
}

function stopDailyReportScheduler() {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('[DailyReport] Scheduler stopped');
  }
}

module.exports = { generateReport, getLatestReport, runAndEmail, startDailyReportScheduler, stopDailyReportScheduler };
