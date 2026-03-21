const { SOURCE_CONFIGS } = require('./sourceConfigs');
const {
  normalizeText,
  tokenCoverage,
  uniqueBy,
  matchesCountry,
  matchesRegion,
} = require('./utils');

const WANNA_INDEX_CACHE = new Map();

function parseSearchResults(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.organic) ? parsed.organic : [];
  } catch (_) {
    return [];
  }
}

function scoreCandidate(sourceKey, spot, candidate) {
  const source = SOURCE_CONFIGS[sourceKey];
  const primaryLabel = typeof source.extractCandidateLabel === 'function'
    ? source.extractCandidateLabel(candidate)
    : [candidate.url, candidate.title].filter(Boolean).join(' ');
  const primaryHaystack = normalizeText(primaryLabel);
  const contextHaystack = normalizeText(candidate.description || '');
  const aliases = uniqueBy([spot.name, ...(spot.aliases || [])], (item) => normalizeText(item));

  let bestCoverage = 0;
  let contextCoverage = 0;
  let exactMatch = false;
  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) continue;
    if (primaryHaystack.includes(normalizedAlias)) {
      exactMatch = true;
      bestCoverage = 1;
      break;
    }
    bestCoverage = Math.max(bestCoverage, tokenCoverage(alias, primaryHaystack));
    contextCoverage = Math.max(contextCoverage, tokenCoverage(alias, contextHaystack));
  }

  const haystack = `${primaryHaystack} ${contextHaystack}`.trim();
  const hasCountryMatch = matchesCountry(haystack, spot.country);
  const hasRegionMatch = matchesRegion(haystack, spot.region);

  let score = 0;
  if (candidate.origin === 'seed') score += 35;
  if (candidate.origin === 'index') score += 18;
  if (candidate.origin === 'guess') score += 10;
  if (source.prefersUrl(candidate.url)) score += 20;
  if (exactMatch) score += 45;
  else if (bestCoverage >= 0.8) score += 30;
  else if (bestCoverage >= 0.6) score += 15;
  else if (contextCoverage >= 0.8) score += 5;
  if (hasCountryMatch) score += 12;
  if (hasRegionMatch) score += 8;

  const plausible =
    !source.rejectsUrl(candidate.url) &&
    (candidate.origin === 'seed' || exactMatch || bestCoverage >= 0.8) &&
    (
      candidate.origin === 'seed' ||
      (!spot.country && !spot.region ? true : hasCountryMatch || hasRegionMatch)
    );

  return {
    ...candidate,
    score,
    exactMatch,
    bestCoverage,
    contextCoverage,
    hasCountryMatch,
    hasRegionMatch,
    plausible,
  };
}

function selectCandidate(scoredCandidates) {
  const plausible = scoredCandidates
    .filter((candidate) => candidate.plausible)
    .sort((a, b) => b.score - a.score);

  if (plausible.length === 0) {
    return { status: 'no_candidate', selected: null };
  }

  if (plausible.length > 1 && plausible[0].score - plausible[1].score < 10) {
    return { status: 'ambiguous_candidate', selected: null, ambiguousCandidates: plausible.slice(0, 3) };
  }

  return { status: 'selected', selected: plausible[0] };
}

