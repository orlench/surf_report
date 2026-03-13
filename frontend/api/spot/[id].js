const fs = require('fs');
const path = require('path');

const spots = [
  { id: "herzliya_marina", name: "Herzliya Marina", country: "Israel" },
  { id: "netanya_kontiki", name: "Netanya Kontiki", country: "Israel" },
  { id: "tel_aviv_maaravi", name: "Tel Aviv Maaravi", country: "Israel" },
  { id: "bat_yam", name: "Bat Yam", country: "Israel" },
  { id: "ashkelon", name: "Ashkelon", country: "Israel" },
  { id: "haifa_dado", name: "Haifa Dado Beach", country: "Israel" },
  { id: "caesarea", name: "Caesarea", country: "Israel" },
  { id: "ashdod", name: "Ashdod", country: "Israel" },
  { id: "pipeline", name: "Pipeline", country: "Hawaii, USA" },
  { id: "sunset_beach", name: "Sunset Beach", country: "Hawaii, USA" },
  { id: "waimea_bay", name: "Waimea Bay", country: "Hawaii, USA" },
  { id: "honolua_bay", name: "Honolua Bay", country: "Hawaii, USA" },
  { id: "ocean_beach_sf", name: "Ocean Beach SF", country: "California, USA" },
  { id: "mavericks", name: "Mavericks", country: "California, USA" },
  { id: "steamer_lane", name: "Steamer Lane", country: "California, USA" },
  { id: "trestles", name: "Trestles", country: "California, USA" },
  { id: "huntington_beach", name: "Huntington Beach", country: "California, USA" },
  { id: "rincon", name: "Rincon", country: "California, USA" },
  { id: "blacks_beach", name: "Blacks Beach", country: "California, USA" },
  { id: "malibu_surfrider", name: "Malibu Surfrider", country: "California, USA" },
  { id: "cocoa_beach", name: "Cocoa Beach", country: "Florida, USA" },
  { id: "outer_banks", name: "Outer Banks", country: "North Carolina, USA" },
  { id: "nazare", name: "Nazare", country: "Portugal" },
  { id: "peniche_supertubos", name: "Peniche Supertubos", country: "Portugal" },
  { id: "ericeira", name: "Ericeira", country: "Portugal" },
  { id: "sagres", name: "Sagres", country: "Portugal" },
  { id: "mundaka", name: "Mundaka", country: "Spain" },
  { id: "san_sebastian_zurriola", name: "San Sebastian Zurriola", country: "Spain" },
  { id: "barcelona_barceloneta", name: "Barcelona Barceloneta", country: "Spain" },
  { id: "hossegor", name: "Hossegor", country: "France" },
  { id: "biarritz", name: "Biarritz Grande Plage", country: "France" },
  { id: "lacanau", name: "Lacanau", country: "France" },
  { id: "fistral_beach", name: "Fistral Beach", country: "UK" },
  { id: "bundoran", name: "Bundoran", country: "Ireland" },
  { id: "bells_beach", name: "Bells Beach", country: "Australia" },
  { id: "snapper_rocks", name: "Snapper Rocks", country: "Australia" },
  { id: "margaret_river", name: "Margaret River", country: "Australia" },
  { id: "bondi_beach", name: "Bondi Beach", country: "Australia" },
  { id: "noosa_heads", name: "Noosa Heads", country: "Australia" },
  { id: "uluwatu", name: "Uluwatu", country: "Indonesia" },
  { id: "padang_padang", name: "Padang Padang", country: "Indonesia" },
  { id: "desert_point", name: "Desert Point", country: "Indonesia" },
  { id: "g_land", name: "G-Land", country: "Indonesia" },
  { id: "jeffreys_bay", name: "Jeffreys Bay", country: "South Africa" },
  { id: "dungeons", name: "Dungeons", country: "South Africa" },
  { id: "taghazout", name: "Taghazout", country: "Morocco" },
  { id: "puerto_escondido", name: "Puerto Escondido", country: "Mexico" },
  { id: "playa_hermosa", name: "Playa Hermosa", country: "Costa Rica" },
  { id: "witchs_rock", name: "Witchs Rock", country: "Costa Rica" },
  { id: "punta_de_lobos", name: "Punta de Lobos", country: "Chile" },
  { id: "florianopolis", name: "Florianopolis", country: "Brazil" },
  { id: "teahupoo", name: "Teahupoo", country: "French Polynesia" },
  { id: "cloudbreak", name: "Cloudbreak", country: "Fiji" },
  { id: "shonan", name: "Shonan", country: "Japan" },
  { id: "chiba", name: "Chiba", country: "Japan" },
  { id: "siargao_cloud_9", name: "Siargao Cloud 9", country: "Philippines" },
  { id: "arugam_bay", name: "Arugam Bay", country: "Sri Lanka" },
];

const spotsMap = Object.fromEntries(spots.map(s => [s.id, s]));

let cachedHtml = null;

function getHtml() {
  if (cachedHtml) return cachedHtml;
  // On Vercel, includeFiles makes build/ available relative to project root
  const htmlPath = path.join(process.cwd(), 'build', 'index.html');
  cachedHtml = fs.readFileSync(htmlPath, 'utf8');
  return cachedHtml;
}

function prettifyName(id) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

module.exports = (req, res) => {
  const { id } = req.query;
  const spot = spotsMap[id];
  const name = spot ? spot.name : prettifyName(id);
  const country = spot ? spot.country : '';
  const location = country ? ` in ${country}` : '';

  const title = `${name} Surf Report — Real-Time Conditions & Score`;
  const description = `Should you surf ${name}${location} today? Check real-time wave height, wind, swell period, water temp, and get a surf score from 0-100.`;
  const url = `https://shouldigo.surf/spot/${id}`;

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Beach",
    "name": name,
    "description": description,
    "url": url,
    "isPartOf": {
      "@type": "WebApplication",
      "name": "Should I Go?",
      "url": "https://shouldigo.surf"
    }
  });

  let html = getHtml();

  // Replace title
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${title}</title>`
  );

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${description}"`
  );

  // Replace OG tags
  html = html.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${title}"`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${description}"`
  );

  // Add og:url and canonical
  html = html.replace(
    /<!-- canonical and og:url are set dynamically per spot -->/,
    `<meta property="og:url" content="${url}" />\n    <link rel="canonical" href="${url}" />`
  );

  // Replace Twitter tags
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*"/,
    `<meta name="twitter:title" content="${title}"`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*"/,
    `<meta name="twitter:description" content="${description}"`
  );

  // Add spot-specific structured data before closing </head>
  html = html.replace(
    '</head>',
    `<script type="application/ld+json">${structuredData}</script>\n</head>`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(html);
};
