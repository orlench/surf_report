const { slugify, countryCode } = require('./utils');

const WANNA_COUNTRY_PATHS = {
  Portugal: ['Europe', 'Portugal'],
  'South Africa': ['Africa', 'South_Africa'],
  Mexico: ['Central_America', 'Mexico'],
  'Sri Lanka': ['Asia', 'Sri_Lanka'],
  Fiji: ['Australia_Pacific', 'Fiji'],
  Indonesia: ['Asia', 'Indonesia'],
  USA: ['North_America', 'USA'],
};

const WANNA_SEED_URLS = {
  uluwatu: 'https://www.wannasurf.com/spot/Asia/Indonesia/Bali/Uluwatu',
  jeffreys_bay: 'https://www.wannasurf.com/spot/Africa/South_Africa/South_J_Bay/index.html',
  puerto_escondido: 'https://www.wannasurf.com/spot/Central_America/Mexico/Oaxaca-Chiapas/Puerto_Escondido/index.html',
  arugam_bay: 'https://www.wannasurf.com/spot/Asia/Sri_Lanka/aragum_bay/index.html',
  cloudbreak: 'https://www.wannasurf.com/spot/Australia_Pacific/Fiji/cloudbreak',
};

const SURF_FORECAST_SEED_URLS = {
  pipeline: 'https://www.surf-forecast.com/breaks/Pipeline_1',
  jeffreys_bay: 'https://www.surf-forecast.com/breaks/J-Bay',
  puerto_escondido: 'https://www.surf-forecast.com/breaks/Puerto-Escondido',
  nazare: 'https://www.surf-forecast.com/breaks/Nazare',
  arugam_bay: 'https://www.surf-forecast.com/breaks/Aragum-Bay',
  cloudbreak: 'https://www.surf-forecast.com/breaks/Cloudbreak',
};

const SURFING_WAVES_SEED_URLS = {};

