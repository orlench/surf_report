import './ScoreDisplay.css';

function ScoreDisplay({ score, rating, timestamp, fromCache, cacheAge, conditions, onRefresh }) {
  const getColorClass = (score) => {
    if (score >= 85) return 'epic';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'flat';
  };

  const getVerdict = (score) => {
    if (score >= 85) return 'Absolutely!';
    if (score >= 70) return 'Yes, go!';
    if (score >= 50) return 'Maybe...';
    if (score >= 30) return 'Probably not';
    return 'Stay home';
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

  const colorClass = getColorClass(score);
  const { waves, wind } = conditions || {};

  const waveText = waves?.height?.min && waves?.height?.max
    ? `${waves.height.min}–${waves.height.max}m`
    : waves?.height?.avg
      ? `${waves.height.avg}m`
      : null;

  return (
    <div className={`hero ${colorClass}`}>
      <div className="hero-question">Should I go?</div>
      <div className="hero-verdict">{getVerdict(score)}</div>
      <span className={`rating-badge ${colorClass}`}>{rating}</span>

      {waveText && (
        <div className="hero-wave-height">{waveText}</div>
      )}

      <div className="hero-details">
        <span className="hero-score">{score}/100</span>
        {waves?.period && <span className="hero-detail">{waves.period}s period</span>}
        {waves?.direction && <span className="hero-detail">{waves.direction} swell</span>}
        {wind?.speed && <span className="hero-detail">{wind.speed} km/h wind</span>}
      </div>

      <div className="hero-updated">
        {fromCache && <span className="cache-badge">Cached</span>}
        Updated {fromCache && cacheAge ? `${Math.floor(cacheAge / 60)} min ago` : formatTime(timestamp)}
        <button className="hero-refresh" onClick={onRefresh} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ScoreDisplay;
