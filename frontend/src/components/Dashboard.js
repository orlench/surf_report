import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSpots, fetchConditions } from '../api/surfApi';
import ScoreDisplay from './ScoreDisplay';
import ConditionsCard from './ConditionsCard';
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
  const [selectedSpot, setSelectedSpot] = useState('herzliya_marina');
  const [loadingMsg, setLoadingMsg] = useState(0);

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
    queryKey: ['conditions', selectedSpot],
    queryFn: () => fetchConditions(selectedSpot),
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

  const handleRefresh = () => {
    refetch({ queryKey: ['conditions', selectedSpot] });
  };

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
        <select
          className="spot-select"
          value={selectedSpot}
          onChange={(e) => setSelectedSpot(e.target.value)}
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
            breakdown={conditions.score.breakdown}
            timestamp={conditions.timestamp}
            fromCache={conditions.fromCache}
            cacheAge={conditions.cacheAge}
            conditions={conditions.conditions}
            onRefresh={handleRefresh}
          />

          <ConditionsCard conditions={conditions.conditions} />

          {/* Score Breakdown */}
          {conditions.score.breakdown && (
            <div className="breakdown-section">
              <h3>Score Breakdown</h3>
              <div className="breakdown-bars">
                <BreakdownBar label="Wave Height" value={conditions.score.breakdown.waveHeight} />
                <BreakdownBar label="Wave Period" value={conditions.score.breakdown.wavePeriod} />
                <BreakdownBar label="Wind Speed" value={conditions.score.breakdown.windSpeed} />
                <BreakdownBar label="Wind Direction" value={conditions.score.breakdown.windDirection} />
                <BreakdownBar label="Wave Direction" value={conditions.score.breakdown.waveDirection} />
              </div>
            </div>
          )}

          {/* Sources Footer */}
          <div className="sources-footer">
            {conditions.sources && conditions.sources.map((source, idx) => (
              <span
                key={idx}
                className={`source-pill ${source.status}`}
              >
                {source.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BreakdownBar({ label, value }) {
  const getColor = (value) => {
    if (value >= 80) return '#00c48c';
    if (value >= 60) return '#4cd964';
    if (value >= 40) return '#f5a623';
    return '#ff6b35';
  };

  return (
    <div className="breakdown-item">
      <div className="breakdown-label">
        <span>{label}</span>
        <span className="breakdown-value">{value}</span>
      </div>
      <div className="breakdown-bar-bg">
        <div
          className="breakdown-bar-fill"
          style={{
            width: `${value}%`,
            backgroundColor: getColor(value)
          }}
        />
      </div>
    </div>
  );
}

export default Dashboard;
