import { getBoardSVG } from './BoardIllustrations';
import './ScoreDisplay.css';

function ScoreDisplay({ score, rating, explanation, timestamp, fromCache, cacheAge, conditions, trend, boardRecommendation, onRefresh }) {
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

  // Friendly wind descriptor
  const getWindDesc = (speed) => {
    if (!speed) return '';
    if (speed < 10) return 'Calm';
    if (speed < 20) return 'Light breeze';
    if (speed < 30) return 'Breezy';
    if (speed < 40) return 'Windy';
    return 'Very windy';
  };

  // Friendly wetsuit hint based on water temp (Mediterranean)
  const getWetsuitHint = (temp) => {
    if (!temp) return '';
    if (temp >= 24) return 'boardshorts';
    if (temp >= 20) return 'spring suit';
    if (temp >= 16) return '3/2 wetsuit';
    return '4/3 wetsuit';
  };

  // Friendly period quality
  const getPeriodDesc = (period) => {
    if (!period) return '';
    if (period >= 12) return 'Clean';
    if (period >= 9) return 'Decent';
    if (period >= 6) return 'Short';
    return 'Choppy';
  };

  const windDesc = getWindDesc(wind?.speed);
  const windText = wind?.speed
    ? `${windDesc} ${wind.direction ? wind.direction + ' ' : ''}${wind.speed} km/h${wind.gusts ? ` (gusts ${wind.gusts})` : ''}`
    : null;
  const wetsuitHint = getWetsuitHint(weather?.waterTemp);
  const periodDesc = getPeriodDesc(waves?.period);

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
        {waves?.period && <span className="hero-detail first">{periodDesc} {waves.period}s swell</span>}
        {waves?.direction && <span className="hero-detail">{waves.direction} direction</span>}
        {windText && <span className="hero-detail">{windText}</span>}
        {weather?.airTemp != null && <span className="hero-detail">{weather.airTemp}°C air</span>}
        {weather?.waterTemp != null && <span className="hero-detail">{weather.waterTemp}°C water{wetsuitHint ? ` (${wetsuitHint})` : ''}</span>}
      </div>

      {boardRecommendation && (
        <div className="hero-board-rec">
          <div className="board-svg-wrap">
            {getBoardSVG(boardRecommendation.boardType)}
          </div>
          <div className="board-rec-text">
            <span className="board-rec-name">{boardRecommendation.boardName}</span>
            <span className="board-rec-reason">{boardRecommendation.reason}</span>
            {boardRecommendation.volume && (
              <span className="board-rec-volume">~{boardRecommendation.volume.recommended}L</span>
            )}
          </div>
        </div>
      )}

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
