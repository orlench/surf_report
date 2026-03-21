const path = require('path');
const {
  loadBucket,
  loadRaw,
  loadParsed,
  saveBundle,
  bundlePath,
  baseDir,
} = require('./storage');

function buildSpotBundle(spot, sources) {
  const sourceEntries = {};

  for (const source of sources) {
    const linkRecord = loadBucket('sourceLinks', source).spots[spot.id] || null;
    const rawRecord = loadRaw(source, spot.id);
    const parsedRecord = loadParsed(source, spot.id);

    sourceEntries[source] = {
      status: linkRecord?.status || 'not_attempted',
      selected: linkRecord?.selected || null,
      ambiguousCandidates: linkRecord?.ambiguousCandidates || [],
      scrapeError: linkRecord?.scrapeError || null,
      parseIssues: linkRecord?.parseIssues || [],
      raw: rawRecord ? {
        path: relativeMetadataPath(bundlePath(spot.id), path.join(baseDir(), 'raw', source, `${spot.id}.json`)),
        scrapedAt: rawRecord.scrapedAt || null,
        contentHash: rawRecord.contentHash || null,
        hasRawMarkdown: typeof rawRecord.rawMarkdown === 'string' && rawRecord.rawMarkdown.length > 0,
        hasRawData: rawRecord.rawData != null,
      } : null,
      parsed: parsedRecord ? {
        path: relativeMetadataPath(bundlePath(spot.id), path.join(baseDir(), 'parsed', source, `${spot.id}.json`)),
        parsedAt: parsedRecord.parsedAt,
        parseStatus: parsedRecord.parseStatus,
        normalizedFields: parsedRecord.normalizedFields,
        evidence: parsedRecord.evidence,
        issues: parsedRecord.issues,
        rawFieldKeys: Object.keys(parsedRecord.rawFields || {}),
      } : null,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    spot: {
      id: spot.id,
      name: spot.name,
      lat: spot.lat,
      lon: spot.lon,
      country: spot.country || '',
      region: spot.region || '',
      aliases: spot.aliases || [spot.name],
    },
    summary: summarizeSourceEntries(sourceEntries),
    sources: sourceEntries,
  };
}

function saveSpotBundle(spot, sources) {
  const bundle = buildSpotBundle(spot, sources);
  saveBundle(spot.id, bundle);
  return bundle;
}

function summarizeSourceEntries(sourceEntries) {
  const byStatus = {};
  const successfulSources = [];

  for (const [source, entry] of Object.entries(sourceEntries)) {
    byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    if (entry.status === 'success') {
      successfulSources.push(source);
    }
  }

  return {
    successfulSources,
    byStatus,
  };
}

function relativeMetadataPath(fromPath, toPath) {
  return path.relative(path.dirname(fromPath), toPath);
}

module.exports = {
  buildSpotBundle,
  saveSpotBundle,
};
