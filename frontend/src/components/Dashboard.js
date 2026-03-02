import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSpots, fetchConditions, fetchConditionsByCoords, createSpot } from '../api/surfApi';
import useGeoDetect from '../hooks/useGeoDetect';
import useSSEProgress from '../hooks/useSSEProgress';
import ScoreDisplay from './ScoreDisplay';
import SpotSelector from './SpotSelector';
import SpotMap from './SpotMap';
import SpotFeedback from './SpotFeedback';
import NotificationBell from './NotificationBell';
import ProgressScreen from './ProgressScreen';
import './Dashboard.css';

function getInitialSpot() {
  const params = new URLSearchParams(window.location.search);
  const urlSpot = params.get('spot');
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

function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedSpot, setSelectedSpot] = useState(getInitialSpot);
  const [showErrorMap, setShowErrorMap] = useState(false);
  const [adjustedScore, setAdjustedScore] = useState(null);
  const [adjustedRating, setAdjustedRating] = useState(null);
  const [userWeight, setUserWeight] = useState(
    () => localStorage.getItem('userWeight') || ''
  );
  const [userSkill, setUserSkill] = useState(
    () => localStorage.getItem('userSkill') || ''
  );

  // Progress screen flow
  const isFirstVisitRef = useRef(selectedSpot === null);
  const [showProgressScreen, setShowProgressScreen] = useState(true);
  const { location, nearestSpot, nearestSpotName, isDetecting } = useGeoDetect(isFirstVisitRef.current);
  const { steps: sseSteps, isStreaming, finalData, error: sseError, startStream, cleanup } = useSSEProgress();

  // Start SSE for returning users on mount
  useEffect(() => {
    if (isFirstVisitRef.current || !selectedSpot) return;
    startStream(selectedSpot);
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
  }, [nearestSpot, isDetecting, startStream]);

  // When SSE completes, seed React Query cache and dismiss progress screen
  useEffect(() => {
    if (!finalData) return;
    queryClient.setQueryData(
      ['conditions', finalData.spotId, userWeight, userSkill],
      finalData
    );
    const timer = setTimeout(() => {
      setShowProgressScreen(false);
      cleanup();
    }, 800);
    return () => clearTimeout(timer);
  }, [finalData, queryClient, userWeight, userSkill, cleanup]);

  // SSE error fallback: dismiss progress and let React Query fetch
  useEffect(() => {
    if (!sseError) return;
    setShowProgressScreen(false);
    cleanup();
  }, [sseError, cleanup]);

  // Build geo/spot steps for ProgressScreen (only on first visit)
  const geoStep = isFirstVisitRef.current && showProgressScreen ? {
    status: isDetecting ? 'loading' : 'done',
    snippet: location ? `${location.city || ''}, ${location.country || ''}`.replace(/^, |, $/g, '') : null,
  } : null;
  const spotStep = isFirstVisitRef.current && showProgressScreen && !isDetecting ? {
    status: nearestSpot ? 'done' : 'loading',
    snippet: nearestSpotName || null,
  } : null;

  const handleSpotChange = useCallback((spotId) => {
    setSelectedSpot(spotId);
    setAdjustedScore(null);
    setAdjustedRating(null);
    setShowProgressScreen(true);
    startStream(spotId);
    localStorage.setItem('selectedSpot', spotId);
    const url = new URL(window.location);
    url.searchParams.set('spot', spotId);
    window.history.replaceState({}, '', url);

    // If this is a custom spot, fire-and-forget a POST to persist it
    const customMeta = getCustomSpotMeta(spotId);
    if (customMeta) {
      createSpot(customMeta).catch(() => {});
    }
  }, [startStream]);

  // Keep URL in sync with selected spot
  useEffect(() => {
    const url = new URL(window.location);
    if (url.searchParams.get('spot') !== selectedSpot) {
      url.searchParams.set('spot', selectedSpot);
      window.history.replaceState({}, '', url);
    }
  }, [selectedSpot]);

  const { data: spots } = useQuery({
    queryKey: ['spots'],
    queryFn: fetchSpots,
  });

  const {
    data: conditions,
    error,
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
  }, [startStream, selectedSpot]);

  const currentSpotName = conditions?.spotName
    || spots?.find(s => s.id === selectedSpot)?.name
    || getCustomSpotMeta(selectedSpot)?.name
    || (selectedSpot ? selectedSpot.replace(/_/g, ' ') : '');

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
            <SpotSelector spots={spots} value={selectedSpot} onChange={handleSpotChange} />
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
                <button className="error-page-btn secondary" onClick={() => handleSpotChange('netanya_kontiki')} type="button">
                  Go to home break
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
          <NotificationBell currentSpotId={selectedSpot} currentSpotName={currentSpotName} />
          <SpotSelector spots={spots} value={selectedSpot} onChange={handleSpotChange} />
        </div>
      </div>

      {/* Progress screen */}
      {showProgressScreen && (
        <ProgressScreen
          geoStep={geoStep}
          spotStep={spotStep}
          steps={sseSteps}
          isStreaming={isStreaming}
        />
      )}

      {/* Main Content */}
      {conditions && !showProgressScreen && (
        <>
          <ScoreDisplay
            score={adjustedScore !== null ? adjustedScore : conditions.score.overall}
            rating={adjustedRating !== null ? adjustedRating : conditions.score.rating}
            explanation={conditions.score.explanation}
            breakdown={conditions.score.breakdown}
            timestamp={conditions.timestamp}
            fromCache={conditions.fromCache}
            cacheAge={conditions.cacheAge}
            conditions={conditions.conditions}
            trend={conditions.trend}
            boardRecommendation={conditions.boardRecommendation}
            onRefresh={handleRefresh}
            userWeight={userWeight}
            userSkill={userSkill}
            onWeightChange={(val) => { setUserWeight(val); localStorage.setItem('userWeight', val); }}
            onSkillChange={(val) => { setUserSkill(val); localStorage.setItem('userSkill', val); }}
          />

          {/* Score Breakdown */}
          {conditions.score.breakdown && (
            <div className="breakdown-section">
              <h3>Score Breakdown</h3>
              <div className="breakdown-bars">
                <BreakdownBar label="Wave Height" value={conditions.score.breakdown.waveHeight} hint={getHint('waveHeight', conditions.score.breakdown.waveHeight)} />
                <BreakdownBar label="Wave Period" value={conditions.score.breakdown.wavePeriod} hint={getHint('wavePeriod', conditions.score.breakdown.wavePeriod)} />
                <BreakdownBar label="Swell Quality" value={conditions.score.breakdown.swellQuality} hint={getHint('swellQuality', conditions.score.breakdown.swellQuality)} />
                <BreakdownBar label="Surface Calm" value={conditions.score.breakdown.windSpeed} hint={getHint('windSpeed', conditions.score.breakdown.windSpeed)} />
                <BreakdownBar label="Wind Direction" value={conditions.score.breakdown.windDirection} hint={getHint('windDirection', conditions.score.breakdown.windDirection)} />
                <BreakdownBar label="Wave Direction" value={conditions.score.breakdown.waveDirection} hint={getHint('waveDirection', conditions.score.breakdown.waveDirection)} />
              </div>
            </div>
          )}

          {/* Surfer Feedback */}
          {conditions.score.breakdown && (
            <SpotFeedback
              spotId={conditions.spotId || selectedSpot}
              breakdown={conditions.score.breakdown}
              weights={conditions.weights}
              originalScore={conditions.score.overall}
              onScoreAdjusted={(score, rating) => {
                setAdjustedScore(score);
                setAdjustedRating(rating);
              }}
            />
          )}

          {/* Site footer */}
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
              <a href="https://github.com/orlench/surf_report" target="_blank" rel="noopener noreferrer" className="site-footer-link">
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Open source - ride the code
              </a>
            </div>
          </div>
        </>
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
