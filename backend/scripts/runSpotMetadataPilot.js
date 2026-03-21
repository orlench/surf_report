#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { runCollection } = require('../src/sourcing/runner');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runCollection({
    dataset: args.dataset || 'pilot',
    source: args.source || null,
    spot: args.spot || null,
    country: args.country || null,
    region: args.region || null,
    batchSize: args.batchSize || null,
    batchIndex: args.batchIndex || 0,
    force: args.force,
    forceDiscovery: args.forceDiscovery,
    brightDataSseUrl: process.env.BRIGHT_DATA_MCP_SSE_URL,
  });

  console.log(JSON.stringify({
    dataset: result.dataset,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    scope: result.scope,
    artifacts: result.artifactNames,
    coverage: result.coverage.perSource,
    failures: result.failures.failures.length,
    manualQaStatus: result.manualQa.status,
  }, null, 2));
}

function parseArgs(args) {
  const result = {
    dataset: 'pilot',
    force: false,
    forceDiscovery: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dataset') {
      result.dataset = args[index + 1];
      index += 1;
    } else if (arg === '--source') {
      result.source = args[index + 1];
      index += 1;
    } else if (arg === '--country') {
      result.country = args[index + 1];
      index += 1;
    } else if (arg === '--region') {
      result.region = args[index + 1];
      index += 1;
    } else if (arg === '--spot') {
      result.spot = args[index + 1];
      index += 1;
    } else if (arg === '--batchSize') {
      result.batchSize = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--batchIndex') {
      result.batchIndex = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--force') {
      result.force = true;
    } else if (arg === '--forceDiscovery') {
      result.forceDiscovery = true;
    }
  }

  return result;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
