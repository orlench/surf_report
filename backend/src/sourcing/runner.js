const logger = require('../utils/logger');
const { loadPilotManifest, loadFullManifest } = require('./manifest');
const {
  loadBucket,
  saveBucket,
  loadRaw,
  saveRaw,
  loadParsed,
  saveParsed,
  saveManifest,
  loadReport,
  saveReport,
  loadState,
  saveState,
} = require('./storage');
const { SOURCE_CONFIGS } = require('./sourceConfigs');
const { BrightDataSseClient } = require('../integrations/brightDataSse');
const { sha256, geoDistanceKm } = require('./utils');
const { saveSpotBundle } = require('./bundle');
const {
  parseSurfForecast,
  parseSurfingWaves,
  parseWannaSurf,
  parseOverpass,
} = require('./parsers');

const GUIDE_SOURCES = ['wannasurf', 'surfing-waves', 'surf-forecast'];
const ALL_SOURCES = [...GUIDE_SOURCES, 'overpass'];
const OVERPASS_RADIUS_METERS = 3500;
const OVERPASS_TIMEOUT_MS = 8000;
const OVERPASS_RETRY_CYCLES = 2;
const OVERPASS_RETRY_DELAY_MS = 5000;
const OVERPASS_INTER_REQUEST_DELAY_MS = 500;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const OVERPASS_RETRY_QUEUE_FILE = 'overpass-retry-queue.json';
const OVERPASS_QUERY_GROUPS = [
  [
    '["sport"="surfing"]',
    '["natural"="reef"]',
    '["natural"="beach"]',
    '["waterway"]',
    '["leisure"="marina"]',
    '["seamark:type"="harbour"]',
    '["man_made"="breakwater"]',
    '["man_made"="groyne"]',
  ],
];

const PARSERS = {
  'surf-forecast': parseSurfForecast,
  'surfing-waves': parseSurfingWaves,
  wannasurf: parseWannaSurf,
};

const DEFAULT_PARALLELISM = {
  overpass: 8,
  'surfing-waves': 8,
  'surf-forecast': 8,
  wannasurf: 6,
};

async function runPilot(options = {}) {
  return runCollection({ ...options, dataset: 'pilot' });
}

async function runCollection(options = {}) {
  const startedAt = new Date().toISOString();
  const dataset = options.dataset || 'pilot';
  const manifestSpots = loadManifest(dataset);
  const spots = filterBatch(filterSpots(manifestSpots, options), options);
  const sources = filterSources(options.source);
  const artifactNames = buildArtifactNames(options);

  saveManifest(artifactNames.manifest, {
    generatedAt: startedAt,
    dataset,
    sources,
    spotIds: spots.map((spot) => spot.id),
    spots,
    scope: buildScope(options),
  });

  for (const source of sources) {
    logger.info(`[SpotMetadata] Running source ${source} for ${spots.length} spot(s)`);
    if (source === 'overpass') {
      await runOverpassSource(spots, options);
    } else {
      await runGuideSource(source, spots, options);
    }
  }

  const coverage = buildCoverageReport(spots, sources);
  const failures = buildFailureReport(spots, sources);
  const existingManualQa = loadReport(artifactNames.manualQa, null);
  const manualQa = preserveSignedOffManualQa(existingManualQa, buildManualQaTemplate(spots, sources));
  if (!options.skipBundles) {
    saveBundlesForSpots(spots);
  }

  saveReport(artifactNames.coverage, coverage);
  saveReport(artifactNames.failures, failures);
  saveReport(artifactNames.manualQa, manualQa);

  return {
    coverage,
    failures,
    manualQa,
    startedAt,
    completedAt: new Date().toISOString(),
    dataset,
    scope: buildScope(options),
    artifactNames,
  };
}

