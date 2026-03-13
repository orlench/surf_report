const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Send email via Gmail API over HTTPS (no SMTP needed).
 * Uses OAuth2 client credentials + refresh token.
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 */

let accessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt - 60000) return accessToken;

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return accessToken;
}

function isConfigured() {
  return !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}

function formatNumber(n) {
  if (n == null) return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return n;
  if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (num < 1 && num > 0) return num.toFixed(2);
  return Math.round(num).toString();
}

function buildHtml(report) {
  const { alerts, ga4, meta } = report;
  const y = ga4.yesterday || {};
  const w = ga4.last7days || {};

  // Alerts section
  let alertsHtml = '';
  if (alerts.length > 0) {
    const alertItems = alerts.map(a => {
      const color = a.level === 'critical' ? '#dc2626' : a.level === 'warning' ? '#d97706' : '#2563eb';
      const icon = a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️' : 'ℹ️';
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:${color};font-weight:600">${icon} ${a.message}</td></tr>`;
    }).join('');
    alertsHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#fff8f0;border-radius:8px;overflow:hidden">
        <tr><td style="padding:12px;background:#fff3e0;font-weight:700;font-size:14px">Alerts</td></tr>
        ${alertItems}
      </table>`;
  }

  // GA4 metrics table
  const dailyAvg7d = parseInt(w.sessions || 0) / 7;
  const metricsHtml = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr style="background:#f8fafc">
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:13px;color:#64748b">Metric</th>
        <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #e2e8f0;font-size:13px;color:#64748b">Yesterday</th>
        <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #e2e8f0;font-size:13px;color:#64748b">7-Day Avg</th>
      </tr>
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">Sessions</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:600">${formatNumber(y.sessions)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${formatNumber(dailyAvg7d)}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">Users</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:600">${formatNumber(y.totalUsers)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${formatNumber(parseInt(w.totalUsers || 0) / 7)}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">Pageviews</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:600">${formatNumber(y.screenPageViews)}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${formatNumber(parseInt(w.screenPageViews || 0) / 7)}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">Bounce Rate</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:600">${y.bounceRate ? (parseFloat(y.bounceRate) * 100).toFixed(1) + '%' : '—'}</td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${w.bounceRate ? (parseFloat(w.bounceRate) * 100).toFixed(1) + '%' : '—'}</td>
      </tr>
    </table>`;

  // Traffic sources
  let sourcesHtml = '';
  if (ga4.sources.length > 0) {
    const sourceRows = ga4.sources.slice(0, 8).map(s =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${s.sessionSource || '(direct)'} / ${s.sessionMedium || '(none)'}</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${formatNumber(s.sessions)}</td>
      </tr>`
    ).join('');
    sourcesHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr style="background:#f8fafc">
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:13px;color:#64748b">Traffic Source</th>
          <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #e2e8f0;font-size:13px;color:#64748b">Sessions</th>
        </tr>
        ${sourceRows}
      </table>`;
  }

  // Meta ads section
  let metaHtml = '';
  if (meta) {
    const campaign = meta.campaign;
    const insights = meta.insights;
    const statusColor = campaign?.status === 'ACTIVE' ? '#16a34a' : '#dc2626';
    metaHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr style="background:#f8fafc">
          <th colspan="2" style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:13px;color:#64748b">Meta Ads (Last 7 Days)</th>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">Status</td>
          <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:600;color:${statusColor}">${campaign?.status || 'Unknown'}</td>
        </tr>
        ${insights ? `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">Spend</td>
          <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0;font-weight:600">$${parseFloat(insights.spend || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">Impressions</td>
          <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${formatNumber(insights.impressions)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">Clicks</td>
          <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${formatNumber(insights.clicks)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">CPC</td>
          <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0">$${parseFloat(insights.cpc || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">CTR</td>
          <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${parseFloat(insights.ctr || 0).toFixed(2)}%</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">Reach</td>
          <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${formatNumber(insights.reach)}</td>
        </tr>` : '<tr><td colspan="2" style="padding:8px 12px;color:#94a3b8">No insights data yet</td></tr>'}
      </table>`;
  }

  // Errors section
  let errorsHtml = '';
  if (ga4.errors.length > 0) {
    const errorRows = ga4.errors.slice(0, 10).map(e =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:12px">${e['customEvent:error_message'] || 'Unknown'}</td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0">${e.eventCount || 0}</td>
      </tr>`
    ).join('');
    errorsHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr style="background:#fef2f2">
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #fecaca;font-size:13px;color:#dc2626">JS Errors</th>
          <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #fecaca;font-size:13px;color:#dc2626">Count</th>
        </tr>
        ${errorRows}
      </table>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#1e40af;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;font-size:20px">🏄 Should I Go Surf — Daily Report</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.8">${report.date}</p>
    </div>
    <div style="background:white;padding:24px;border-radius:0 0 12px 12px">
      ${alertsHtml}
      ${metricsHtml}
      ${sourcesHtml}
      ${metaHtml}
      ${errorsHtml}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">shouldigo.surf daily monitor</p>
  </div>
</body>
</html>`;
}

/**
 * Build RFC 2822 email and base64url encode it for Gmail API
 */
function buildRawEmail(to, subject, html) {
  const boundary = 'boundary_' + Date.now();
  const raw = [
    `From: "SIG Monitor" <orlench@gmail.com>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html).toString('base64'),
    `--${boundary}--`,
  ].join('\r\n');

  // Gmail API needs base64url encoding
  return Buffer.from(raw).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendDailyReport(report) {
  if (!isConfigured()) {
    logger.warn('[Email] Gmail OAuth not configured — email disabled');
    return;
  }

  const alertCount = report.alerts.length;
  const subject = alertCount > 0
    ? `🏄 Daily Report — ${alertCount} alert(s) — ${report.date}`
    : `🏄 Daily Report — All good — ${report.date}`;

  try {
    const token = await getAccessToken();
    const raw = buildRawEmail('orlench@gmail.com', subject, buildHtml(report));

    await axios.post(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      { raw },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      }
    );

    logger.info(`[Email] Daily report sent to orlench@gmail.com`);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error(`[Email] Failed to send: ${msg}`);
  }
}

module.exports = { sendDailyReport };
