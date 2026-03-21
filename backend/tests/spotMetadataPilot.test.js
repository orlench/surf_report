const {
  parseSurfForecast,
  parseSurfingWaves,
  parseWannaSurf,
} = require('../src/sourcing/parsers');
const {
  parseSearchResults,
  scoreCandidate,
  selectCandidate,
} = require('../src/sourcing/discovery');
const { buildArtifactNames } = require('../src/sourcing/runner');

describe('spot metadata sourcing parsers', () => {
  const spot = {
    id: 'jeffreys_bay',
    name: 'Jeffreys Bay',
    country: 'South Africa',
    region: '',
    aliases: ['Jeffreys Bay', 'J-Bay'],
  };

  test('parses surf-forecast guide fields', () => {
    const markdown = `
J-Bay Surf Forecast and Surf Reports (Eastern Cape (S), South Africa)

J-Bay Surf Guide

J-Bay in Jeffreys Bay Coast is an exposed beach and reef break that has dependable surf, although summer tends to be mostly flat. Offshore winds blow from the west northwest. Clean groundswells prevail and the ideal swell angle is from the south.. Sometimes crowded. Watch out for sharks ,rocks,mussel shells.

J-Bay Spot Info

Type:

Rating:

Reliability:

Todays Sea Temp*:

Beach and reef

4

consistent

22.3°C

Surfing J-Bay:

The best conditions reported for surf at J-Bay occur when a South swell combines with an offshore wind direction from the West-northwest.
`;

    const parsed = parseSurfForecast(markdown, spot, 'https://www.surf-forecast.com/breaks/J-Bay');
    expect(parsed.parseStatus).toBe('success');
    expect(parsed.normalizedFields.breakTypeText).toBe('Beach and reef');
    expect(parsed.normalizedFields.consistencyText).toBe('consistent');
    expect(parsed.normalizedFields.bestWindText).toMatch(/West-northwest|west northwest/i);
    expect(parsed.normalizedFields.hazardsText).toMatch(/sharks/i);
  });

  test('parses surfing-waves detail block', () => {
    const markdown = `
Surfing at Supertubes in J-Bay : Surf Spot Map Location and Information

Supertubes Surf Spot Details

Wave Quality Rating

5

Type of Wave

Point break

Direction of Wave

Right

Bottom

Sand & Rock

Difficulty

Advanced surfer

Crowd Level

Busy

Hazards

Rips, Rocks, Sharks

General Description

The wave is best when breaking in the 4-8ft range and when the conditions are right it can break out from the point down past the car park. Works best on a south west wind.

Rate this spot:
`;

    const parsed = parseSurfingWaves(markdown, spot, 'https://surfing-waves.com/atlas/africa/south_africa/j-bay/spot/supertubes.html');
    expect(parsed.parseStatus).toBe('success');
    expect(parsed.normalizedFields.breakTypeText).toBe('Point break');
    expect(parsed.normalizedFields.waveShapeText).toBe('Right');
    expect(parsed.normalizedFields.bottomTypeText).toBe('Sand & Rock');
    expect(parsed.normalizedFields.bestWindText).toMatch(/south west wind/i);
  });

  test('parses wannasurf characteristics block', () => {
    const markdown = `
Uluwatu - Surfing in Bali, Indonesia - WannaSurf, surf spots atlas, surfing photos, maps, GPS location

Surf Spot Characteristics

Wave qualityTotally Epic

ExperienceExperienced surfers

FrequencyDon't know

Wave

TypeReef-coral

DirectionLeft

BottomReef (coral, sharp rocks etc..)

PowerHollow, Fast

Good swell direction

Good wind direction

Swell sizeStarts working at Less than 1m / 3ft and holds up to 4m+ / 12ft

Best tide positionAll tides

DangersShallow reef

Additional Information

Uluwatu is the most famous wave of Bali.
`;

    const parsed = parseWannaSurf(markdown, {
      id: 'uluwatu',
      name: 'Uluwatu',
      country: 'Indonesia',
      aliases: ['Uluwatu'],
    }, 'https://www.wannasurf.com/spot/Asia/Indonesia/Bali/Uluwatu');
    expect(parsed.parseStatus).toBe('success');
    expect(parsed.normalizedFields.breakTypeText).toBe('Reef-coral');
    expect(parsed.normalizedFields.waveShapeText).toBe('Left');
    expect(parsed.normalizedFields.bottomTypeText).toMatch(/Reef/);
    expect(parsed.normalizedFields.bestTideText).toBe('All tides');
    expect(parsed.normalizedFields.hazardsText).toMatch(/Shallow reef/i);
  });
});

