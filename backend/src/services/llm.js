const logger = require('../utils/logger');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are a surf conditions analyst. A surfer is describing how their local break responds to different conditions. Based on their description, output weight multipliers for these scoring factors:

- waveHeight: how important is wave size at this spot
- wavePeriod: how important is swell period/quality
- swellQuality: how important is groundswell vs wind swell
- windSpeed: how much does wind speed affect this spot
- windDirection: how much does wind direction matter
- waveDirection: how important is the swell angle

Output ONLY valid JSON with multipliers. Use 1.0 for normal importance, values below 1.0 for less important (min 0.2), above 1.0 for more important (max 2.5). Example: {"waveHeight":1.0,"wavePeriod":1.5,"swellQuality":1.0,"windSpeed":0.5,"windDirection":0.3,"waveDirection":1.2}`;

/**
 * Interpret surfer feedback using Groq/Llama LLM
 * Returns weight multipliers for scoring factors
 */
async function interpretFeedback(text) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    logger.warn('[LLM] No GROQ_API_KEY set, using keyword fallback');
    return keywordFallback(text);
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      logger.warn(`[LLM] Groq API error ${response.status}: ${err}`);
      return keywordFallback(text);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      logger.warn('[LLM] Empty response from Groq');
      return keywordFallback(text);
    }

    const multipliers = JSON.parse(content);
    return validateMultipliers(multipliers);
  } catch (err) {
    logger.warn(`[LLM] Groq call failed: ${err.message}`);
    return keywordFallback(text);
  }
}

/**
 * Validate and clamp multiplier values
 */
function validateMultipliers(raw) {
  const factors = ['waveHeight', 'wavePeriod', 'swellQuality', 'windSpeed', 'windDirection', 'waveDirection'];
  const result = {};
  for (const f of factors) {
    let val = parseFloat(raw[f]);
    if (isNaN(val)) val = 1.0;
    result[f] = Math.max(0.2, Math.min(2.5, val));
  }
  return result;
}

/**
 * Simple keyword-based fallback when no LLM is available
 */
function keywordFallback(text) {
  const lower = text.toLowerCase();
  const result = {
    waveHeight: 1.0,
    wavePeriod: 1.0,
    swellQuality: 1.0,
    windSpeed: 1.0,
    windDirection: 1.0,
    waveDirection: 1.0
  };

  const factorKeywords = {
    waveHeight: ['wave height', 'wave size', 'size', 'big waves', 'small waves', 'height'],
    wavePeriod: ['wave period', 'period', 'swell period', 'long period', 'short period', 'close out'],
    swellQuality: ['groundswell', 'swell quality', 'wind swell', 'swell'],
    windSpeed: ['wind speed', 'wind', 'windy', 'glassy', 'calm', 'blown out'],
    windDirection: ['wind direction', 'offshore', 'onshore', 'cross-shore', 'sheltered', 'cliff', 'block'],
    waveDirection: ['wave direction', 'swell direction', 'swell angle', 'angle', 'direction']
  };

  const morePatterns = ['everything', 'critical', 'most important', 'key', 'matters a lot', 'essential', 'crucial'];
  const lessPatterns = ["doesn't matter", "don't matter", 'barely matters', 'not important', "doesn't affect", 'sheltered', 'protected', 'blocked'];

  for (const [factor, keywords] of Object.entries(factorKeywords)) {
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx === -1) continue;

      // Check surrounding context (50 chars around the keyword)
      const context = lower.slice(Math.max(0, idx - 50), idx + kw.length + 50);

      if (morePatterns.some(p => context.includes(p))) {
        result[factor] = Math.min(result[factor] * 1.8, 2.5);
      }
      if (lessPatterns.some(p => context.includes(p))) {
        result[factor] = Math.max(result[factor] * 0.4, 0.2);
      }
    }
  }

  return result;
}

module.exports = { interpretFeedback };
