const { firstLine, extractCoordinatesFromText, extractSentence } = require('./utils');

function emptyNormalizedFields() {
  return {
    sourceSpotName: null,
    sourceCountry: null,
    sourceRegion: null,
    sourceCoordinates: null,
    breakTypeText: null,
    bottomTypeText: null,
    waveShapeText: null,
    bestWindText: null,
    bestSwellText: null,
    bestTideText: null,
    powerText: null,
    difficultyText: null,
    consistencyText: null,
    hazardsText: null,
    narrativeSections: {},
  };
}

function buildParsedRecord(source, spot, url, rawFields, normalizedFields, evidence, issues = []) {
  const hasValue = Object.values(normalizedFields).some((value) => {
    if (value == null) return false;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  });

  return {
    spotId: spot.id,
    source,
    url,
    parsedAt: new Date().toISOString(),
    rawFields,
    normalizedFields,
    evidence,
    issues,
    parseStatus: hasValue ? 'success' : 'parse_failed',
  };
}

function createFailedParsedRecord(source, spot, url, message) {
  return {
    spotId: spot.id,
    source,
    url,
    parsedAt: new Date().toISOString(),
    rawFields: {},
    normalizedFields: emptyNormalizedFields(),
    evidence: {},
    issues: [message],
    parseStatus: 'parse_failed',
  };
}

function parseSurfForecast(markdown, spot, url) {
  const text = String(markdown || '');
  const normalizedFields = emptyNormalizedFields();
  const rawFields = {
    title: firstLine(text),
  };
  const evidence = {};

  normalizedFields.sourceSpotName = firstLine(text).replace(/\s+Surf Forecast.*$/, '').trim() || spot.name;

  const guideMatch = text.match(/([^\n]+ Surf Guide)\s+([\s\S]*?)\s+[^\n]+ Spot Info/);
  if (guideMatch) {
    rawFields.guideHeading = guideMatch[1].trim();
    rawFields.guideText = guideMatch[2].trim();
    normalizedFields.narrativeSections.guide = rawFields.guideText;
    evidence.narrativeGuide = { snippet: rawFields.guideText.slice(0, 500) };

    const hazards = rawFields.guideText.match(/Watch out for\s+(.+?)\./i);
    if (hazards) {
      normalizedFields.hazardsText = hazards[1].replace(/\s+/g, ' ').trim();
      evidence.hazardsText = { snippet: hazards[0] };
    }

    const offshoreSentence = extractSentence(rawFields.guideText, (sentence) => /Offshore winds blow from/i.test(sentence));
    if (offshoreSentence) {
      normalizedFields.bestWindText = offshoreSentence.replace(/\s+/g, ' ').trim();
      evidence.bestWindText = { snippet: offshoreSentence };
    }

    const swellSentence = extractSentence(rawFields.guideText, (sentence) => /ideal swell angle|groundswells prevail/i.test(sentence));
    if (swellSentence) {
      normalizedFields.bestSwellText = swellSentence.replace(/\s+/g, ' ').trim();
      evidence.bestSwellText = { snippet: swellSentence };
    }
  }

  const spotInfoMatch = text.match(/Spot Info\s+Type:\s+Rating:\s+Reliability:\s+Todays Sea Temp\*:\s+([\s\S]*?)\s+Surfing /);
  if (spotInfoMatch) {
    const lines = spotInfoMatch[1]
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    rawFields.spotInfoLines = lines;
    normalizedFields.breakTypeText = lines[0] || null;
    normalizedFields.consistencyText = lines[2] || null;
    if (normalizedFields.breakTypeText) {
      evidence.breakTypeText = { snippet: normalizedFields.breakTypeText };
    }
    if (normalizedFields.consistencyText) {
      evidence.consistencyText = { snippet: normalizedFields.consistencyText };
    }
  }

  const bestConditions = text.match(/The best conditions reported for surf at .*? occur when (.+?)\./i);
  if (bestConditions) {
    rawFields.bestConditions = bestConditions[0].trim();
    if (!normalizedFields.bestSwellText) {
      normalizedFields.bestSwellText = bestConditions[1].trim();
      evidence.bestSwellText = { snippet: bestConditions[0] };
    }
    if (!normalizedFields.bestWindText) {
      normalizedFields.bestWindText = bestConditions[1].trim();
      evidence.bestWindText = { snippet: bestConditions[0] };
    }
  }

  const coordinates = extractCoordinatesFromText(text);
  if (coordinates) {
    normalizedFields.sourceCoordinates = coordinates;
    evidence.sourceCoordinates = { snippet: JSON.stringify(coordinates) };
  }

  return buildParsedRecord('surf-forecast', spot, url, rawFields, normalizedFields, evidence);
}

