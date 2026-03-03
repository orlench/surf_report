import { useState, useEffect, useRef } from 'react';
import rough from 'roughjs';
import './BeachSketch.css';

// ─── Direction lookup ────────────────────────────────────────────────────────
const DIR_DEG = {
  N: 0,   NNE: 22.5, NE: 45,  ENE: 67.5,
  E: 90,  ESE: 112.5,SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5,SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5,NW: 315, NNW: 337.5,
};

const W = 400, H = 220;

// Module-level cache — persists per session, keyed by spotId or lat/lon
const osmCache = new Map();

// ─── Compass degrees → SVG unit vector ──────────────────────────────────────
function compassToVec(deg) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

// ─── Overpass API fetch ──────────────────────────────────────────────────────
async function fetchOSMBeach(lat, lon, signal) {
  const q = `[out:json][timeout:12];`
    + `(way["natural"="beach"](around:2000,${lat},${lon});`
    + `way["natural"="coastline"](around:500,${lat},${lon}););`
    + `out geom;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Overpass error');
  const { elements } = await res.json();

  const beaches = elements.filter(e => e.tags?.natural === 'beach'     && e.geometry?.length > 2);
  const coasts  = elements.filter(e => e.tags?.natural === 'coastline' && e.geometry?.length > 2);
  const ways = beaches.length ? beaches : coasts;
  if (!ways.length) return null;

  const way = ways.reduce((a, b) => (a.geometry.length > b.geometry.length ? a : b));
  let nodes = way.geometry;

  if (nodes.length > 80) {
    const step = Math.ceil(nodes.length / 80);
    nodes = nodes.filter((_, i) => i % step === 0);
    const last = way.geometry[way.geometry.length - 1];
    if (nodes[nodes.length - 1] !== last) nodes.push(last);
  }

  const lats = nodes.map(n => n.lat), lons = nodes.map(n => n.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const padLat = (maxLat - minLat) * 0.5 + 0.001;
  const padLon = (maxLon - minLon) * 0.5 + 0.001;
  const bMinLat = minLat - padLat, bMaxLat = maxLat + padLat;
  const bMinLon = minLon - padLon, bMaxLon = maxLon + padLon;

  const proj = ({ lat, lon }) => ({
    x: ((lon - bMinLon) / (bMaxLon - bMinLon)) * W,
    y: ((bMaxLat - lat) / (bMaxLat - bMinLat)) * H,
  });
  const pts = nodes.map(proj);
  const isArea = beaches.length > 0;
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    + (isArea ? ' Z' : '');

  const shoreAngle = Math.atan2(
    pts[pts.length - 1].y - pts[0].y,
    pts[pts.length - 1].x - pts[0].x
  );
  const mid = pts[Math.floor(pts.length / 2)];
  // pts included so the draw layer can build a beach strip for non-area ways
  return { d, pts, shoreAngle, mid, isArea };
}

// ─── Fallback: generic beach arc perpendicular to wave travel ───────────────
function makeFallback(travelDeg) {
  const tv = compassToVec(travelDeg);
  const pv = { x: -tv.y, y: tv.x };
  const cx = W / 2 + tv.x * 35, cy = H / 2 + tv.y * 35;
  const halfLen = 130, sag = 22;
  const p1 = { x: cx - pv.x * halfLen, y: cy - pv.y * halfLen };
  const cp = { x: cx - tv.x * sag,     y: cy - tv.y * sag };
  const p2 = { x: cx + pv.x * halfLen, y: cy + pv.y * halfLen };
  return {
    d: `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${cp.x.toFixed(1)},${cp.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
    pts: null, // no raw points for fallback
    shoreAngle: Math.atan2(pv.y, pv.x),
    mid: { x: cx, y: cy },
    isArea: false,
    isFallback: true,
  };
}

// ─── Wind relation ────────────────────────────────────────────────────────────
function windRelation(waveDeg, windDeg) {
  const diff = Math.abs(((waveDeg - windDeg + 540) % 360) - 180);
  if (diff < 50)  return 'Onshore wind';
  if (diff > 130) return 'Offshore wind';
  return 'Cross-shore wind';
}

