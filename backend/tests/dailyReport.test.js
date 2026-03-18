const fs = require('fs');
const os = require('os');
const path = require('path');

describe('dailyReport', () => {
  let tempDir;
  let sendDailyReportMock;

  beforeEach(() => {
    jest.resetModules();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'surf-report-daily-'));
    sendDailyReportMock = jest.fn();
    process.env.REPORT_EMAIL = 'orlench@gmail.com';

    jest.doMock('../src/utils/dataPath', () => ({
      resolve: jest.fn((name) => path.join(tempDir, name))
    }));

    jest.doMock('../src/services/analyticsClient', () => ({
      getOverview: jest.fn(async () => ({ totals: { sessions: '10' } })),
      getTrafficSources: jest.fn(async () => ({ rows: [] })),
      getErrors: jest.fn(async () => ({ rows: [] })),
      getDailyTrend: jest.fn(async () => ({ rows: [] })),
      getTopPages: jest.fn(async () => ({ rows: [] })),
      getCampaignPerformance: jest.fn(async () => ({ rows: [] }))
    }));

    jest.doMock('../src/services/searchConsole', () => ({
      getIndexingStatus: jest.fn(async () => ({ sitemaps: [] })),
      getSearchAnalytics: jest.fn(async () => ({ rows: [] }))
    }));

    jest.doMock('../src/services/emailSender', () => ({
      sendDailyReport: sendDailyReportMock
    }));
  });

  afterEach(() => {
    delete process.env.REPORT_EMAIL;
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('coalesces concurrent sends into a single email', async () => {
    let resolveSend;
    sendDailyReportMock.mockImplementation(() => new Promise((resolve) => {
      resolveSend = resolve;
    }));

    const { runAndEmail } = require('../src/services/dailyReport');

    const firstRun = runAndEmail({ force: true });
    const secondRun = runAndEmail({ force: true });

    await new Promise((resolve) => setImmediate(resolve));

    expect(sendDailyReportMock).toHaveBeenCalledTimes(1);

    resolveSend({
      status: 'sent',
      provider: 'gmail',
      recipient: 'orlench@gmail.com',
      sentAt: '2026-03-18T13:35:57.718Z'
    });

    const [firstReport, secondReport] = await Promise.all([firstRun, secondRun]);

    expect(firstReport).toBe(secondReport);
    expect(firstReport.emailDelivery.status).toBe('sent');
    expect(fs.existsSync(path.join(tempDir, 'daily-report-run.lock'))).toBe(false);
  });

  test('strips legacy meta fields from persisted reports', () => {
    const legacyReport = {
      date: '2026-03-18',
      timestamp: '2026-03-18T13:35:57.718Z',
      ga4: { yesterday: { sessions: '10' } },
      searchConsole: { indexing: [] },
      emailDelivery: { status: 'sent' },
      meta: { campaign: { status: 'PAUSED' } },
      metaCountries: [{ country: 'IL', spend: '0' }],
    };

    fs.writeFileSync(path.join(tempDir, 'daily-report-latest.json'), JSON.stringify(legacyReport, null, 2));

    const { getLatestReport } = require('../src/services/dailyReport');
    const report = getLatestReport();

    expect(report.meta).toBeUndefined();
    expect(report.metaCountries).toBeUndefined();
    expect(report.ga4.yesterday.sessions).toBe('10');
  });
});
