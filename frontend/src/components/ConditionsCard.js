import './ConditionsCard.css';

function ConditionsCard({ conditions }) {
  const { waves, wind, weather } = conditions;

  return (
    <div className="conditions-grid">
      {/* Surf Card */}
      <div className="cond-card">
        <div className="cond-header">
          <span className="cond-icon">🌊</span>
          <span className="cond-title">Surf</span>
        </div>
        {waves.height && waves.height.avg ? (
          <div className="cond-body">
            <div className="cond-primary">{waves.height.min}–{waves.height.max}m</div>
            <div className="cond-secondary">
              {waves.period && <span>{waves.period}s period</span>}
              {waves.direction && <span>{waves.direction}</span>}
            </div>
          </div>
        ) : (
          <div className="cond-empty">No data</div>
        )}
      </div>

      {/* Wind Card */}
      <div className="cond-card">
        <div className="cond-header">
          <span className="cond-icon">💨</span>
          <span className="cond-title">Wind</span>
        </div>
        {wind.speed ? (
          <div className="cond-body">
            <div className="cond-primary">{wind.speed} km/h</div>
            <div className="cond-secondary">
              {wind.direction && <span>{wind.direction}</span>}
              {wind.gusts && <span>Gusts {wind.gusts} km/h</span>}
            </div>
          </div>
        ) : (
          <div className="cond-empty">No data</div>
        )}
      </div>

      {/* Swell Card */}
      <div className="cond-card">
        <div className="cond-header">
          <span className="cond-icon">〰️</span>
          <span className="cond-title">Swell</span>
        </div>
        {waves.height && waves.height.avg ? (
          <div className="cond-body">
            <div className="cond-primary">
              {waves.height.avg}m @ {waves.period || '—'}s
            </div>
            <div className="cond-secondary">
              {waves.direction && <span>{waves.direction}</span>}
            </div>
          </div>
        ) : (
          <div className="cond-empty">No data</div>
        )}
      </div>

      {/* Weather Card */}
      <div className="cond-card">
        <div className="cond-header">
          <span className="cond-icon">🌤️</span>
          <span className="cond-title">Weather</span>
        </div>
        {weather.airTemp || weather.waterTemp ? (
          <div className="cond-body">
            <div className="cond-temps">
              {weather.airTemp && (
                <div className="cond-temp-item">
                  <span className="cond-primary">{weather.airTemp}°C</span>
                  <span className="cond-temp-label">Air</span>
                </div>
              )}
              {weather.waterTemp && (
                <div className="cond-temp-item">
                  <span className="cond-primary">{weather.waterTemp}°C</span>
                  <span className="cond-temp-label">Water</span>
                </div>
              )}
            </div>
            <div className="cond-secondary">
              {weather.cloudCover && <span>{weather.cloudCover}</span>}
            </div>
          </div>
        ) : (
          <div className="cond-empty">No data</div>
        )}
      </div>
    </div>
  );
}

export default ConditionsCard;
