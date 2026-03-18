const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const analytics = require('./analyticsClient');
const searchConsole = require('./searchConsole');
const dataPath = require('../utils/dataPath');

const cache = new NodeCache({ stdTTL: 48 * 60 * 60 }); // 48h TTL
let intervalHandle = null;
let timeoutHandle = null;
let currentRunPromise = null;

const LATEST_REPORT_FILE = dataPath.resolve('daily-report-latest.json');
const RUN_LOCK_FILE = dataPath.resolve('daily-report-run.lock');
const RUN_LOCK_STALE_MS = 10 * 60 * 1000;

function sanitizeLegacyReport(report) {
  if (!report || typeof report !== 'object') return null;

  const sanitized = { ...report };
  delete sanitized.meta;
  delete sanitized.metaCountries;
  return sanitized;
}

function ensureDataDir() {
  fs.mkdirSync(path.dirname(LATEST_REPORT_FILE), { recursive: true });
}

function persistReport(report) {
  const sanitized = sanitizeLegacyReport(report);
  cache.set('latest', sanitized);
  cache.set(`report_${sanitized.date}`, sanitized);

  ensureDataDir();
  fs.writeFileSync(LATEST_REPORT_FILE, JSON.stringify(sanitized, null, 2));
}

function loadPersistedReport() {
  try {
    if (!fs.existsSync(LATEST_REPORT_FILE)) return null;
    return sanitizeLegacyReport(JSON.parse(fs.readFileSync(LATEST_REPORT_FILE, 'utf8')));
  } catch (err) {
    logger.warn(`[DailyReport] Failed to read persisted report: ${err.message}`);
    return null;
  }
}

function readRunLock() {
  try {
    if (!fs.existsSync(RUN_LOCK_FILE)) return null;
    return JSON.parse(fs.readFileSync(RUN_LOCK_FILE, 'utf8'));
  } catch (err) {
    logger.warn(`[DailyReport] Failed to read run lock: ${err.message}`);
    return null;
  }
}

function clearStaleRunLock() {
  try {
    if (!fs.existsSync(RUN_LOCK_FILE)) return;
    const stats = fs.statSync(RUN_LOCK_FILE);
    if ((Date.now() - stats.mtimeMs) < RUN_LOCK_STALE_MS) return;
    fs.unlinkSync(RUN_LOCK_FILE);
    logger.warn('[DailyReport] Cleared stale run lock');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`[DailyReport] Failed to clear stale run lock: ${err.message}`);
    }
  }
}

function tryAcquireRunLock(lockId) {
  ensureDataDir();
  const payload = JSON.stringify({
    lockId,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  });

  try {
    fs.writeFileSync(RUN_LOCK_FILE, payload, { flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

function releaseRunLock(lockId) {
  try {
    const lock = readRunLock();
    if (lock && lock.lockId && lock.lockId !== lockId) return;
    if (fs.existsSync(RUN_LOCK_FILE)) {
      fs.unlinkSync(RUN_LOCK_FILE);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`[DailyReport] Failed to release run lock: ${err.message}`);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRunCompletion(date, options = {}) {
  const timeoutMs = options.timeoutMs || 2 * 60 * 1000;
  const pollMs = options.pollMs || 500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const latest = getLatestReport();
    if (latest?.date === date && latest.emailDelivery?.status === 'sent') {
      return latest;
    }

    clearStaleRunLock();
    if (!fs.existsSync(RUN_LOCK_FILE)) {
      return getLatestReport();
    }

    await sleep(pollMs);
  }

  throw new Error('Timed out waiting for the current daily report run to finish');
}

async function generateReport() {
  logger.info('[DailyReport] Generating report...');
  const timestamp = new Date().toISOString();

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
  ];

  const [yesterday, last7days, sources, errors, trend, pages, campaigns, indexing, searchQueries, searchPages] = await Promise.all(promises);

  // Build alerts
  const alerts = [];

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
    emailDelivery: null,
  };

  persistReport(report);

  logger.info(`[DailyReport] Report generated — ${alerts.length} alert(s)`);
  return report;
}

function getLatestReport() {
  const cached = cache.get('latest');
  if (cached) {
    return sanitizeLegacyReport(cached);
  }

  return loadPersistedReport() || null;
}

async function runAndEmail(options = {}) {
  if (currentRunPromise) {
    logger.info('[DailyReport] Joining in-flight report run');
    return currentRunPromise;
  }

  currentRunPromise = (async () => {
    const { force = false } = options;
    const today = new Date().toISOString().slice(0, 10);
    const existing = getLatestReport();
    if (!force && existing?.date === today && existing.emailDelivery?.status === 'sent') {
      logger.info('[DailyReport] Returning already-sent report for today');
      return existing;
    }

    const lockId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    while (true) {
      clearStaleRunLock();
      if (tryAcquireRunLock(lockId)) {
        break;
      }

      logger.info('[DailyReport] Another report run is already in progress — waiting for completion');
      const completed = await waitForRunCompletion(today);
      if (completed?.date === today && completed.emailDelivery?.status === 'sent') {
        return completed;
      }
    }

    try {
      const afterLock = getLatestReport();
      if (!force && afterLock?.date === today && afterLock.emailDelivery?.status === 'sent') {
        logger.info('[DailyReport] Returning already-sent report for today after lock acquisition');
        return afterLock;
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
    } finally {
      releaseRunLock(lockId);
    }
  })();

  try {
    return await currentRunPromise;
  } finally {
    currentRunPromise = null;
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