async function runGuideSource(source, spots, options) {
  if (!options.brightDataSseUrl) {
    throw new Error('BRIGHT_DATA_MCP_SSE_URL not set for guide-source collection');
  }

  const candidatesBucket = loadBucket('urlCandidates', source);
  const linksBucket = loadBucket('sourceLinks', source);
  const parallelism = getParallelism(source, options);
  const clients = [];

  try {
    await runInWorkerPool(spots, parallelism, async (spot, workerIndex) => {
      let client = clients[workerIndex];
      if (!client) {
        client = new BrightDataSseClient({ sseUrl: options.brightDataSseUrl });
        clients[workerIndex] = client;
      }

      const existingLink = linksBucket.spots[spot.id];
      let discovery = null;

      if (!existingLink || options.forceDiscovery) {
        try {
          discovery = await callBrightData(client, () => require('./discovery').discoverCandidates(client, source, spot));
        } catch (error) {
          linksBucket.spots[spot.id] = {
            spotId: spot.id,
            source,
            status: 'scrape_failed',
            selected: null,
            ambiguousCandidates: [],
            scrapeError: `discovery_failed:${error.message}`,
            updatedAt: new Date().toISOString(),
          };
          logger.warn(`[SpotMetadata] ${source} discovery failed for ${spot.id}: ${error.message}`);
          return;
        }

        candidatesBucket.spots[spot.id] = {
          spotId: spot.id,
          source,
          discoveredAt: new Date().toISOString(),
          candidates: discovery.candidates,
        };
        linksBucket.spots[spot.id] = {
          spotId: spot.id,
          source,
          status: discovery.status,
          selected: discovery.selected,
          ambiguousCandidates: discovery.ambiguousCandidates || [],
          updatedAt: new Date().toISOString(),
        };
      }

      const linkRecord = linksBucket.spots[spot.id];
      if (!linkRecord || linkRecord.status !== 'selected' || !linkRecord.selected?.url) {
        return;
      }

      const selectedUrl = linkRecord.selected.url;
      const existingRaw = loadRaw(source, spot.id);
      let rawRecord = existingRaw;

      if (!existingRaw || options.force) {
        try {
          const rawMarkdown = await callBrightData(client, () => client.scrapeAsMarkdown(selectedUrl));
          rawRecord = {
            spotId: spot.id,
            source,
            url: selectedUrl,
            scrapedAt: new Date().toISOString(),
            contentHash: sha256(rawMarkdown),
            rawMarkdown,
          };
          saveRaw(source, spot.id, rawRecord);
        } catch (error) {
          linksBucket.spots[spot.id] = {
            ...linkRecord,
            status: 'scrape_failed',
            scrapeError: error.message,
            updatedAt: new Date().toISOString(),
          };
          logger.warn(`[SpotMetadata] ${source} scrape failed for ${spot.id}: ${error.message}`);
          return;
        }
      }

      const existingParsed = loadParsed(source, spot.id);
      if (existingParsed && existingParsed.parseStatus === 'success' && !options.force) {
        linksBucket.spots[spot.id] = {
          ...linksBucket.spots[spot.id],
          status: 'success',
          parsedAt: existingParsed.parsedAt,
          parseIssues: existingParsed.issues || [],
          updatedAt: new Date().toISOString(),
        };
        return;
      }

      const parser = PARSERS[source];
      const parsed = parser(rawRecord.rawMarkdown, spot, selectedUrl);
      const coordinateDistance = validateCoordinates(parsed, spot);
      if (coordinateDistance != null && coordinateDistance > 20) {
        parsed.parseStatus = 'parse_failed';
        parsed.issues = [...(parsed.issues || []), `coordinate_mismatch:${coordinateDistance.toFixed(2)}km`];
      }

      saveParsed(source, spot.id, parsed);
      linksBucket.spots[spot.id] = {
        ...linksBucket.spots[spot.id],
        status: parsed.parseStatus === 'success' ? 'success' : 'parse_failed',
        parsedAt: parsed.parsedAt,
        parseIssues: parsed.issues || [],
        updatedAt: new Date().toISOString(),
      };
    });
  } finally {
    await Promise.all(clients.filter(Boolean).map((client) => client.close().catch(() => {})));
  }

  saveBucket('urlCandidates', source, candidatesBucket);
  saveBucket('sourceLinks', source, linksBucket);
}