// ─── Helper: shore-parallel arc path ────────────────────────────────────────
function shoreParallelArc(mid, seaVec, dist, halfLen, shoreAngle, bowExtra = 8) {
  const cx = mid.x + seaVec.x * dist, cy = mid.y + seaVec.y * dist;
  const pv = { x: Math.cos(shoreAngle), y: Math.sin(shoreAngle) };
  const p1 = { x: cx - pv.x * halfLen, y: cy - pv.y * halfLen };
  const p2 = { x: cx + pv.x * halfLen, y: cy + pv.y * halfLen };
  const cp = { x: cx + seaVec.x * (bowExtra + dist * 0.05), y: cy + seaVec.y * (bowExtra + dist * 0.05) };
  return `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${cp.x.toFixed(1)},${cp.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
}

// ─── Helper: beach strip path from coastline points ──────────────────────────
// Converts an open line (pts) into a closed filled strip by offsetting
// each point inland, so hachure fill shows even for coastline-only data.
function makeStripPath(pts, inlandVec, width = 22) {
  const fwd  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  const back = [...pts].reverse()
    .map(p => `L${(p.x + inlandVec.x * width).toFixed(1)},${(p.y + inlandVec.y * width).toFixed(1)}`);
  return fwd.join(' ') + ' ' + back.join(' ') + ' Z';
}

// ─── Helper: max distance seaward that stays within canvas ───────────────────
function maxSeawardDist(mid, vec, margin = 18) {
  const bounds = [
    vec.x >  0.01 ? (W - margin - mid.x) / vec.x : Infinity,
    vec.x < -0.01 ? (margin - mid.x)     / vec.x : Infinity,
    vec.y >  0.01 ? (H - margin - mid.y) / vec.y : Infinity,
    vec.y < -0.01 ? (margin - mid.y)     / vec.y : Infinity,
  ];
  return Math.min(160, ...bounds.filter(v => v > 0));
}

// ─── Helper: direction arrow ─────────────────────────────────────────────────
function drawArrow(rc, parent, cx, cy, travelVec, len, color, roughness, seed, dashArray) {
  const hw = 5, hl = 9;
  const s = { x: cx - travelVec.x * len / 2, y: cy - travelVec.y * len / 2 };
  const e = { x: cx + travelVec.x * len / 2, y: cy + travelVec.y * len / 2 };
  const pv = { x: -travelVec.y, y: travelVec.x };

  const lineEl = rc.line(s.x, s.y, e.x, e.y, { roughness, stroke: color, strokeWidth: 2.0, seed });
  if (dashArray) {
    lineEl.querySelectorAll('path').forEach(p => p.setAttribute('stroke-dasharray', dashArray));
  }
  parent.appendChild(lineEl);

  parent.appendChild(rc.polygon(
    [
      [e.x, e.y],
      [e.x - travelVec.x * hl + pv.x * hw, e.y - travelVec.y * hl + pv.y * hw],
      [e.x - travelVec.x * hl - pv.x * hw, e.y - travelVec.y * hl - pv.y * hw],
    ],
    { roughness: 0.8, stroke: color, fill: color, fillStyle: 'solid', seed: seed + 1 }
  ));
}

// ─── Helper: SVG text label with background pill ─────────────────────────────
function addLabel(parent, x, y, text, color) {
  const approxW = text.length * 5.2 + 6;
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x',      (x - approxW / 2).toFixed(1));
  bg.setAttribute('y',      (y - 8).toFixed(1));
  bg.setAttribute('width',  approxW.toFixed(1));
  bg.setAttribute('height', '10');
  bg.setAttribute('rx',     '2');
  bg.setAttribute('fill',        'white');
  bg.setAttribute('fill-opacity','0.75');
  parent.appendChild(bg);

  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x',           x.toFixed(1));
  t.setAttribute('y',           y.toFixed(1));
  t.setAttribute('fill',        color);
  t.setAttribute('font-size',   '7.5');
  t.setAttribute('font-family', 'Georgia, serif');
  t.setAttribute('font-weight', '600');
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('letter-spacing', '0.5');
  t.textContent = text;
  parent.appendChild(t);
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function BeachSketch({ spot, waveDirection, windDirection }) {
  const [osmGeom, setOsmGeom] = useState(undefined);
  const svgRef    = useRef(null);
  const sketchRef = useRef(null);
  const waveRef   = useRef(null);

  const lat     = spot?.location?.lat;
  const lon     = spot?.location?.lon;
  const spotKey = spot?.id || (lat != null ? `${lat.toFixed(4)},${lon.toFixed(4)}` : null);
  const waveDeg = DIR_DEG[waveDirection];
  const windDeg = DIR_DEG[windDirection];

  // ── Fetch OSM geometry ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!lat || !lon || !spotKey) return;
    if (osmCache.has(spotKey)) { setOsmGeom(osmCache.get(spotKey)); return; }

    setOsmGeom(undefined);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    fetchOSMBeach(lat, lon, controller.signal)
      .then(r  => { clearTimeout(timer); osmCache.set(spotKey, r);    setOsmGeom(r);    })
      .catch(e => {
        clearTimeout(timer);
        if (e.name === 'AbortError') return;
        osmCache.set(spotKey, null);
        setOsmGeom(null);
      });

    return () => { clearTimeout(timer); controller.abort(); };
  }, [lat, lon, spotKey]);

  // ── Rough.js draw ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !sketchRef.current || !waveRef.current) return;
    if (waveDeg === undefined || osmGeom === undefined) return;

    const geom = osmGeom ?? (waveDeg !== undefined ? makeFallback((waveDeg + 180) % 360) : null);
    if (!geom) return;

    sketchRef.current.innerHTML = '';
    waveRef.current.innerHTML   = '';

    try {
      const rc = rough.svg(svgRef.current);
      const { mid, shoreAngle, isArea, d, pts } = geom;

      // seaVec: unit vector FROM shore TOWARD sea
      const seaVec    = compassToVec(waveDeg);
      const inlandVec = { x: -seaVec.x, y: -seaVec.y };
      const shorePv   = { x: Math.cos(shoreAngle), y: Math.sin(shoreAngle) };

      // ── 1. Bathymetry contour arcs ──────────────────────────────────────────
      [
        { dist: 32,  halfLen: 105, width: 1.15, opacity: 0.50, roughness: 1.2, seed: 300 },
        { dist: 70,  halfLen: 120, width: 0.90, opacity: 0.35, roughness: 1.4, seed: 301 },
        { dist: 115, halfLen: 108, width: 0.70, opacity: 0.22, roughness: 1.6, seed: 302 },
      ].forEach(({ dist, halfLen, width, opacity, roughness, seed }) => {
        const el = sketchRef.current.appendChild(
          rc.path(shoreParallelArc(mid, seaVec, dist, halfLen, shoreAngle), {
            roughness, stroke: '#60a5fa', strokeWidth: width, fill: 'none', seed,
          })
        );
        el.style.opacity = String(opacity);
      });

      // ── 2. Beach shape ──────────────────────────────────────────────────────
      // For area polygons, use the original closed path.
      // For coastline lines, build a filled strip by offsetting inland — this
      // gives a proper hachure-filled beach even when OSM only has a coastline.
      const beachD = (isArea || !pts) ? d : makeStripPath(pts, inlandVec, 22);
      sketchRef.current.appendChild(rc.path(beachD, {
        roughness:    1.5,
        stroke:       '#8a7560',
        strokeWidth:  isArea ? 1.4 : 1.8,
        fill:         '#e6d49a',
        fillStyle:    'hachure',
        fillWeight:   0.6,
        hachureGap:   9,
        hachureAngle: 40,
        seed:         42,
      }));

      // ── 3. Foam / shore-break zone ──────────────────────────────────────────
      // Always traces the original shoreline path `d`.
      const foamEl = sketchRef.current.appendChild(rc.path(d, {
        roughness:   3.0,
        stroke:      '#bfdbfe',
        strokeWidth: isArea ? 4.5 : 3.0,
        fill:        'none',
        seed:        43,
      }));
      foamEl.style.opacity = '0.7';

      // ── 4. Wave crest lines (shore-parallel, animated) ──────────────────────
      [
        { dist: 10,  halfLen: 55,  roughness: 2.8, width: 1.9, delay: 0    },
        { dist: 45,  halfLen: 68,  roughness: 2.4, width: 1.6, delay: 0.5  },
        { dist: 83,  halfLen: 72,  roughness: 2.1, width: 1.35,delay: 1.0  },
        { dist: 125, halfLen: 65,  roughness: 1.9, width: 1.1, delay: 1.5  },
        { dist: 168, halfLen: 55,  roughness: 1.7, width: 0.9, delay: 2.0  },
      ].forEach(({ dist, halfLen, roughness, width, delay }, i) => {
        const el = rc.path(
          shoreParallelArc(mid, seaVec, dist, halfLen, shoreAngle),
          { roughness, stroke: '#3b82f6', strokeWidth: width, fill: 'none', seed: 100 + i }
        );
        el.classList.add('beach-wave-line');
        el.style.opacity        = String(0.65 - i * 0.09);
        el.style.animationDelay = `${delay}s`;
        waveRef.current.appendChild(el);
      });

      // ── 5. Swell direction arrow (blue) ─────────────────────────────────────
      // waveTravelVec: waves move from sea toward shore
      const waveTravelVec = inlandVec;
      const seaDist = maxSeawardDist(mid, seaVec);
      const wvCx = mid.x + seaVec.x * seaDist * 0.70 + shorePv.x * 30;
      const wvCy = mid.y + seaVec.y * seaDist * 0.70 + shorePv.y * 30;
      drawArrow(rc, sketchRef.current, wvCx, wvCy, waveTravelVec, 44, '#2563eb', 2.0, 410, null);
      // Label placed seaward of arrow center
      addLabel(sketchRef.current,
        wvCx + seaVec.x * 26,
        wvCy + seaVec.y * 26 + 2,
        'SWELL', '#2563eb');

      // ── 6. Wind direction arrow (amber, dashed) ─────────────────────────────
      if (windDeg !== undefined) {
        const windTV = compassToVec((windDeg + 180) % 360);
        const wdCx = mid.x + seaVec.x * seaDist * 0.55 + shorePv.x * (-35);
        const wdCy = mid.y + seaVec.y * seaDist * 0.55 + shorePv.y * (-35);
        drawArrow(rc, sketchRef.current, wdCx, wdCy, windTV, 36, '#f59e0b', 1.5, 420, '5 3');
        // Label placed in the upwind direction from arrow center
        addLabel(sketchRef.current,
          wdCx - windTV.x * 22,
          wdCy - windTV.y * 22 + 2,
          'WIND', '#f59e0b');
      }

    } catch (_) {
      sketchRef.current.innerHTML = '';
      waveRef.current.innerHTML   = '';
    }
  }, [osmGeom, waveDeg, windDeg]);

  if (!lat || !lon || waveDeg === undefined) return null;

  const travelDeg = (waveDeg + 180) % 360;
  const geom      = osmGeom === undefined ? null : (osmGeom ?? makeFallback(travelDeg));
  const windLabel = windDeg !== undefined ? windRelation(waveDeg, windDeg) : null;

  return (
    <div className="beach-sketch-card">
      <h3 className="beach-sketch-title">Beach View</h3>

      {osmGeom === undefined && <div className="beach-sketch-loading" />}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`beach-sketch-svg${osmGeom === undefined ? ' beach-sketch-svg--hidden' : ''}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={W} height={H} fill="#e8f4fd" opacity="0.4" rx="6" />

        <g ref={sketchRef} />
        <g ref={waveRef} />

        {/* Compass rose */}
        <text x={W - 13} y={14} textAnchor="middle" fontSize="10" fill="#a0aec0" fontWeight="700">N</text>
        <line x1={W - 13} y1={18} x2={W - 13} y2={27} stroke="#a0aec0" strokeWidth="1.2" />
        <polygon points={`${W - 13},18 ${W - 16.5},25 ${W - 9.5},25`} fill="#a0aec0" />

        {/* Legend — bottom-left */}
        <g transform={`translate(7, ${H - 32})`}>
          <rect x="-3" y="-6" width="66" height="30" rx="3" fill="white" fillOpacity="0.75" />
          <line x1="0" y1="5"  x2="16" y2="5"  stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
          <text x="19" y="8"  fontSize="7.5" fill="#2563eb" fontFamily="Georgia, serif" fontWeight="600">SWELL</text>
          {windDeg !== undefined && (
            <>
              <line x1="0"  y1="17" x2="7"  y2="17" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="10" y1="17" x2="16" y2="17" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
              <text x="19" y="20" fontSize="7.5" fill="#f59e0b" fontFamily="Georgia, serif" fontWeight="600">WIND</text>
            </>
          )}
        </g>
      </svg>

      {geom && (
        <div className="beach-sketch-footer">
          {waveDirection && (
            <span className="beach-sketch-wind" style={{ color: '#2563eb', fontWeight: 700 }}>
              Swell {waveDirection}
            </span>
          )}
          {windLabel && (
            <span className="beach-sketch-wind">
              {windLabel}{windDirection ? ` (${windDirection})` : ''}
            </span>
          )}
          {geom.isFallback && <span className="beach-sketch-note">Approximate shape</span>}
        </div>
      )}
    </div>
  );
}
