import './ProgressScreen.css';

// Pre-defined step labels shown while waiting for real progress events
const DEFAULT_STEPS = [
  { name: 'geo', label: 'Detecting your location' },
  { name: 'nearest', label: 'Finding your nearest break' },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
      <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Real-time progress screen that shows scraper steps as they complete.
 *
 * Props:
 *   geoStep   - { status: 'loading'|'done', snippet } for geo detection
 *   spotStep  - { status: 'loading'|'done', snippet } for nearest spot lookup
 *   steps     - array from useSSEProgress hook (real scraper progress)
 *   isStreaming - whether SSE is still active
 */
export default function ProgressScreen({ geoStep, spotStep, steps, total, isStreaming }) {
  // Build the unified step list
  const allSteps = [];

  // Geo detection step
  if (geoStep) {
    allSteps.push({
      name: 'geo',
      label: DEFAULT_STEPS[0].label,
      status: geoStep.status,
      snippet: geoStep.snippet,
    });
  }

  // Nearest spot step
  if (spotStep) {
    allSteps.push({
      name: 'nearest',
      label: DEFAULT_STEPS[1].label,
      status: spotStep.status,
      snippet: spotStep.snippet,
    });
  }

  // Scraper steps from SSE
  steps.forEach((step) => {
    allSteps.push(step);
  });

  // Count completed scrapers (not geo/nearest)
  const scrapersCompleted = steps.length;
  const progressPct = total > 0
    ? Math.round((scrapersCompleted / total) * 100)
    : 0;

  return (
    <div className="progress-screen">
      <div className="progress-header">
        <h2>Getting your surf report</h2>
        <p>Gathering data from multiple sources</p>
      </div>

      <div className="progress-steps">
        {allSteps.map((step, i) => (
          <div
            className="progress-step"
            key={step.name}
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <div className="progress-step-left">
              <div className={`progress-step-icon ${step.status}`}>
                {step.status === 'done' && <CheckIcon />}
                {step.status === 'failed' && <XIcon />}
                {step.status === 'loading' && <div className="progress-step-spinner" />}
              </div>
              <span className="progress-step-label">{step.label}</span>
            </div>
            {step.snippet && (
              <span className="progress-step-snippet">{step.snippet}</span>
            )}
          </div>
        ))}
      </div>

      {/* Show progress bar once SSE scraper data starts coming in */}
      {(isStreaming || scrapersCompleted > 0) && (
        <div className="progress-bar-container">
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
