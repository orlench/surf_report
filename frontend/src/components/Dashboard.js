import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSpots, fetchConditions } from '../api/surfApi';
import ScoreDisplay from './ScoreDisplay';
import ConditionsCard from './ConditionsCard';
import './Dashboard.css';

function Dashboard() {
  const [selectedSpot, setSelectedSpot] = useState('herzliya_marina');

  // Fetch available spots
  const { data: spots } = useQuery({
    queryKey: ['spots'],
    queryFn: fetchSpots,
  });

  // Fetch conditions for selected spot
  const {
    data: conditions,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['conditions', selectedSpot],
    queryFn: () => fetchConditions(selectedSpot),
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
  });

  const handleRefresh = () => {
    refetch({ queryKey: ['conditions', selectedSpot] });
  };

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
      {/* Spot Selector */}
      <div className="spot-selector">
        {spots && spots.map(spot => (
          <button
            key={spot.id}
            className={`spot-btn ${selectedSpot === spot.id ? 'active' : ''}`}
            onClick={() => setSelectedSpot(spot.id)}
          >
            {spot.name}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading surf conditions...</p>
        </div>
      )}

      {/* Conditions Display */}
      {conditions && !isLoading && (
        <div className="conditions-container">
          <div className="header-bar">
            <h2>{conditions.spotName}</h2>
            <button className="refresh-btn" onClick={handleRefresh}>
              🔄 Refresh
            </button>
          </div>

          <ScoreDisplay
            score={conditions.score.overall}
            rating={conditions.score.rating}
            breakdown={conditions.score.breakdown}
            timestamp={conditions.timestamp}
            fromCache={conditions.fromCache}
            cacheAge={conditions.cacheAge}
          />

          <ConditionsCard conditions={conditions.conditions} />

          {/* Data Sources Status */}
          <div className="sources-status">
            <h3>Data Sources</h3>
            <div className="sources-list">
              {conditions.sources && conditions.sources.map((source, idx) => (
                <span
                  key={idx}
                  className={`source-badge ${source.status}`}
                >
                  {source.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