async function callBrightData(client, operation, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (!client.connected) {
        await client.connect();
      }
      return await operation();
    } catch (error) {
      lastError = error;
      try {
        await client.close();
      } catch (_) {
        // Ignore reconnect cleanup errors.
      }

      if (attempt < attempts) {
        await sleep(attempt * 250);
      }
    }
  }

  throw lastError || new Error('Bright Data operation failed');
}

async function runOverpassSource(spots, options) {
  const candidatesBucket = loadBucket('urlCandidates', 'overpass');
  const linksBucket = loadBucket('sourceLinks', 'overpass');
  const retryQueue = loadState(OVERPASS_RETRY_QUEUE_FILE, {
    source: 'overpass',
    updatedAt: null,
    spots: {},
  });
  const parallelism = getParallelism('overpass', options);

  await runInWorkerPool(spots, parallelism, async (spot) => {
    candidatesBucket.spots[spot.id] = {
      spotId: spot.id,
      source: 'overpass',
      discoveredAt: new Date().toISOString(),
      candidates: [{ url: SOURCE_CONFIGS.overpass.endpoint, origin: 'static', score: 100, plausible: true }],
    };

    linksBucket.spots[spot.id] = {
      spotId: spot.id,
      source: 'overpass',
      status: 'selected',
      selected: { url: SOURCE_CONFIGS.overpass.endpoint },
      updatedAt: new Date().toISOString(),
    };

    const existingRaw = loadRaw('overpass', spot.id);
    let rawRecord = existingRaw;

    if (!existingRaw || options.force) {
      try {
        const { endpoint, rawData } = await fetchOverpass(spot);
        rawRecord = {
          spotId: spot.id,
          source: 'overpass',
          url: endpoint,
          scrapedAt: new Date().toISOString(),
          contentHash: sha256(JSON.stringify(rawData)),
          rawMarkdown: null,
          rawData,
        };
        saveRaw('overpass', spot.id, rawRecord);
        clearOverpassRetry(retryQueue, spot.id);
        saveState(OVERPASS_RETRY_QUEUE_FILE, {
          ...retryQueue,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        linksBucket.spots[spot.id] = {
          ...linksBucket.spots[spot.id],
          status: 'scrape_failed',
          scrapeError: error.message,
          updatedAt: new Date().toISOString(),
        };
        if (isRetryableOverpassError(error)) {
          scheduleOverpassRetry(retryQueue, spot, error);
          saveState(OVERPASS_RETRY_QUEUE_FILE, {
            ...retryQueue,
            updatedAt: new Date().toISOString(),
          });
        }
        await sleep(OVERPASS_INTER_REQUEST_DELAY_MS);
        return;
      }
    }

    const existingParsed = loadParsed('overpass', spot.id);
    if (existingParsed && existingParsed.parseStatus === 'success' && !options.force) {
      linksBucket.spots[spot.id] = {
        ...linksBucket.spots[spot.id],
        status: 'success',
        parsedAt: existingParsed.parsedAt,
        updatedAt: new Date().toISOString(),
      };
      return;
    }

    const parsed = parseOverpass(rawRecord.rawData, spot, rawRecord.url || SOURCE_CONFIGS.overpass.endpoint);
    saveParsed('overpass', spot.id, parsed);
    linksBucket.spots[spot.id] = {
      ...linksBucket.spots[spot.id],
      status: parsed.parseStatus,
      parsedAt: parsed.parsedAt,
      updatedAt: new Date().toISOString(),
    };

    await sleep(OVERPASS_INTER_REQUEST_DELAY_MS);
  });

  saveBucket('urlCandidates', 'overpass', candidatesBucket);
  saveBucket('sourceLinks', 'overpass', linksBucket);
  saveState(OVERPASS_RETRY_QUEUE_FILE, {
    ...retryQueue,
    updatedAt: new Date().toISOString(),
  });
}

function validateCoordinates(parsed, spot) {
  const coords = parsed?.normalizedFields?.sourceCoordinates;
  if (!coords?.lat || !coords?.lon) return null;
  return geoDistanceKm(spot.lat, spot.lon, coords.lat, coords.lon);
}

async function fetchOverpass(spot) {
  const query = buildOverpassQuery(spot, OVERPASS_QUERY_GROUPS[0]);
  let lastError = null;

  const plans = [];
  for (let cycle = 1; cycle <= OVERPASS_RETRY_CYCLES; cycle += 1) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      plans.push({ endpoint, cycle });
    }
  }

  for (let index = 0; index < plans.length; index += 1) {
    const { endpoint, cycle } = plans[index];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error(`Overpass timeout (${endpoint})`)), OVERPASS_TIMEOUT_MS);
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const rawText = await response.text();
      if (!response.ok) {
        throw new Error(`Overpass HTTP ${response.status} (${endpoint})`);
      }

      const rawData = JSON.parse(rawText);
      return { endpoint, rawData };
    } catch (error) {
      lastError = error;
      if (index < plans.length - 1) {
        await sleep(OVERPASS_RETRY_DELAY_MS * cycle);
      }
    }
  }

  throw lastError || new Error('Overpass request failed');
}

