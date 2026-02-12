import React from 'react';
import './ConditionsCard.css';

function ConditionsCard({ conditions }) {
  const { waves, wind, weather } = conditions;

  return (
    <div className="conditions-card">
      <div className="conditions-grid">
        {/* Wave Info */}
        <div className="info-card">
          <div className="card-icon">🌊</div>
          <h3>Waves</h3>
          <div className="card-content">
            {waves.height && waves.height.avg ? (
              <>
                <div className="primary-stat">
                  <span className="value">{waves.height.min}-{waves.height.max}m</span>
                  <span className="label">Wave Height</span>
                </div>
                <div className="secondary-stats">
                  {waves.period && (
                    <div className="stat">
                      <span className="label">Period</span>
                      <span className="value">{waves.period}s</span>
                    </div>
                  )}
                  {waves.direction && (
                    <div className="stat">
                      <span className="label">Direction</span>
                      <span className="value">{waves.direction}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="no-data">No wave data</div>
            )}
          </div>
        </div>

        {/* Wind Info */}
        <div className="info-card">
          <div className="card-icon">💨</div>
          <h3>Wind</h3>
          <div className="card-content">
            {wind.speed ? (
              <>
                <div className="primary-stat">
                  <span className="value">{wind.speed} km/h</span>
                  <span className="label">Wind Speed</span>
                </div>
                <div className="secondary-stats">
                  {wind.direction && (
                    <div className="stat">
                      <span className="label">Direction</span>
                      <span className="value">{wind.direction}</span>
                    </div>
                  )}
                  {wind.gusts && (
                    <div className="stat">
                      <span className="label">Gusts</span>
                      <span className="value">{wind.gusts} km/h</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="no-data">No wind data</div>
            )}
          </div>
        </div>

        {/* Weather Info */}
        <div className="info-card">
          <div className="card-icon">🌤️</div>
          <h3>Weather</h3>
          <div className="card-content">
            {weather.airTemp || weather.waterTemp ? (
              <>
                <div className="primary-stat">
                  {weather.airTemp && (
                    <>
                      <span className="value">{weather.airTemp}°C</span>
                      <span className="label">Air Temp</span>
                    </>
                  )}
                </div>
                <div className="secondary-stats">
                  {weather.waterTemp && (
                    <div className="stat">
                      <span className="label">Water Temp</span>
                      <span className="value">{weather.waterTemp}°C</span>
                    </div>
                  )}
                  {weather.cloudCover && (
                    <div className="stat">
                      <span className="label">Sky</span>
                      <span className="value">{weather.cloudCover}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="no-data">No weather data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConditionsCard;
