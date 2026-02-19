import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSpots, fetchConditions } from '../api/surfApi';
import ScoreDisplay from './ScoreDisplay';
import './Dashboard.css';

const LOADING_MESSAGES = [
  'Checking the lineup...',
  'Reading the swell charts...',
  'Asking the locals...',
  'Waxing up the board...',
  'Paddling out...',
  'Scanning the horizon...',
  'Feeling the wind...',
  'No rush, good things take time...',
  'Almost there, hang loose...',
];

function Dashboard() {
  const [selectedSpot, setSelectedSpot] = useState(
    () => localStorage.getItem('selectedSpot') || 'netanya_kontiki'
  );
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [userWeight, setUserWeight] = useState(
    () => localStorage.getItem('userWeight') || ''
  );
  const [userSkill, setUserSkill] = useState(
    () => localStorage.getItem('userSkill') || ''
  );

  const { data: spots } = useQuery({
    queryKey: ['spots'],
    queryFn: fetchSpots,
  });

  const {
    data: conditions,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['conditions', selectedSpot, userWeight, userSkill],
    queryFn: () => fetchConditions(selectedSpot, {
      weight: userWeight || undefined,
      skill: userSkill || undefined
    }),
    refetchInterval: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading) return;
    setLoadingMsg(0);
    const interval = setInterval(() => {
      setLoadingMsg(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Throttle refresh to once per 5 seconds
  const lastRefresh = useRef(0);
  const handleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefresh.current < 5000) return;
    lastRefresh.current = now;
    refetch({ queryKey: ['conditions', selectedSpot] });
  }, [refetch, selectedSpot]);

  // Group spots by country for dropdown
  const spotsByCountry = {};
  if (spots) {
    spots.forEach(spot => {
      const country = spot.country || 'Other';
      if (!spotsByCountry[country]) spotsByCountry[country] = [];
      spotsByCountry[country].push(spot);
    });
  }

  if (error) {
    return (
      <div className="error">
        <h3>Error Loading Conditions</h3>
        <p>{error.message || 'Failed to fetch surf conditions'}</p>
        <button onClick={handleRefresh}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-brand">
          <svg className="top-bar-icon" viewBox="0 0 28 28" fill="none">
            <path d="M2 20c3-6 7-10 12-10s8 3 12 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M5 18c2.5-4 5.5-7 9-7s6 2 9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          </svg>
          <span className="top-bar-title">Should I Go?</span>
        </div>
        <select
          className="spot-select"
          value={selectedSpot}
          onChange={(e) => { setSelectedSpot(e.target.value); localStorage.setItem('selectedSpot', e.target.value); }}
        >
          {Object.entries(spotsByCountry).map(([country, countrySpots]) => (
            <optgroup key={country} label={country}>
              {countrySpots.map(spot => (
                <option key={spot.id} value={spot.id}>
                  {spot.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="loading">
          <div className="loader-wave">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <p className="loading-msg">{LOADING_MESSAGES[loadingMsg]}</p>
        </div>
      )}

      {/* Main Content */}
      {conditions && !isLoading && (
        <>
          <ScoreDisplay
            score={conditions.score.overall}
            rating={conditions.score.rating}
            explanation={conditions.score.explanation}
            breakdown={conditions.score.breakdown}
            timestamp={conditions.timestamp}
            fromCache={conditions.fromCache}
            cacheAge={conditions.cacheAge}
            conditions={conditions.conditions}
            trend={conditions.trend}
            boardRecommendation={conditions.boardRecommendation}
            onRefresh={handleRefresh}
          />

          {/* Personalize profile */}
          <div className="profile-section">
            <button
              className="profile-toggle"
              onClick={() => setShowProfile(prev => !prev)}
            >
              {showProfile ? 'Hide' : 'Personalize board volume'}
            </button>
            {showProfile && (
              <div className="profile-inputs">
                <label className="profile-label">
                  Weight (kg)
                  <input
                    type="number"
                    className="profile-input"
                    value={userWeight}
                    onChange={(e) => { setUserWeight(e.target.value); localStorage.setItem('userWeight', e.target.value); }}
                    placeholder="75"
                    min="30"
                    max="150"
                  />
                </label>
                <label className="profile-label">
                  Skill
                  <select
                    className="profile-input"
                    value={userSkill}
                    onChange={(e) => { setUserSkill(e.target.value); localStorage.setItem('userSkill', e.target.value); }}
                  >
                    <option value="">—</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </label>
              </div>
            )}
          </div>

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

          {/* Sources Footer */}
          <div className="sources-footer">
            {conditions.sources && conditions.sources.map((source, idx) => {
              // Only allow http/https URLs
              const isValidUrl = source.url && /^https?:\/\//i.test(source.url);
              return isValidUrl ? (
                <a
                  key={idx}
                  className={`source-pill ${source.status}`}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.name}
                </a>
              ) : (
                <span key={idx} className={`source-pill ${source.status}`}>
                  {source.name}
                </span>
              );
            })}
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