describe('spot metadata discovery helpers', () => {
  test('parses bright data search results', () => {
    const parsed = parseSearchResults(JSON.stringify({
      organic: [
        { link: 'https://example.com/spot', title: 'Example Spot', description: 'A test result' },
      ],
    }));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].link).toBe('https://example.com/spot');
  });

  test('scores and selects an exact country-matched candidate', () => {
    const spot = {
      id: 'pipeline',
      name: 'Pipeline',
      country: 'USA',
      region: '',
      aliases: ['Pipeline'],
    };

    const top = scoreCandidate('surf-forecast', spot, {
      url: 'https://www.surf-forecast.com/breaks/Pipeline_1',
      title: 'Pipeline Surf Forecast and Surf Reports',
      description: 'Oahu, USA',
      origin: 'search',
    });
    const second = scoreCandidate('surf-forecast', spot, {
      url: 'https://www.surf-forecast.com/breaks/Pipeline_1/photos',
      title: 'Pipeline Surf Photos',
      description: 'Oahu, USA',
      origin: 'search',
    });

    const selection = selectCandidate([top, second]);
    expect(selection.status).toBe('selected');
    expect(selection.selected.url).toBe('https://www.surf-forecast.com/breaks/Pipeline_1');
  });

  test('marks close candidates as ambiguous', () => {
    const spot = {
      id: 'playa_hermosa',
      name: 'Playa Hermosa',
      country: 'Costa Rica',
      region: '',
      aliases: ['Playa Hermosa'],
    };

    const first = scoreCandidate('surf-forecast', spot, {
      url: 'https://www.surf-forecast.com/breaks/Playa-Hermosa',
      title: 'Playa Hermosa Surf Forecast',
      description: 'Costa Rica',
      origin: 'search',
    });
    const second = scoreCandidate('surf-forecast', spot, {
      url: 'https://www.surf-forecast.com/breaks/Playa-Hermosa-2',
      title: 'Playa Hermosa Surf Forecast 2',
      description: 'Costa Rica',
      origin: 'search',
    });

    const selection = selectCandidate([first, second]);
    expect(selection.status).toBe('ambiguous_candidate');
  });

  test('matches wannasurf zone index candidates using alias coverage', () => {
    const wannaSpot = {
      id: 'jeffreys_bay',
      name: 'Jeffreys Bay',
      country: 'South Africa',
      region: '',
      aliases: ['Jeffreys Bay', 'J-Bay'],
    };

    const candidate = scoreCandidate('wannasurf', wannaSpot, {
      url: 'https://www.wannasurf.com/spot/Africa/South_Africa/South_J_Bay/index.html',
      title: 'South J Bay - South Africa',
      description: 'South Africa',
      origin: 'index',
    });

    expect(candidate.plausible).toBe(true);
    expect(candidate.exactMatch).toBe(true);
  });
});

describe('spot metadata artifact naming', () => {
  test('keeps canonical report names for full pilot runs', () => {
    expect(buildArtifactNames({})).toEqual({
      manifest: 'phase1-pilot.json',
      coverage: 'phase1-coverage.json',
      failures: 'phase1-failures.json',
      manualQa: 'phase1-manual-qa.json',
    });
  });

  test('uses scoped report names for partial reruns', () => {
    expect(buildArtifactNames({
      source: 'wannasurf',
      country: 'South Africa',
      spot: 'jeffreys_bay',
    })).toEqual({
      manifest: 'phase1-pilot.source-wannasurf.country-south-africa.spot-jeffreys-bay.json',
      coverage: 'phase1-coverage.source-wannasurf.country-south-africa.spot-jeffreys-bay.json',
      failures: 'phase1-failures.source-wannasurf.country-south-africa.spot-jeffreys-bay.json',
      manualQa: 'phase1-manual-qa.source-wannasurf.country-south-africa.spot-jeffreys-bay.json',
    });
  });

  test('uses phase 2 prefixes for full-dataset collection runs', () => {
    expect(buildArtifactNames({
      dataset: 'full',
      source: 'surfing-waves',
      batchSize: 100,
      batchIndex: 2,
    })).toEqual({
      manifest: 'phase2-full.source-surfing-waves.batch-2-100.json',
      coverage: 'phase2-coverage.source-surfing-waves.batch-2-100.json',
      failures: 'phase2-failures.source-surfing-waves.batch-2-100.json',
      manualQa: 'phase2-manual-qa.source-surfing-waves.batch-2-100.json',
    });
  });
});