const SOURCE_CONFIGS = {
  'surf-forecast': {
    key: 'surf-forecast',
    displayName: 'Surf-Forecast',
    domain: 'www.surf-forecast.com',
    prefersUrl(url) {
      return /^https:\/\/www\.surf-forecast\.com\/breaks\/[^/?#]+\/?$/.test(url);
    },
    rejectsUrl(url) {
      return !/^https:\/\/www\.surf-forecast\.com\/breaks\/[^/?#]+\/?$/.test(url);
    },
    extractCandidateLabel(candidate) {
      const title = String(candidate.title || '');
      const titleMatch = title.match(/^(.+?)\s+Surf Forecast/i);
      if (titleMatch) return titleMatch[1];
      const url = String(candidate.url || '');
      const slugMatch = url.match(/\/breaks\/([^/?#]+)/i);
      return slugMatch ? slugMatch[1].replace(/[_-]+/g, ' ') : title;
    },
    seedUrls(spot) {
      const seed = SURF_FORECAST_SEED_URLS[spot.id];
      return seed ? [seed] : [];
    },
    guessUrls(spot) {
      const variants = [spot.name, ...(spot.aliases || [])];
      const urls = [];
      urls.push(...this.seedUrls(spot));
      for (const variant of variants) {
        const dash = slugify(variant, '-');
        const underscore = slugify(variant, '_');
        urls.push(`https://www.surf-forecast.com/breaks/${dash}`);
        urls.push(`https://www.surf-forecast.com/breaks/${underscore}`);
        urls.push(`https://www.surf-forecast.com/breaks/${underscore}_1`);
      }
      return urls;
    },
    buildQueries(spot) {
      const aliases = [spot.name, ...(spot.aliases || [])];
      return aliases.flatMap((alias) => ([
        {
          query: `site:surf-forecast.com/breaks "${alias}" "${spot.country}"`,
          engine: 'google',
          geoLocation: countryCode(spot.country),
        },
      ]));
    },
  },
  'surfing-waves': {
    key: 'surfing-waves',
    displayName: 'Surfing-Waves',
    domain: 'surfing-waves.com',
    prefersUrl(url) {
      return /^https:\/\/surfing-waves\.com\/atlas\/.+\/spot\/[^/]+\.html$/.test(url);
    },
    rejectsUrl(url) {
      return !/^https:\/\/surfing-waves\.com\/atlas\/.+\/spot\/[^/]+\.html$/.test(url) || /\/(register|logon)\//.test(url);
    },
    extractCandidateLabel(candidate) {
      const title = String(candidate.title || '');
      const surfingAtMatch = title.match(/^Surfing at\s+(.+?)\s+in\s+/i);
      if (surfingAtMatch) return surfingAtMatch[1];
      if (title.includes(' - ')) return title.split(' - ')[0];
      const url = String(candidate.url || '');
      const slugMatch = url.match(/\/spot\/([^/]+)\.html$/i);
      return slugMatch ? slugMatch[1].replace(/[_-]+/g, ' ') : title;
    },
    seedUrls(spot) {
      const seed = SURFING_WAVES_SEED_URLS[spot.id];
      return seed ? [seed] : [];
    },
    guessUrls(spot) {
      return this.seedUrls(spot);
    },
    buildQueries(spot) {
      const aliases = [spot.name, ...(spot.aliases || [])];
      return aliases.map((alias) => ({
        query: `site:surfing-waves.com/atlas "${alias}" "${spot.country}"`,
        engine: 'google',
        geoLocation: countryCode(spot.country),
      }));
    },
  },
  wannasurf: {
    key: 'wannasurf',
    displayName: 'WannaSurf',
    domain: 'www.wannasurf.com',
    prefersUrl(url) {
      return /wannasurf\.com\/spot\//.test(url) && !/WD_SKIPMOBILEAPP/.test(url);
    },
    rejectsUrl(url) {
      return /WD_SKIPMOBILEAPP/.test(url) || !/wannasurf\.com\/spot\//.test(url);
    },
    extractCandidateLabel(candidate) {
      const title = String(candidate.title || '');
      const titleMatch = title.match(/^(.+?)\s+-\s+Surfing/i);
      if (titleMatch) return titleMatch[1];
      const url = String(candidate.url || '');
      const indexMatch = url.match(/\/spot\/.+\/([^/]+)\/index\.html$/i);
      if (indexMatch) return indexMatch[1].replace(/[_-]+/g, ' ');
      const slugMatch = url.match(/\/spot\/.+\/([^/?#]+)$/i);
      return slugMatch ? slugMatch[1].replace(/[_-]+/g, ' ') : title;
    },
    countryPathParts(spot) {
      return WANNA_COUNTRY_PATHS[spot.country] || null;
    },
    indexUrls(spot) {
      const pathParts = this.countryPathParts(spot);
      if (!pathParts) return [];
      return [
        `https://www.wannasurf.com/spot/${pathParts.join('/')}/index.html`,
      ];
    },
    seedUrls(spot) {
      const seed = WANNA_SEED_URLS[spot.id];
      return seed ? [seed] : [];
    },
    guessUrls(spot) {
      const urls = [];
      urls.push(...this.seedUrls(spot));

      const pathParts = WANNA_COUNTRY_PATHS[spot.country];
      if (!pathParts) return urls;

      const aliases = [spot.name, ...(spot.aliases || [])];
      for (const alias of aliases) {
        urls.push(`https://www.wannasurf.com/spot/${pathParts.join('/')}/${slugify(alias)}`);
        urls.push(`https://www.wannasurf.com/spot/${pathParts.join('/')}/${slugify(alias)}/index.html`);
      }
      return urls;
    },
    buildQueries(spot) {
      const aliases = [spot.name, ...(spot.aliases || [])];
      return aliases.flatMap((alias) => ([
        {
          query: `site:wannasurf.com/spot/ "${alias}" "${spot.country}"`,
          engine: 'google',
          geoLocation: countryCode(spot.country),
        },
        {
          query: `"WannaSurf" "${alias}" "${spot.country}"`,
          engine: 'google',
          geoLocation: countryCode(spot.country),
        },
        ...(spot.region ? [{
          query: `site:wannasurf.com/spot/ "${alias}" "${spot.region}" "${spot.country}"`,
          engine: 'google',
          geoLocation: countryCode(spot.country),
        }] : []),
        {
          query: `site:wannasurf.com/spot/ "${alias}"`,
          engine: 'google',
          geoLocation: countryCode(spot.country),
        },
      ]));
    },
  },
  overpass: {
    key: 'overpass',
    displayName: 'Overpass',
    endpoint: 'https://overpass-api.de/api/interpreter',
  },
};

module.exports = { SOURCE_CONFIGS };