async function discoverCandidates(client, sourceKey, spot) {
  const source = SOURCE_CONFIGS[sourceKey];
  const seedUrls = new Set((typeof source.seedUrls === 'function' ? source.seedUrls(spot) : []).filter(Boolean));
  const guessedUrls = (typeof source.guessUrls === 'function' ? source.guessUrls(spot) : []).filter(Boolean);
  const guesses = guessedUrls.map((url) => ({
    url,
    title: '',
    description: '',
    origin: seedUrls.has(url) ? 'seed' : 'guess',
  }));

  const scoredGuesses = guesses
    .map((candidate) => scoreCandidate(sourceKey, spot, candidate))
    .sort((a, b) => b.score - a.score);
  const guessSelection = selectCandidate(scoredGuesses);
  if (guessSelection.status === 'selected' && guessSelection.selected?.origin === 'seed') {
    return {
      candidates: scoredGuesses,
      ...guessSelection,
    };
  }

  const supplemental = await discoverSupplementalCandidates(client, sourceKey, spot);
  const searched = [];
  for (const query of source.buildQueries(spot)) {
    const raw = await client.searchEngine(query.query, {
      engine: query.engine,
      geoLocation: query.geoLocation,
    });
    const organic = parseSearchResults(raw)
      .filter((item) => String(item.link || '').includes(source.domain))
      .map((item) => ({
        url: item.link,
        title: item.title || '',
        description: item.description || '',
        origin: 'search',
        query: query.query,
      }));
    searched.push(...organic);
  }

  const combined = uniqueBy([
    ...guesses,
    ...supplemental,
    ...searched,
  ], (candidate) => candidate.url);

  const scored = combined.map((candidate) => scoreCandidate(sourceKey, spot, candidate))
    .sort((a, b) => b.score - a.score);

  const selection = selectCandidate(scored);
  return {
    candidates: scored,
    ...selection,
  };
}

async function discoverSupplementalCandidates(client, sourceKey, spot) {
  if (sourceKey !== 'wannasurf') return [];
  return discoverWannaSurfIndexCandidates(client, spot);
}

async function discoverWannaSurfIndexCandidates(client, spot) {
  const source = SOURCE_CONFIGS.wannasurf;
  const startUrls = typeof source.indexUrls === 'function' ? source.indexUrls(spot) : [];
  if (startUrls.length === 0) return [];

  const discovered = [];
  const visited = new Set();
  const frontier = startUrls.map((url) => ({ url, depth: 0 }));
  const countryPathParts = typeof source.countryPathParts === 'function' ? source.countryPathParts(spot) : null;
  const countryPrefix = countryPathParts ? `/spot/${countryPathParts.join('/')}/` : null;

  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current?.url || visited.has(current.url)) continue;
    visited.add(current.url);

    let links = [];
    try {
      links = await fetchWannaSurfIndexLinks(client, current.url);
    } catch (_) {
      continue;
    }

    const candidates = links
      .filter((candidate) => candidate.url && !source.rejectsUrl(candidate.url))
      .filter((candidate) => !/\/(photo|video|comment)\//i.test(candidate.url))
      .filter((candidate) => !/wdaction=|community\/|newsletter\/|professionals\/|feedback/i.test(candidate.url))
      .map((candidate) => ({
        ...candidate,
        origin: 'index',
      }));

    discovered.push(...candidates);

    if (current.depth >= 1) continue;

    const followUps = candidates
      .filter((candidate) => /\/index\.html$/i.test(candidate.url))
      .filter((candidate) => {
        if (!countryPrefix) return true;
        return new URL(candidate.url).pathname.startsWith(countryPrefix);
      })
      .filter((candidate) => candidate.url !== current.url)
      .slice(0, 12)
      .map((candidate) => ({ url: candidate.url, depth: current.depth + 1 }));

    frontier.push(...followUps);
  }

  return uniqueBy(discovered, (candidate) => candidate.url);
}

async function fetchWannaSurfIndexLinks(client, url) {
  if (WANNA_INDEX_CACHE.has(url)) {
    return WANNA_INDEX_CACHE.get(url);
  }

  const html = await client.scrapeAsHtml(url);
  const candidates = extractHtmlAnchorCandidates(html, url);
  WANNA_INDEX_CACHE.set(url, candidates);
  return candidates;
}

function extractHtmlAnchorCandidates(html, baseUrl) {
  const candidates = [];
  const anchorPattern = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(String(html || ''))) !== null) {
    const href = String(match[2] || '').trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) continue;

    let resolved;
    try {
      resolved = new URL(href, baseUrl).toString();
    } catch (_) {
      continue;
    }

    if (!/wannasurf\.com\/spot\//i.test(resolved)) continue;

    const title = stripHtmlTags(match[3]);
    candidates.push({
      url: resolved,
      title,
      description: '',
    });
  }

  return uniqueBy(candidates, (candidate) => candidate.url);
}

function stripHtmlTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  parseSearchResults,
  scoreCandidate,
  selectCandidate,
  discoverCandidates,
};
