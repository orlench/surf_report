import './ScoreDisplay.css';

function ScoreDisplay({ score, rating, explanation, timestamp, fromCache, cacheAge, conditions, trend, onRefresh }) {
  const getColorClass = (score) => {
    if (score >= 85) return 'epic';
    if (score >= 75) return 'great';
    if (score >= 65) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 35) return 'marginal';
    if (score >= 20) return 'poor';
    return 'flat';
  };

  const getVerdict = (score) => {
    if (score >= 85) return 'Absolutely!';
    if (score >= 75) return 'Get out there!';
    if (score >= 65) return 'Yes, go!';
    if (score >= 50) return 'Maybe...';
    if (score >= 35) return 'Meh, probably not';
    if (score >= 20) return 'Not worth it';
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
  const { waves, wind, weather } = conditions || {};

  const waveText = waves?.height?.min && waves?.height?.max
    ? `${waves.height.min}–${waves.height.max}m`
    : waves?.height?.avg
      ? `${waves.height.avg}m`
      : null;

  const windText = wind?.speed
    ? `${wind.direction ? wind.direction + ' ' : ''}${wind.speed} km/h${wind.gusts ? ` (gusts ${wind.gusts})` : ''}`
    : null;

  return (
    <div className={`hero ${colorClass}`}>
      <div className="hero-question">Should I go?</div>
      <div className="hero-verdict">{getVerdict(score)}</div>
      <span className={`rating-badge ${colorClass}`}>{rating} {score}/100</span>

      {explanation && (
        <div className="hero-explanation">{explanation}</div>
      )}

      {waveText && (
        <div className="hero-wave-height">{waveText}</div>
      )}

      <div className="hero-details">
        {waves?.period && <span className="hero-detail first">{waves.period}s period</span>}
        {waves?.direction && <span className="hero-detail">{waves.direction} swell</span>}
        {windText && <span className="hero-detail">{windText}</span>}
        {weather?.airTemp && <span className="hero-detail">{weather.airTemp}°C air</span>}
        {weather?.waterTemp && <span className="hero-detail">{weather.waterTemp}°C water</span>}
      </div>

      {trend?.message && (
        <div className="hero-trend">
          <span className="trend-arrow">
            {trend.trend === 'improving' ? '↗' : trend.trend === 'declining' ? '↘' : '→'}
          </span>
          <span className="trend-message">{trend.message}</span>
        </div>
      )}

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