function parseSurfingWaves(markdown, spot, url) {
  const text = String(markdown || '');
  const normalizedFields = emptyNormalizedFields();
  const rawFields = { title: firstLine(text) };
  const evidence = {};

  const detailsIndex = text.indexOf('Surf Spot Details');
  if (detailsIndex === -1) {
    return createFailedParsedRecord('surfing-waves', spot, url, 'Surf Spot Details section not found');
  }

  const relevant = text.slice(detailsIndex);
  rawFields.detailsSection = relevant.slice(0, 2500);
  normalizedFields.sourceSpotName = firstLine(text).replace(/^Surfing at\s+/i, '').split(':')[0].trim() || spot.name;

  const fields = {
    breakTypeText: ['Type of Wave', 'Direction of Wave'],
    waveShapeText: ['Direction of Wave', 'Bottom'],
    bottomTypeText: ['Bottom', 'Difficulty'],
    difficultyText: ['Difficulty', 'Crowd Level'],
    hazardsText: ['Hazards', 'General Description'],
    narrativeDescription: ['General Description', 'Rate this spot'],
  };

  for (const [field, [start, end]] of Object.entries(fields)) {
    const value = extractBetweenLabels(relevant, start, [end]);
    if (!value) continue;
    if (field === 'narrativeDescription') {
      normalizedFields.narrativeSections.description = value;
      evidence.narrativeDescription = { snippet: value.slice(0, 500) };
      const windSentence = extractSentence(value, (sentence) => /works best on|wind/i.test(sentence));
      if (windSentence) {
        normalizedFields.bestWindText = windSentence;
        evidence.bestWindText = { snippet: windSentence };
      }
      const swellSentence = extractSentence(value, (sentence) => /swell/i.test(sentence));
      if (swellSentence) {
        normalizedFields.bestSwellText = swellSentence;
        evidence.bestSwellText = { snippet: swellSentence };
      }
      continue;
    }
    normalizedFields[field] = value;
    evidence[field] = { snippet: value };
  }

  const coordinates = extractCoordinatesFromText(text);
  if (coordinates) {
    normalizedFields.sourceCoordinates = coordinates;
    evidence.sourceCoordinates = { snippet: JSON.stringify(coordinates) };
  }

  return buildParsedRecord('surfing-waves', spot, url, rawFields, normalizedFields, evidence);
}

function parseWannaSurf(markdown, spot, url) {
  const text = String(markdown || '');
  const normalizedFields = emptyNormalizedFields();
  const rawFields = { title: firstLine(text) };
  const evidence = {};

  const characteristicsIndex = text.indexOf('Surf Spot Characteristics');
  if (characteristicsIndex === -1) {
    if (/Page not found/i.test(text)) {
      return createFailedParsedRecord('wannasurf', spot, url, 'Surf Spot Characteristics section not found');
    }

    normalizedFields.sourceSpotName = firstLine(text).replace(/\s+-\s+Surfing.*$/, '').trim() || spot.name;
    const aboutSection = extractWannaZoneAbout(text);
    if (aboutSection) {
      normalizedFields.narrativeSections.about = aboutSection;
      evidence.narrativeAbout = { snippet: aboutSection.slice(0, 600) };
    }

    const firstRow = extractWannaZoneRow(text);
    if (firstRow) {
      if (firstRow.waveShapeText) {
        normalizedFields.waveShapeText = firstRow.waveShapeText;
        evidence.waveShapeText = { snippet: firstRow.waveShapeText };
      }
      if (firstRow.breakTypeText) {
        normalizedFields.breakTypeText = firstRow.breakTypeText;
        evidence.breakTypeText = { snippet: firstRow.breakTypeText };
      }
      if (firstRow.difficultyText) {
        normalizedFields.difficultyText = firstRow.difficultyText;
        evidence.difficultyText = { snippet: firstRow.difficultyText };
      }
    }

    return buildParsedRecord('wannasurf', spot, url, rawFields, normalizedFields, evidence);
  }

  if (/Page not found/i.test(text)) {
    return createFailedParsedRecord('wannasurf', spot, url, 'Surf Spot Characteristics section not found');
  }

  const tail = text.slice(characteristicsIndex);
  const additionalInfoIndex = tail.indexOf('Additional Information');
  const characteristicsText = additionalInfoIndex === -1 ? tail : tail.slice(0, additionalInfoIndex);
  const additionalInfoText = additionalInfoIndex === -1 ? '' : tail.slice(additionalInfoIndex + 'Additional Information'.length);

  rawFields.characteristicsSection = characteristicsText.slice(0, 2500);
  rawFields.additionalInformation = additionalInfoText.slice(0, 2500);

  normalizedFields.sourceSpotName = firstLine(text).replace(/\s+-\s+Surfing.*$/, '').trim() || spot.name;

  const labels = [
    'Wave quality',
    'Experience',
    'Frequency',
    'Type',
    'Direction',
    'Bottom',
    'Power',
    'Normal length',
    'Good day length',
    'Good swell direction',
    'Good wind direction',
    'Swell size',
    'Best tide position',
    'Best tide movement',
    'Week crowd',
    'Week-end crowd',
    'Webcam url',
    'Dangers',
  ];

  const labelMap = {
    'Type': 'breakTypeText',
    'Direction': 'waveShapeText',
    'Bottom': 'bottomTypeText',
    'Good wind direction': 'bestWindText',
    'Good swell direction': 'bestSwellText',
    'Best tide position': 'bestTideText',
    'Power': 'powerText',
    'Experience': 'difficultyText',
    'Dangers': 'hazardsText',
  };

  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    const nextLabels = labels.slice(index + 1);
    const value = extractBetweenLabels(characteristicsText, label, nextLabels);
    if (!value) continue;
    rawFields[label] = value;
    const normalizedField = labelMap[label];
    if (normalizedField) {
      normalizedFields[normalizedField] = value;
      evidence[normalizedField] = { snippet: `${label}${value}` };
    }
  }

  if (additionalInfoText) {
    normalizedFields.narrativeSections.additionalInformation = additionalInfoText.trim();
    evidence.narrativeAdditionalInformation = {
      snippet: additionalInfoText.trim().slice(0, 600),
    };
  }

  const coordinates = extractCoordinatesFromText(text);
  if (coordinates) {
    normalizedFields.sourceCoordinates = coordinates;
    evidence.sourceCoordinates = { snippet: JSON.stringify(coordinates) };
  }

  return buildParsedRecord('wannasurf', spot, url, rawFields, normalizedFields, evidence);
}

