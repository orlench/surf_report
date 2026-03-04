import './SkeletonDashboard.css';

const BREAKDOWN_WIDTHS = [72, 58, 85, 45, 63, 50];
const FORECAST_BLOCKS = 4;

export default function SkeletonDashboard({ spotName }) {
  return (
    <div className="skeleton-dashboard">

      {/* Hero */}
      <div className="skeleton-hero">
        {spotName && (
          <div style={{ fontSize: '0.8rem', color: '#a0aec0', marginBottom: -8 }}>
            Loading conditions for <strong>{spotName}</strong>…
          </div>
        )}
        <div className="sk sk-hero-verdict" />
        <div className="sk sk-hero-gauge" />
        <div className="sk sk-hero-explanation" />
        <div className="sk sk-hero-wave" />
        <div className="sk-hero-pills">
          {[80, 70, 90, 75].map((w, i) => (
            <div key={i} className="sk sk-hero-pill" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="skeleton-section">
        <div className="sk sk-section-title" />
        <div className="sk-breakdown-rows">
          {BREAKDOWN_WIDTHS.map((w, i) => (
            <div key={i} className="sk-breakdown-row">
              <div className="sk-breakdown-top">
                <div className="sk sk-breakdown-grade" />
                <div className="sk sk-breakdown-label" style={{ width: 70 + (i % 3) * 20 }} />
              </div>
              <div className="sk sk-breakdown-bar" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Forecast */}
      <div className="skeleton-section">
        <div className="sk sk-section-title" />
        <div className="sk sk-forecast-summary" />
        <div className="sk-forecast-timeline">
          {Array.from({ length: FORECAST_BLOCKS }).map((_, i) => (
            <div key={i} className="sk-forecast-block">
              <div className="sk sk-label" />
              <div className="sk sk-score" />
              <div className="sk sk-bar" />
              <div className="sk sk-rating" />
            </div>
          ))}
        </div>
      </div>

      {/* Gear */}
      <div className="skeleton-section">
        <div className="sk sk-section-title" />
        <div className="sk-gear-grid">
          {[0, 1].map(i => (
            <div key={i} className="sk-gear-card">
              <div className="sk sk-gear-icon" />
              <div className="sk-gear-body">
                <div className="sk sk-gear-title" />
                <div className="sk sk-gear-desc" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