function buildCoverageReport(spots, sources) {
  const perSource = {};

  for (const source of sources) {
    const linksBucket = loadBucket('sourceLinks', source);
    const parsedCount = { success: 0, parse_failed: 0, scrape_failed: 0, no_candidate: 0, ambiguous_candidate: 0, selected: 0 };

    for (const spot of spots) {
      const record = linksBucket.spots[spot.id];
      const status = record?.status || 'no_candidate';
      parsedCount[status] = (parsedCount[status] || 0) + 1;
    }

    perSource[source] = parsedCount;
  }

  return {
    generatedAt: new Date().toISOString(),
    sources,
    spotCount: spots.length,
    perSource,
  };
}

function buildFailureReport(spots, sources) {
  const failures = [];
  for (const source of sources) {
    const linksBucket = loadBucket('sourceLinks', source);
    for (const spot of spots) {
      const record = linksBucket.spots[spot.id];
      if (!record || record.status === 'success') continue;
      failures.push({
        spotId: spot.id,
        spotName: spot.name,
        source,
        status: record.status || 'no_candidate',
        selectedUrl: record.selected?.url || null,
        scrapeError: record.scrapeError || null,
        parseIssues: record.parseIssues || [],
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    failures,
  };
}

function buildManualQaTemplate(spots, sources) {
  const entries = [];
  const guideSources = sources.filter((source) => GUIDE_SOURCES.includes(source));

  for (const source of guideSources) {
    for (const spot of spots) {
      if (entries.length >= 10) break;
      const parsed = loadParsed(source, spot.id);
      const raw = loadRaw(source, spot.id);
      if (!parsed || parsed.parseStatus !== 'success' || !raw) continue;
      entries.push({
        spotId: spot.id,
        spotName: spot.name,
        source,
        url: raw.url,
        reviewed: false,
        checklist: {
          correctUrl: false,
          parsedFieldsVisibleOnPage: false,
          evidenceSnippetsAccurate: false,
          noAmbiguousCandidateAutoAccepted: false,
        },
        notes: '',
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    status: 'pending_review',
    reviewedBy: null,
    entries: entries.slice(0, 10),
  };
}

function filterSpots(spots, options = {}) {
  return spots.filter((spot) => {
    if (options.spot && spot.id !== options.spot) return false;
    if (options.country && spot.country !== options.country) return false;
    if (options.region && spot.region !== options.region) return false;
    return true;
  });
}

function filterBatch(spots, options = {}) {
  if (!options.batchSize) return spots;
  const batchSize = Number(options.batchSize);
  const batchIndex = Number(options.batchIndex || 0);
  const start = batchIndex * batchSize;
  return spots.slice(start, start + batchSize);
}

function filterSources(source) {
  if (!source) return ALL_SOURCES;
  if (!ALL_SOURCES.includes(source)) {
    throw new Error(`Invalid source "${source}". Expected one of: ${ALL_SOURCES.join(', ')}`);
  }
  return [source];
}

function buildArtifactNames(options = {}) {
  const prefix = options.dataset === 'full' ? 'phase2' : 'phase1';
  const manifestBase = options.dataset === 'full' ? `${prefix}-full` : `${prefix}-pilot`;
  const scope = buildScope(options);
  if (scope.parts.length === 0) {
    return {
      manifest: `${manifestBase}.json`,
      coverage: `${prefix}-coverage.json`,
      failures: `${prefix}-failures.json`,
      manualQa: `${prefix}-manual-qa.json`,
    };
  }

  const suffix = scope.parts.join('.');
  return {
    manifest: `${manifestBase}.${suffix}.json`,
    coverage: `${prefix}-coverage.${suffix}.json`,
    failures: `${prefix}-failures.${suffix}.json`,
    manualQa: `${prefix}-manual-qa.${suffix}.json`,
  };
}

function buildScope(options = {}) {
  const parts = [];
  if (options.source) parts.push(`source-${sanitizeScopeValue(options.source)}`);
  if (options.country) parts.push(`country-${sanitizeScopeValue(options.country)}`);
  if (options.region) parts.push(`region-${sanitizeScopeValue(options.region)}`);
  if (options.spot) parts.push(`spot-${sanitizeScopeValue(options.spot)}`);
  if (options.batchSize) parts.push(`batch-${sanitizeScopeValue(`${options.batchIndex || 0}-${options.batchSize}`)}`);
  return { parts };
}

function loadManifest(dataset) {
  if (dataset === 'pilot') return loadPilotManifest();
  if (dataset === 'full') return loadFullManifest();
  throw new Error(`Invalid dataset "${dataset}". Expected "pilot" or "full".`);
}

function saveBundlesForSpots(spots) {
  for (const spot of spots) {
    saveSpotBundle(spot, ALL_SOURCES);
  }
}

function preserveSignedOffManualQa(existing, generated) {
  if (existing?.status === 'signed_off' && generated?.status === 'pending_review') {
    return existing;
  }
  return generated;
}

function sanitizeScopeValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isRetryableOverpassError(error) {
  const message = String(error?.message || '');
  return /Overpass HTTP (429|500|502|503|504)/.test(message) ||
    /Overpass timeout/i.test(message) ||
    /fetch failed/i.test(message) ||
    /aborted/i.test(message);
}

function scheduleOverpassRetry(queue, spot, error) {
  const existing = queue.spots[spot.id];
  queue.spots[spot.id] = {
    spotId: spot.id,
    spotName: spot.name,
    country: spot.country,
    region: spot.region || '',
    lastError: String(error.message || error),
    attempts: (existing?.attempts || 0) + 1,
    lastQueuedAt: new Date().toISOString(),
  };
}

function clearOverpassRetry(queue, spotId) {
  if (queue.spots[spotId]) {
    delete queue.spots[spotId];
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildOverpassQuery(spot, filters) {
  const body = filters
    .map((filter) => `  nwr(around:${OVERPASS_RADIUS_METERS},${spot.lat},${spot.lon})${filter};`)
    .join('\n');

  return `
[out:json][timeout:20];
(
${body}
);
out center tags;
  `.trim();
}

function getParallelism(source, options = {}) {
  return Math.max(1, Number(options.parallelism || DEFAULT_PARALLELISM[source] || 1));
}

async function runInWorkerPool(items, parallelism, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(parallelism, items.length || 1) }, (_, workerIndex) => (
    (async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        if (!item) return;
        await worker(item, workerIndex);
      }
    })()
  ));

  await Promise.all(workers);
}

module.exports = {
  runCollection,
  runPilot,
  buildCoverageReport,
  buildFailureReport,
  buildManualQaTemplate,
  buildArtifactNames,
  buildScope,
  ALL_SOURCES,
  GUIDE_SOURCES,
};
