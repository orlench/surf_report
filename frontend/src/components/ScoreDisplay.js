import React from 'react';
import './ScoreDisplay.css';

function ScoreDisplay({ score, rating, breakdown, timestamp, fromCache, cacheAge }) {
  const getColorClass = (score) => {
    if (score >= 85) return 'epic';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'flat';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleString();
  };

  // Calculate stroke dasharray for circular progress
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;

  return (
    <div className={`score-display ${getColorClass(score)}`}>
      <div className="score-circle">
        <svg width="200" height="200" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={`${progress} ${circumference}`}
            strokeDashoffset="0"
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            className="progress-ring"
          />
        </svg>
        <div className="score-content">
          <div className="score-number">{score}</div>
          <div className="score-rating">{rating}</div>
        </div>
      </div>

      <div className="score-info">
        <p className="last-updated">
          {fromCache && <span className="cache-badge">Cached</span>}
          Updated {fromCache && cacheAge ? `${Math.floor(cacheAge / 60)} min ago` : formatTime(timestamp)}
        </p>
      </div>

      {/* Score breakdown */}
      {breakdown && (
        <div className="score-breakdown">
          <h3>Score Breakdown</h3>
          <div className="breakdown-bars">
            <BreakdownBar label="Wave Height" value={breakdown.waveHeight} />
            <BreakdownBar label="Wave Period" value={breakdown.wavePeriod} />
            <BreakdownBar label="Wind Speed" value={breakdown.windSpeed} />
            <BreakdownBar label="Wind Direction" value={breakdown.windDirection} />
            <BreakdownBar label="Wave Direction" value={breakdown.waveDirection} />
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownBar({ label, value }) {
  const getColor = (value) => {
    if (value >= 80) return '#4caf50';
    if (value >= 60) return '#8bc34a';
    if (value >= 40) return '#ffc107';
    return '#ff5722';
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

export default ScoreDisplay;
