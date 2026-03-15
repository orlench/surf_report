import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSpots, fetchConditions, fetchConditionsByCoords, createSpot } from '../api/surfApi';
import useGeoDetect from '../hooks/useGeoDetect';
import useSSEProgress from '../hooks/useSSEProgress';
import ScoreDisplay from './ScoreDisplay';
import { getBoardSVG } from './BoardIllustrations';
import SpotSelector from './SpotSelector';
const SpotMap = lazy(() => import('./SpotMap'));
import SpotFeedback from './SpotFeedback';
import NotificationBell from './NotificationBell';
import ProgressScreen from './ProgressScreen';
import SkeletonDashboard from './SkeletonDashboard';
import BeachSketch from './BeachSketch';
import './Dashboard.css';

function trackUtmCampaign() {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source');
  if (!source || !window.gtag) return;
  const medium = params.get('utm_medium') || '';
  const campaign = params.get('utm_campaign') || '';
  window.gtag('event', 'campaign_visit', {
    campaign_source: source,
    campaign_medium: medium,
    campaign_name: campaign,
  });
  // Store source for conversion attribution
  sessionStorage.setItem('utm_source', source);
  sessionStorage.setItem('utm_campaign', campaign);
}

function trackConversion(action) {
  if (!window.gtag) return;
  window.gtag('event', action, {
    campaign_source: sessionStorage.getItem('utm_source') || 'direct',
    campaign_name: sessionStorage.getItem('utm_campaign') || '',
  });
}

function getInitialSpot() {
  // Support clean /spot/:id path URLs (for SEO + sitemap)
  const pathMatch = window.location.pathname.match(/^\/spot\/([^/]+)$/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);

  const params = new URLSearchParams(window.location.search);
  const urlSpot = params.get('spot');

  // Support shared links with coordinates: ?lat=XX&lon=YY&name=SpotName
  const lat = params.get('lat');
  const lon = params.get('lon');
  const name = params.get('name');
  if (lat && lon && name) {
    const id = slugify(name);
    const customSpots = JSON.parse(localStorage.getItem('customSpots') || '[]');
    if (!customSpots.find(s => s.id === id)) {
      customSpots.push({ id, name, lat: parseFloat(lat), lon: parseFloat(lon), country: params.get('country') || '' });
      localStorage.setItem('customSpots', JSON.stringify(customSpots));
    }
    return id;
  }

  if (urlSpot) return urlSpot;
  return localStorage.getItem('selectedSpot') || null;
}

/**
 * Check if a spot ID is a custom (map-discovered) spot and return its metadata.
 * Returns null for hardcoded spots.
 */