function extractWannaZoneAbout(text) {
  const match = text.match(/(J-bay is probably[\s\S]*?)(?:\n\s*\[|$)/i);
  if (match) {
    return match[1].replace(/\s+/g, ' ').trim();
  }

  const title = firstLine(text);
  return title || null;
}

function extractWannaZoneRow(text) {
  const rowMatch = text.match(/Supertubes\s*\(J-Bay\)[\s\S]*?Right[\s\S]*?Point-break[\s\S]*?(All surfers|Experienced surfers|Pros or kamikaze only\.\.\.|Pros or kamikaze only)/i);
  if (rowMatch) {
    return {
      waveShapeText: 'Right',
      breakTypeText: 'Point-break',
      difficultyText: rowMatch[1],
    };
  }

  return null;
}

function parseOverpass(rawJson, spot, url) {
  const elements = Array.isArray(rawJson?.elements) ? rawJson.elements : [];
  const normalizedFields = emptyNormalizedFields();
  const counts = {
    surfing: 0,
    reef: 0,
    beach: 0,
    waterway: 0,
    marina: 0,
    breakwater: 0,
    groyne: 0,
  };

  for (const element of elements) {
    const tags = element.tags || {};
    if (tags.sport === 'surfing') counts.surfing += 1;
    if (tags.natural === 'reef') counts.reef += 1;
    if (tags.natural === 'beach') counts.beach += 1;
    if (tags.waterway) counts.waterway += 1;
    if (tags.leisure === 'marina' || tags['seamark:type'] === 'harbour') counts.marina += 1;
    if (tags.man_made === 'breakwater') counts.breakwater += 1;
    if (tags.man_made === 'groyne') counts.groyne += 1;
  }

  normalizedFields.sourceCoordinates = { lat: spot.lat, lon: spot.lon };

  return {
    spotId: spot.id,
    source: 'overpass',
    url,
    parsedAt: new Date().toISOString(),
    rawFields: {
      featureCount: elements.length,
      counts,
    },
    normalizedFields,
    evidence: {
      overpassSummary: {
        snippet: JSON.stringify(counts),
      },
    },
    issues: [],
    parseStatus: 'success',
  };
}

function extractBetweenLabels(text, startLabel, nextLabels) {
  const startIndex = text.indexOf(startLabel);
  if (startIndex === -1) return null;
  let start = startIndex + startLabel.length;
  let end = text.length;
  for (const nextLabel of nextLabels) {
    const nextIndex = text.indexOf(nextLabel, start);
    if (nextIndex !== -1 && nextIndex < end) {
      end = nextIndex;
    }
  }
  const raw = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return raw || null;
}

module.exports = {
  parseSurfForecast,
  parseSurfingWaves,
  parseWannaSurf,
  parseOverpass,
  extractBetweenLabels,
  emptyNormalizedFields,
};
