#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { runCollection, buildArtifactNames } = require('../src/sourcing/runner');
const { loadFullManifest } = require('../src/sourcing/manifest');
const { filePath, saveReport, loadBucket } = require('../src/sourcing/storage');

const DEFAULT_BATCH_SIZES = {
  overpass: 100,
  'surfing-waves': 50,
  'surf-forecast': 50,
  wannasurf: 25,
};

const DEFAULT_PARALLELISM = {
  overpass: 8,
  'surfing-waves': 8,
  'surf-forecast': 8,
  wannasurf: 6,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadFullManifest();
  const filtered = manifest.filter((spot) => {
    if (args.country && spot.country !== args.country) return false;
    if (args.region && spot.region !== args.region) return false;
    return true;
  });

  const batchSize = args.batchSize || DEFAULT_BATCH_SIZES[args.source] || 10;
  const parallelism = args.parallelism || DEFAULT_PARALLELISM[args.source] || 1;
  const totalBatches = Math.ceil(filtered.length / batchSize);
  const startBatch = clamp(args.startBatch ?? 0, 0, Math.max(totalBatches - 1, 0));
  const endBatch = clamp(
    args.endBatch ?? (args.maxBatches != null ? startBatch + args.maxBatches - 1 : totalBatches - 1),
    startBatch,
    Math.max(totalBatches - 1, startBatch),
  );

  const progress = {
    generatedAt: new Date().toISOString(),
    dataset: 'full',
    source: args.source,
    country: args.country || null,
    region: args.region || null,
    batchSize,
    parallelism,
    totalSpots: filtered.length,
    totalBatches,
    startBatch,
    endBatch,
    completed: [],
    skipped: [],
    failed: [],
  };

  for (let batchIndex = startBatch; batchIndex <= endBatch; batchIndex += 1) {
    const artifactNames = buildArtifactNames({
      dataset: 'full',
      source: args.source,
      country: args.country || null,
      region: args.region || null,
      batchSize,
      parallelism,
      batchIndex,
    });

    const coveragePath = filePath('reports', artifactNames.coverage);
    if (!args.force && fs.existsSync(coveragePath)) {
      progress.skipped.push({
        batchIndex,
        reason: 'coverage_exists',
        coverageReport: artifactNames.coverage,
      });
      flushProgress(args.source, progress);
      flushFailureLedger(args.source, filtered, args);
      continue;
    }

    try {
      const result = await runCollection({
        dataset: 'full',
        source: args.source,
        country: args.country || null,
        region: args.region || null,
        batchSize,
        parallelism,
        batchIndex,
        force: args.force,
        forceDiscovery: args.forceDiscovery,
        skipBundles: args.skipBundles,
        brightDataSseUrl: process.env.BRIGHT_DATA_MCP_SSE_URL,
      });

      progress.completed.push({
        batchIndex,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        artifacts: result.artifactNames,
        coverage: result.coverage.perSource,
        failures: result.failures.failures.length,
      });
      flushProgress(args.source, progress);
      flushFailureLedger(args.source, filtered, args);
    } catch (error) {
      progress.failed.push({
        batchIndex,
        error: error.message,
        at: new Date().toISOString(),
      });
      flushProgress(args.source, progress);
      flushFailureLedger(args.source, filtered, args);
      if (!args.continueOnError) {
        throw error;
      }
    }
  }

  console.log(JSON.stringify(progress, null, 2));
}

function flushProgress(source, progress) {
  saveReport(`phase2-progress.${source}.json`, {
    ...progress,
    updatedAt: new Date().toISOString(),
  });
}

function flushFailureLedger(source, filteredSpots, args) {
  const bucket = loadBucket('sourceLinks', source);
  const failures = [];

  for (const spot of filteredSpots) {
    const record = bucket.spots[spot.id];
    if (!record) continue;
    if (!['scrape_failed', 'parse_failed'].includes(record.status)) continue;

    failures.push({
      spotId: spot.id,
      spotName: spot.name,
      country: spot.country || '',
      region: spot.region || '',
      status: record.status,
      selectedUrl: record.selected?.url || null,
      scrapeError: record.scrapeError || null,
      parseIssues: record.parseIssues || [],
      updatedAt: record.updatedAt || null,
    });
  }

  saveReport(buildFailureLedgerName(source, args), {
    generatedAt: new Date().toISOString(),
    source,
    country: args.country || null,
    region: args.region || null,
    failureCount: failures.length,
    failures,
  });
}

function buildFailureLedgerName(source, args) {
  const parts = [`phase2-failure-ledger`, `source-${sanitizeScopeValue(source)}`];
  if (args.country) parts.push(`country-${sanitizeScopeValue(args.country)}`);
  if (args.region) parts.push(`region-${sanitizeScopeValue(args.region)}`);
  return `${parts.join('.')}.json`;
}

function parseArgs(args) {
  const result = {
    source: 'overpass',
    startBatch: 0,
    continueOnError: false,
    force: false,
    forceDiscovery: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--source') {
      result.source = args[index + 1];
      index += 1;
    } else if (arg === '--country') {
      result.country = args[index + 1];
      index += 1;
    } else if (arg === '--region') {
      result.region = args[index + 1];
      index += 1;
    } else if (arg === '--batchSize') {
      result.batchSize = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--startBatch') {
      result.startBatch = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--parallelism') {
      result.parallelism = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--endBatch') {
      result.endBatch = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--maxBatches') {
      result.maxBatches = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--continueOnError') {
      result.continueOnError = true;
    } else if (arg === '--force') {
      result.force = true;
    } else if (arg === '--forceDiscovery') {
      result.forceDiscovery = true;
    } else if (arg === '--skipBundles') {
      result.skipBundles = true;
    }
  }

  return result;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeScopeValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
