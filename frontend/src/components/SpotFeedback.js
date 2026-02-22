import { useState, useEffect, useCallback } from 'react';
import { submitFeedback, fetchFeedback } from '../api/surfApi';
import './SpotFeedback.css';

const FACTOR_LABELS = {
  waveHeight: 'Wave Height',
  wavePeriod: 'Wave Period',
  swellQuality: 'Swell Quality',
  windSpeed: 'Surface Calm',
  windDirection: 'Wind Direction',
  waveDirection: 'Wave Direction'
};

function recalculateScore(breakdown, weights, multipliers) {
  if (!breakdown || !weights || !multipliers) return null;

  // Apply multipliers to weights, then normalize
  const adjusted = {};
  let sum = 0;
  for (const key of Object.keys(FACTOR_LABELS)) {
    adjusted[key] = (weights[key] || 0) * (multipliers[key] || 1.0);
    sum += adjusted[key];
  }
  if (sum === 0) return null;
  for (const key in adjusted) adjusted[key] /= sum;

  // Weighted average of breakdown scores
  let overall = 0;
  for (const key of Object.keys(FACTOR_LABELS)) {
    overall += (breakdown[key] || 0) * (adjusted[key] || 0);
  }
  return Math.round(Math.max(0, Math.min(100, overall)));
}

function getRating(score) {
  if (score >= 85) return 'EPIC';
  if (score >= 75) return 'GREAT';
  if (score >= 65) return 'GOOD';
  if (score >= 50) return 'FAIR';
  if (score >= 35) return 'MARGINAL';
  if (score >= 20) return 'POOR';
  return 'FLAT';
}

function SpotFeedback({ spotId, breakdown, weights, originalScore, onScoreAdjusted }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [multipliers, setMultipliers] = useState(null);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [showRecent, setShowRecent] = useState(false);

  // Load existing feedback for this spot
  useEffect(() => {
    if (!spotId) return;
    fetchFeedback(spotId)
      .then(data => {
        setFeedbackCount(data.feedbackCount || 0);
        setRecentFeedback(data.recentFeedback || []);
        if (data.multipliers) {
          setMultipliers(data.multipliers);
          const adjusted = recalculateScore(breakdown, weights, data.multipliers);
          if (adjusted !== null && onScoreAdjusted) {
            onScoreAdjusted(adjusted, getRating(adjusted));
          }
        }
      })
      .catch(() => {});
  }, [spotId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const data = await submitFeedback(spotId, text.trim());
      if (data.multipliers) {
        setMultipliers(data.multipliers);
        const adjusted = recalculateScore(breakdown, weights, data.multipliers);
        if (adjusted !== null && onScoreAdjusted) {
          onScoreAdjusted(adjusted, getRating(adjusted));
        }
      }
      setFeedbackCount(data.feedbackCount || feedbackCount + 1);
      setText('');
      // Refresh recent feedback
      fetchFeedback(spotId).then(d => setRecentFeedback(d.recentFeedback || [])).catch(() => {});
    } catch (err) {
      // Silently fail
    }
    setLoading(false);
  }, [text, spotId, loading, breakdown, weights, onScoreAdjusted, feedbackCount]);

  return (
    <div className="spot-feedback">
      <div className="spot-feedback-header">
        <span className="spot-feedback-label">Know this break?</span>
        {feedbackCount > 0 && (
          <span className="spot-feedback-badge">
            Tuned by {feedbackCount} surfer{feedbackCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <textarea
        className="spot-feedback-input"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="e.g. Wave period is everything at this spot — short period waves just close out on the reef. Wind direction barely matters because the cliffs block most of it. Needs a solid SW swell to really turn on."
        rows={3}
        maxLength={500}
        disabled={loading}
      />

      <div className="spot-feedback-actions">
        <button
          className="spot-feedback-submit"
          onClick={handleSubmit}
          disabled={!text.trim() || text.trim().length < 10 || loading}
          type="button"
        >
          {loading ? 'Reading the local knowledge...' : 'Apply'}
        </button>
        {multipliers && (
          <div className="spot-feedback-weights">
            {Object.entries(multipliers).map(([key, val]) => {
              if (!FACTOR_LABELS[key]) return null;
              const pct = Math.round((val - 1) * 100);
              if (Math.abs(pct) < 5) return null;
              return (
                <span key={key} className={`spot-feedback-tag ${pct > 0 ? 'up' : 'down'}`}>
                  {FACTOR_LABELS[key]} {pct > 0 ? '+' : ''}{pct}%
                </span>
              );
            })}
          </div>
        )}
      </div>

      {recentFeedback.length > 0 && (
        <div className="spot-feedback-recent">
          <button
            className="spot-feedback-recent-toggle"
            onClick={() => setShowRecent(prev => !prev)}
            type="button"
          >
            {showRecent ? 'Hide' : 'Show'} local tips ({recentFeedback.length})
          </button>
          {showRecent && (
            <div className="spot-feedback-recent-list">
              {recentFeedback.map((fb, i) => (
                <div key={i} className="spot-feedback-recent-item">
                  <p className="spot-feedback-recent-text">"{fb.text}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SpotFeedback;