function getCustomSpotMeta(spotId) {
  try {
    const customSpots = JSON.parse(localStorage.getItem('customSpots') || '[]');
    return customSpots.find(s => s.id === spotId) || null;
  } catch { return null; }
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function getRecentCustomSpots() {
  try {
    return JSON.parse(localStorage.getItem('customSpots') || '[]');
  } catch { return []; }
}

function getWetsuitHint(temp) {
  if (!temp) return null;
  if (temp >= 24) return { label: 'Boardshorts', icon: 'shorts' };
  if (temp >= 20) return { label: 'Spring Suit', icon: 'suit' };
  if (temp >= 16) return { label: '3/2 Wetsuit', icon: 'suit' };
  return { label: '4/3 Wetsuit', icon: 'suit' };
}

function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedSpot, setSelectedSpot] = useState(getInitialSpot);
  const [showErrorMap, setShowErrorMap] = useState(false);
  const [adjustedScore, setAdjustedScore] = useState(null);
  const [adjustedRating, setAdjustedRating] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [userWeight, setUserWeight] = useState(
    () => localStorage.getItem('userWeight') || ''
  );
  const [userSkill, setUserSkill] = useState(
    () => localStorage.getItem('userSkill') || ''
  );

  // Progress screen flow
  const isFirstVisitRef = useRef(selectedSpot === null);
  const [showProgressScreen, setShowProgressScreen] = useState(true);
  const skeletonTimerRef = useRef(null);
  // After 3s still loading: drop ProgressScreen so skeleton auto-shows
  // (skeleton renders whenever !showProgressScreen && !conditions)
  const startSkeletonTimer = useCallback(() => {
    clearTimeout(skeletonTimerRef.current);
    skeletonTimerRef.current = setTimeout(() => {
      setShowProgressScreen(false);
    }, 3000);
  }, []);
  const cancelSkeletonTimer = useCallback(() => {
    clearTimeout(skeletonTimerRef.current);
  }, []);
  const { location, nearestSpot, nearestSpotName, nearbySpots, isDetecting } = useGeoDetect(isFirstVisitRef.current);
  const { steps: sseSteps, total: sseTotal, isStreaming, finalData, error: sseError, startStream, cleanup } = useSSEProgress();

  // Track UTM campaign params on first load
  useEffect(() => {
    trackUtmCampaign();
  }, []);

  // Track spot check conversions
  const spotCheckCount = useRef(0);

  // Start SSE for returning users on mount (skip SSE for custom/map spots)
  useEffect(() => {
    if (isFirstVisitRef.current || !selectedSpot) return;
    const customMeta = getCustomSpotMeta(selectedSpot);
    if (customMeta) {
      setShowProgressScreen(false);
      createSpot(customMeta).catch(() => {});
    } else {
      startStream(selectedSpot);
      startSkeletonTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When geo resolves (first visit), set spot + start SSE stream
  useEffect(() => {
    if (!isFirstVisitRef.current || !nearestSpot || isDetecting) return;
    setSelectedSpot(nearestSpot);
    localStorage.setItem('selectedSpot', nearestSpot);
    const url = new URL(window.location);
    url.searchParams.set('spot', nearestSpot);
    window.history.replaceState({}, '', url);
    startStream(nearestSpot);
    startSkeletonTimer();
    isFirstVisitRef.current = false;
  }, [nearestSpot, isDetecting, startStream, startSkeletonTimer]);

  // When SSE completes, seed React Query cache and dismiss progress screen
  useEffect(() => {
    if (!finalData) return;
    queryClient.setQueryData(
      ['conditions', finalData.spotId, userWeight, userSkill],
      finalData
    );
    cancelSkeletonTimer();
    // If response came from cache (no scraper steps were shown), dismiss instantly.
    // Otherwise hold for 800ms so the user sees the completed step list briefly.
    const delay = finalData.fromCache ? 0 : 800;
    const timer = setTimeout(() => {
      setShowProgressScreen(false);
      cleanup();
    }, delay);
    return () => clearTimeout(timer);
  }, [finalData, queryClient, userWeight, userSkill, cleanup, cancelSkeletonTimer]);

  // SSE error fallback: dismiss progress screen so skeleton auto-shows
  // while React Query fetches the fallback REST endpoint
  useEffect(() => {
    if (!sseError) return;
    cancelSkeletonTimer();
    setShowProgressScreen(false);
    cleanup();
  }, [sseError, cleanup, cancelSkeletonTimer]);

  // Build geo/spot steps for ProgressScreen (only on first visit)
  const geoStep = isFirstVisitRef.current && showProgressScreen ? {
    status: isDetecting ? 'loading' : 'done',
    snippet: location ? `${location.city || ''}, ${location.country || ''}`.replace(/^, |, $/g, '') : null,
  } : null;
  const spotStep = isFirstVisitRef.current && showProgressScreen && !isDetecting ? {
    status: nearestSpot ? 'done' : 'loading',
    snippet: nearestSpotName || null,
  } : null;

  const handleSpotChange = useCallback((spotId, providedMeta) => {
    setSelectedSpot(spotId);
    setAdjustedScore(null);
    setAdjustedRating(null);

    const customMeta = providedMeta || getCustomSpotMeta(spotId);
    if (customMeta) {
      // Custom/map spot: skip SSE, show inline skeleton immediately
      setShowProgressScreen(false);
      createSpot(customMeta).catch(() => {});
    } else {
      // Hardcoded spot: full SSE progress flow
      setShowProgressScreen(true);
      startStream(spotId);
      startSkeletonTimer();
    }

    localStorage.setItem('selectedSpot', spotId);
    const url = new URL(window.location);
    url.searchParams.set('spot', spotId);
    window.history.replaceState({}, '', url);

    // Track spot view in Google Analytics
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_location: url.href,
        page_title: `${spotId} — Should I Go?`,
      });
    }

    // Track spot check conversions for campaign attribution
    spotCheckCount.current += 1;
    if (spotCheckCount.current === 1) {
      trackConversion('first_spot_check');
    } else if (spotCheckCount.current === 2) {
      trackConversion('second_spot_check');
    }
  }, [startStream, startSkeletonTimer]);

  // Keep URL in sync with selected spot
  useEffect(() => {
    const url = new URL(window.location);
    if (url.searchParams.get('spot') !== selectedSpot) {
      url.searchParams.set('spot', selectedSpot);
      window.history.replaceState({}, '', url);
    }
  }, [selectedSpot]);

  // PWA install prompt
  useEffect(() => {
    if (localStorage.getItem('pwaInstallDismissed')) return;
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const { data: spots } = useQuery({
    queryKey: ['spots'],
    queryFn: fetchSpots,
  });

  const {
    data: conditions,
    error,
    isPending: conditionsLoading,
  } = useQuery({
    queryKey: ['conditions', selectedSpot, userWeight, userSkill],
    queryFn: () => {
      const customMeta = getCustomSpotMeta(selectedSpot);
      if (customMeta) {
        return fetchConditionsByCoords(customMeta.lat, customMeta.lon, customMeta.name, customMeta.country, {
          weight: userWeight || undefined,
          skill: userSkill || undefined
        });
      }
      return fetchConditions(selectedSpot, {
        weight: userWeight || undefined,
        skill: userSkill || undefined
      });
    },
    refetchInterval: 10 * 60 * 1000,
    enabled: !!selectedSpot && !showProgressScreen,
  });

  // Throttle refresh to once per 5 seconds
  const lastRefresh = useRef(0);
  const handleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefresh.current < 5000) return;
    lastRefresh.current = now;
    setShowProgressScreen(true);
    startStream(selectedSpot);
    startSkeletonTimer();
  }, [startStream, selectedSpot, startSkeletonTimer]);

  const currentSpotName = conditions?.spotName
    || spots?.find(s => s.id === selectedSpot)?.name
    || getCustomSpotMeta(selectedSpot)?.name
    || (selectedSpot ? selectedSpot.replace(/_/g, ' ') : '');

  // Dynamic page title, canonical URL, and OG tags for SEO
  useEffect(() => {
    const pageUrl = selectedSpot
      ? `https://shouldigo.surf/spot/${selectedSpot}`
      : 'https://shouldigo.surf';

    if (conditions && currentSpotName) {
      const score = conditions.score?.overall;
      document.title = score != null
        ? `${currentSpotName} Surf Report — ${score}/100 | Should I Go?`
        : `${currentSpotName} — Should I Go?`;

      // Update OG tags
      const setMeta = (prop, content) => {
        let el = document.querySelector(`meta[property="${prop}"]`) || document.querySelector(`meta[name="${prop}"]`);
        if (el) el.setAttribute('content', content);
      };
      setMeta('og:title', document.title);
      setMeta('og:url', pageUrl);
      const desc = `Real-time surf conditions for ${currentSpotName}. Wave height, wind, swell period & water temp.`;
      setMeta('og:description', desc);
      setMeta('description', desc);
      setMeta('twitter:title', document.title);
      setMeta('twitter:description', desc);
    } else {
      document.title = 'Should I Go? — Real-Time Surf Conditions & Score';
    }

    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = pageUrl;
  }, [conditions, currentSpotName, selectedSpot]);

  // Resolve spot coordinates for beach sketch (works for both hardcoded and custom spots)
  const spotObj = spots?.find(s => s.id === selectedSpot);
  const customMeta = getCustomSpotMeta(selectedSpot);
  const sketchSpot = spotObj
    ? spotObj
    : customMeta
      ? { id: customMeta.id, location: { lat: customMeta.lat, lon: customMeta.lon } }
      : null;

  // Show inline skeleton sections for map/custom spots while React Query is loading
  // (conditionsLoading is true when query is pending with no data yet)
  const showSkeletonSections = !!customMeta && !showProgressScreen && conditionsLoading;

  const is404 = error?.response?.status === 404 || error?.message?.includes('404');

  if (error) {
    return (
      <div className="dashboard">
        <div className="top-bar">
          <div className="top-bar-brand">
            <svg className="top-bar-icon" viewBox="0 0 28 28" fill="none">
              <path d="M2 20c3-6 7-10 12-10s8 3 12 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M5 18c2.5-4 5.5-7 9-7s6 2 9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
            </svg>{/* sad face for error state */}
            <span className="top-bar-title">Should I Go?</span>
          </div>
          <div className="top-bar-actions">
            <NotificationBell currentSpotId={selectedSpot} currentSpotName={currentSpotName} />
            <SpotSelector spots={spots} value={selectedSpot} onChange={handleSpotChange} nearbySpots={nearbySpots} />
          </div>
        </div>

        <div className="error-page">
          <div className="error-page-wave">
            <svg viewBox="0 0 120 60" fill="none" width="120" height="60">
              <path d="M10 50 Q30 10 50 30 T90 20 T120 40" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
              <path d="M0 55 Q25 25 45 40 T85 30 T115 45" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3" />
              {is404 && <text x="42" y="55" fill="#3b82f6" fontSize="14" fontWeight="bold" opacity="0.6">?</text>}
            </svg>
          </div>
          {is404 ? (
            <>
              <h2 className="error-page-title">Wipeout!</h2>
              <p className="error-page-subtitle">This spot got lost at sea</p>
              <p className="error-page-detail">
                The spot "{selectedSpot.replace(/_/g, ' ')}" doesn't exist or the link might be broken.
                No worries — plenty of waves out there.
              </p>
            </>
          ) : (
            <>
              <h2 className="error-page-title">Seas are rough</h2>
              <p className="error-page-subtitle">Couldn't load conditions right now</p>
              <p className="error-page-detail">
                {error.message || 'Something went wrong fetching surf data.'}
                {' '}Give it a sec and try again.
              </p>
            </>
          )}
          <div className="error-page-actions">
            {is404 ? (
              <>
                <button className="error-page-btn primary" onClick={() => setShowErrorMap(true)} type="button">
                  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M1 4l6-2 6 2 6-2v14l-6 2-6-2-6 2V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M7 2v14M13 6v14" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  Find a spot on the map
                </button>
              </>
            ) : (
              <button className="error-page-btn primary" onClick={handleRefresh} type="button">
                Try again
              </button>
            )}
          </div>
        </div>

        {showErrorMap && (
          <Suspense fallback={null}>
            <SpotMap
              onSelect={(spot) => {
                const id = slugify(spot.name);
                const existing = getRecentCustomSpots();
                const updated = [
                  { id, name: spot.name, lat: spot.lat, lon: spot.lon, country: spot.country, region: spot.region },
                  ...existing.filter(s => s.id !== id)
                ].slice(0, 20);
                localStorage.setItem('customSpots', JSON.stringify(updated));
                localStorage.setItem('activeCustomSpot', JSON.stringify({
                  id, name: spot.name, lat: spot.lat, lon: spot.lon, country: spot.country
                }));
                setShowErrorMap(false);
                handleSpotChange(id);
              }}
              onClose={() => setShowErrorMap(false)}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-brand">
          {(() => {
            const s = adjustedScore !== null ? adjustedScore : conditions?.score?.overall;
            const happy = s != null && s >= 50;
            return (
              <svg className="top-bar-icon" viewBox="0 0 28 28" fill="none">
                {happy ? (
                  <>
                    <path d="M2 12c3 6 7 10 12 10s8-3 12-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M5 14c2.5 4 5.5 7 9 7s6-2 9-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
                  </>
                ) : (
                  <>
                    <path d="M2 20c3-6 7-10 12-10s8 3 12 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M5 18c2.5-4 5.5-7 9-7s6 2 9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
                  </>
                )}
              </svg>
            );
          })()}
          <span className="top-bar-title">Should I Go?</span>
        </div>
        <div className="top-bar-actions">
          {conditions && selectedSpot && (
            <button
              className="top-bar-action-btn"
              title="Share"
              onClick={() => {
                const score = adjustedScore !== null ? adjustedScore : conditions.score.overall;
                const rating = adjustedRating !== null ? adjustedRating : conditions.score.rating;
                const c = conditions.conditions;
                let waveText = '';
                if (c.waves?.height?.min != null && c.waves?.height?.max != null)
                  waveText = `Waves: ${c.waves.height.min.toFixed(1)}–${c.waves.height.max.toFixed(1)}m`;
                else if (c.waves?.height?.avg != null)
                  waveText = `Waves: ${c.waves.height.avg.toFixed(1)}m`;
                const parts = [waveText];
                if (c.wind?.speed != null) {
                  let w = `Wind: ${Math.round(c.wind.speed)} km/h`;
                  if (c.wind.direction) w += ` ${c.wind.direction}`;
                  parts.push(w);
                }
                if (c.weather?.waterTemp != null) parts.push(`Water: ${Math.round(c.weather.waterTemp)}°C`);
                const details = parts.filter(Boolean).join(' | ');
                const customMeta = getCustomSpotMeta(selectedSpot);
                const spotObj = spots?.find(s => s.id === selectedSpot);
                const lat = customMeta?.lat || spotObj?.location?.lat;
                const lon = customMeta?.lon || spotObj?.location?.lon;
                const url = lat && lon
                  ? `${window.location.origin}?lat=${lat}&lon=${lon}&name=${encodeURIComponent(currentSpotName)}`
                  : `${window.location.origin}${window.location.pathname}?spot=${selectedSpot}`;
                const text = `Should I Go? 🏄 ${currentSpotName} — ${score}/100 (${rating})\n${details}\nCheck it out: ${url}`;
                if (navigator.share) {
                  navigator.share({ text }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(text).then(() => {
                    const toast = document.createElement('div');
                    toast.textContent = 'Copied to clipboard!';
                    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 16px;border-radius:8px;font-size:14px;z-index:9999;';
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 2000);
                  });
                }
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <NotificationBell currentSpotId={selectedSpot} currentSpotName={currentSpotName} />
          <SpotSelector spots={spots} value={selectedSpot} onChange={handleSpotChange} nearbySpots={nearbySpots} />
        </div>
      </div>

      {/* Progress screen (first 3s) */}
      {showProgressScreen && (
        <ProgressScreen
          geoStep={geoStep}
          spotStep={spotStep}
          steps={sseSteps}
          total={sseTotal}
          isStreaming={isStreaming}
        />
      )}

      {/* Skeleton layout: shows for hardcoded spots after 3s, while SSE is still running */}
      {!showProgressScreen && !conditions && !showSkeletonSections && (
        <SkeletonDashboard spotName={currentSpotName} />
      )}

      {/* Main Content
          - For map/custom spots: renders immediately with inline skeleton blocks while fetching
          - For hardcoded spots: renders once conditions are available (SSE delivers them) */}
      {!showProgressScreen && (conditions || showSkeletonSections) && (
        <>
          {/* Hero */}
          {conditions ? (
            <ScoreDisplay
              score={adjustedScore !== null ? adjustedScore : conditions.score.overall}
              rating={adjustedRating !== null ? adjustedRating : conditions.score.rating}
              explanation={conditions.score.explanation}
              timestamp={conditions.timestamp}
              fromCache={conditions.fromCache}
              cacheAge={conditions.cacheAge}
              conditions={conditions.conditions}
              onRefresh={handleRefresh}
            />
          ) : (
            <div className="skeleton-hero">
              <div className="sk sk-hero-label" />
              <div className="sk sk-hero-gauge" />
              <div className="sk sk-hero-verdict" />
              <div className="sk sk-hero-explanation" />
              <div className="sk-hero-pills">
                <div className="sk sk-hero-pill" />
                <div className="sk sk-hero-pill" />
                <div className="sk sk-hero-pill" />
              </div>
            </div>
          )}

          {/* Score Breakdown */}
          {(conditions?.score.breakdown || showSkeletonSections) && (
            <div className="breakdown-section">
              <h3>Score Breakdown</h3>
              {conditions?.score.breakdown ? (
                <div className="breakdown-bars">
                  <BreakdownBar label="Wave Height" value={conditions.score.breakdown.waveHeight} hint={getHint('waveHeight', conditions.score.breakdown.waveHeight)} />
                  <BreakdownBar label="Wave Period" value={conditions.score.breakdown.wavePeriod} hint={getHint('wavePeriod', conditions.score.breakdown.wavePeriod)} />
                  <BreakdownBar label="Swell Quality" value={conditions.score.breakdown.swellQuality} hint={getHint('swellQuality', conditions.score.breakdown.swellQuality)} />
                  <BreakdownBar label="Surface Calm" value={conditions.score.breakdown.windSpeed} hint={getHint('windSpeed', conditions.score.breakdown.windSpeed)} />
                  <BreakdownBar label="Wind Direction" value={conditions.score.breakdown.windDirection} hint={getHint('windDirection', conditions.score.breakdown.windDirection)} />
                  <BreakdownBar label="Wave Direction" value={conditions.score.breakdown.waveDirection} hint={getHint('waveDirection', conditions.score.breakdown.waveDirection)} />
                </div>
              ) : (
                <div className="sk-breakdown-rows">
                  {[72, 58, 85, 45, 63, 50].map((w, i) => (
                    <div key={i} className="sk-breakdown-row">
                      <div className="sk-breakdown-top">
                        <div className="sk sk-breakdown-grade" />
                        <div className="sk sk-breakdown-label" style={{ width: 70 + (i % 3) * 20 }} />
                      </div>
                      <div className="sk sk-breakdown-bar" style={{ width: `${w}%` }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Forecast Timeline */}
          {((conditions?.trend?.blocks && conditions.trend.blocks.length > 0) || showSkeletonSections) && (
            <div className="forecast-section">
              <h3>Forecast</h3>
              {conditions?.trend?.blocks?.length > 0 ? (
                <>
                  {conditions.trend.message && (
                    <div className="forecast-summary">
                      <span className="forecast-trend-arrow">
                        {conditions.trend.trend === 'improving' ? '↗' : conditions.trend.trend === 'declining' ? '↘' : '→'}
                      </span>
                      <span className="forecast-trend-message">{conditions.trend.message}</span>
                    </div>
                  )}
                  <div className="forecast-timeline">
                    {conditions.trend.blocks.map((block, i) => {
                      const isBest = conditions.trend.bestWindow && block.label === conditions.trend.bestWindow.label;
                      return (
                        <div
                          key={i}
                          className={`forecast-block ${isBest ? 'forecast-block-best' : ''}`}
                        >
                          <span className="forecast-block-label">{block.label}</span>
                          <span
                            className="forecast-block-score"
                            style={{ color: getScoreColor(block.score) }}
                          >
                            {block.score}
                          </span>
                          <div
                            className="forecast-block-bar"
                            style={{ backgroundColor: getScoreColor(block.score), width: `${block.score}%` }}
                          />
                          <span className="forecast-block-rating">{block.rating}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="sk-forecast-timeline">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="sk-forecast-block">
                      <div className="sk sk-label" />
                      <div className="sk sk-score" />
                      <div className="sk sk-bar" />
                      <div className="sk sk-rating" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Gear Recommendation */}
          {(conditions?.boardRecommendation || showSkeletonSections) && (
            <div className="gear-section">
              <h3>Gear</h3>
              {conditions?.boardRecommendation ? (
                <>
                  {userSkill === 'kook' ? (
                    <div className="gear-kook-message">Stay home, you Kook!</div>
                  ) : (
                  <div className="gear-grid">

                    <div className="gear-card">
                      <div className="gear-card-icon board-icon-wrap">
                        {getBoardSVG(conditions.boardRecommendation.boardType)}
                      </div>
                      <div className="gear-card-body">
                        <span className="gear-card-title">{conditions.boardRecommendation.boardName}</span>
                        <span className="gear-card-desc">{conditions.boardRecommendation.reason}</span>
                        {conditions.boardRecommendation.volume && (
                          <span className="gear-card-volume">~{conditions.boardRecommendation.volume.recommended}L</span>
                        )}
                      </div>
                    </div>

                    {conditions.conditions?.weather?.waterTemp != null && (() => {
                      const hint = getWetsuitHint(conditions.conditions.weather.waterTemp);
                      if (!hint) return null;
                      return (
                        <div className="gear-card">
                          <div className="gear-card-icon wetsuit-icon-wrap">
                            {hint.icon === 'shorts' ? (
                              <svg viewBox="0 0 24 24" fill="currentColor" className="gear-wetsuit-svg">
                                <path d="M4 4H20V7L18 21H13L12 13L11 21H6L4 7Z" opacity="0.85" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="currentColor" className="gear-wetsuit-svg">
                                <path d="M9 2H15L17 5H21V9H17L16 21H13L12 14L11 21H8L7 9H3V5H7Z" opacity="0.85" />
                              </svg>
                            )}
                          </div>
                          <div className="gear-card-body">
                            <span className="gear-card-title">{hint.label}</span>
                            <span className="gear-card-desc">{conditions.conditions.weather.waterTemp}°C water</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  )}

                  <div className="gear-personalize">
                    <span className="gear-personalize-title">Personalize</span>
                    <div className="gear-personalize-fields">
                      <label className="gear-field">
                        <span>Weight (kg)</span>
                        <input
                          type="number"
                          value={userWeight}
                          onChange={(e) => { setUserWeight(e.target.value); localStorage.setItem('userWeight', e.target.value); }}
                          placeholder="75"
                          min="30"
                          max="150"
                        />
                      </label>
                      <label className="gear-field">
                        <span>Skill</span>
                        <select
                          value={userSkill}
                          onChange={(e) => { setUserSkill(e.target.value); localStorage.setItem('userSkill', e.target.value); }}
                        >
                          <option value="">--</option>
                          <option value="kook">Kook</option>
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                          <option value="expert">Expert</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <div className="sk-gear-grid">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="sk-gear-card">
                      <div className="sk sk-gear-icon" />
                      <div className="sk-gear-body">
                        <div className="sk sk-gear-title" />
                        <div className="sk sk-gear-desc" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Beach Sketch */}
          {conditions && sketchSpot && (
            <BeachSketch
              spot={sketchSpot}
              waveDirection={conditions.conditions?.waves?.direction}
              windDirection={conditions.conditions?.wind?.direction}
            />
          )}

          {/* Surfer Feedback */}
          {conditions?.score.breakdown && (
            <SpotFeedback
              spotId={conditions.spotId || selectedSpot}
              breakdown={conditions.score.breakdown}
              weights={conditions.weights}
              originalScore={conditions.score.overall}
              adjustedScore={adjustedScore}
              onScoreAdjusted={(score, rating) => {
                setAdjustedScore(score);
                setAdjustedRating(rating);
              }}
            />
          )}

          {/* Site footer */}
          {conditions && (
            <div className="site-footer">
              <p className="site-footer-text">
                Built between sessions by surfers who should've been in the water
              </p>
              <div className="site-footer-links">
                <a href="mailto:orlench@gmail.com?subject=Yo%20from%20shouldigo.surf" className="site-footer-link">
                  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                    <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2 6l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  Drop a message in the bottle
                </a>
                <a href="/privacy" className="site-footer-link">
                  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                    <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.2" />
                    <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" />
                    <line x1="6" y1="13" x2="11" y2="13" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  Privacy Policy
                </a>
              </div>
            </div>
          )}
        </>
      )}

      {/* PWA install banner */}
      {showInstallBanner && (
        <div className="pwa-install-banner">
          <span>Add to home screen for quick access</span>
          <div className="pwa-install-actions">
            <button
              className="pwa-install-btn"
              onClick={() => {
                if (installPrompt) {
                  installPrompt.prompt();
                  installPrompt.userChoice.then((choice) => {
                    if (choice.outcome === 'accepted') {
                      trackConversion('pwa_install');
                    }
                    setShowInstallBanner(false);
                    setInstallPrompt(null);
                  });
                }
              }}
            >
              Install
            </button>
            <button
              className="pwa-dismiss-btn"
              onClick={() => {
                setShowInstallBanner(false);
                localStorage.setItem('pwaInstallDismissed', '1');
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getHint(factor, value) {
  const hints = {
    waveHeight: [
      [80, 'Ideal size'],
      [60, 'Decent size'],
      [40, 'A bit small'],
      [20, 'Very small'],
      [0,  'Flat']
    ],
    wavePeriod: [
      [80, 'Long, clean waves'],
      [60, 'Good quality'],
      [40, 'Short period'],
      [20, 'Wind chop'],
      [0,  'Very choppy']
    ],
    swellQuality: [
      [80, 'Solid groundswell'],
      [60, 'Decent swell'],
      [40, 'Mixed swell'],
      [20, 'Mostly wind swell'],
      [0,  'No real swell']
    ],
    windSpeed: [
      [80, 'Glassy, barely any wind'],
      [60, 'Light breeze, manageable'],
      [40, 'Moderate wind, some chop'],
      [20, 'Strong wind, rough surface'],
      [0,  'Blown out, too windy']
    ],
    windDirection: [
      [80, 'Offshore'],
      [60, 'Cross-shore'],
      [40, 'Side-on'],
      [20, 'Onshore'],
      [0,  'Direct onshore']
    ],
    waveDirection: [
      [80, 'Perfect angle'],
      [60, 'Good angle'],
      [40, 'Okay angle'],
      [20, 'Off angle'],
      [0,  'Wrong direction']
    ]
  };
  const levels = hints[factor] || [];
  for (const [threshold, text] of levels) {
    if (value >= threshold) return text;
  }
  return '';
}

function getScoreLabel(value) {
  if (value >= 80) return 'A';
  if (value >= 60) return 'B';
  if (value >= 40) return 'C';
  if (value >= 20) return 'D';
  return 'F';
}

function getScoreColor(value) {
  if (value >= 80) return '#00c48c';
  if (value >= 60) return '#4cd964';
  if (value >= 40) return '#f5a623';
  if (value >= 20) return '#ff6b35';
  return '#ff3b30';
}

function BreakdownBar({ label, value, hint }) {
  return (
    <div className="breakdown-item">
      <div className="breakdown-top">
        <span className="breakdown-grade" style={{ color: getScoreColor(value) }}>{getScoreLabel(value)}</span>
        <div className="breakdown-text">
          <span className="breakdown-label-text">{label}</span>
          <span className="breakdown-hint">{hint}</span>
        </div>
      </div>
      <div className="breakdown-bar-bg">
        <div
          className="breakdown-bar-fill"
          style={{
            width: `${value}%`,
            backgroundColor: getScoreColor(value)
          }}
        />
      </div>
    </div>
  );
}

export default Dashboard;
