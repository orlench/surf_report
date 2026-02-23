import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchVapidKey, subscribePush, unsubscribePush, urlBase64ToUint8Array } from '../api/pushApi';
import './NotificationBell.css';

const MAX_SPOTS = 2;
const THRESHOLD_OPTIONS = [
  { value: 50, label: 'FAIR', desc: '50+' },
  { value: 65, label: 'GOOD', desc: '65+' },
  { value: 75, label: 'GREAT', desc: '75+' },
  { value: 85, label: 'EPIC', desc: '85+' }
];

function NotificationBell({ currentSpotId, currentSpotName }) {
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pushSubscriptions') || '[]'); }
    catch { return []; }
  });
  const [threshold, setThreshold] = useState(65);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);

  // Check if browser supports push
  const supported = 'serviceWorker' in navigator && 'PushManager' in window;

  // Persist subs to localStorage
  useEffect(() => {
    localStorage.setItem('pushSubscriptions', JSON.stringify(subs));
  }, [subs]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isSubscribed = useCallback(
    (spotId) => subs.some(s => s.spotId === spotId),
    [subs]
  );

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied');
        setLoading(false);
        return;
      }

      // Get service worker registration
      const reg = await navigator.serviceWorker.ready;

      // Get VAPID key
      const vapidKey = await fetchVapidKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      // Subscribe to push
      let pushSub = await reg.pushManager.getSubscription();
      if (!pushSub) {
        pushSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      // Send to backend
      const subJSON = pushSub.toJSON();
      await subscribePush(subJSON, currentSpotId, threshold);

      setSubs(prev => {
        const filtered = prev.filter(s => s.spotId !== currentSpotId);
        return [...filtered, { spotId: currentSpotId, spotName: currentSpotName, threshold }];
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to subscribe');
    }
    setLoading(false);
  };

  const handleUnsubscribe = async (spotId) => {
    setLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.getSubscription();
      if (pushSub) {
        await unsubscribePush(pushSub.endpoint, spotId);
      }
      setSubs(prev => prev.filter(s => s.spotId !== spotId));
    } catch (err) {
      setError(err.message || 'Failed to unsubscribe');
    }
    setLoading(false);
  };

  if (!supported) return null;

  const hasAnySub = subs.length > 0;

  return (
    <div className="notif-bell" ref={panelRef}>
      <button
        className={`notif-bell-btn ${hasAnySub ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        title="Surf alerts"
        type="button"
      >
        <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
          {hasAnySub ? (
            <path d="M10 2a5.5 5.5 0 00-5.5 5.5c0 3.38-1.5 5-1.5 5h14s-1.5-1.62-1.5-5A5.5 5.5 0 0010 2zm-1.5 13a1.5 1.5 0 003 0" fill="currentColor" />
          ) : (
            <path d="M10 2a5.5 5.5 0 00-5.5 5.5c0 3.38-1.5 5-1.5 5h14s-1.5-1.62-1.5-5A5.5 5.5 0 0010 2zm-1.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
          )}
        </svg>
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">Surf Alerts</div>

          {/* Existing subscriptions */}
          {subs.length > 0 && (
            <div className="notif-subs">
              {subs.map(sub => (
                <div key={sub.spotId} className="notif-sub-row">
                  <div className="notif-sub-info">
                    <span className="notif-sub-name">{sub.spotName || sub.spotId.replace(/_/g, ' ')}</span>
                    <span className="notif-sub-threshold">
                      {THRESHOLD_OPTIONS.find(t => t.value === sub.threshold)?.label || 'GOOD'}+
                    </span>
                  </div>
                  <button
                    className="notif-sub-remove"
                    onClick={() => handleUnsubscribe(sub.spotId)}
                    disabled={loading}
                    type="button"
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add current spot */}
          {!isSubscribed(currentSpotId) && subs.length < MAX_SPOTS && (
            <div className="notif-add">
              <div className="notif-add-spot">
                Alert me for <strong>{currentSpotName || currentSpotId.replace(/_/g, ' ')}</strong> when conditions reach:
              </div>
              <div className="notif-threshold-grid">
                {THRESHOLD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`notif-threshold-btn ${threshold === opt.value ? 'selected' : ''}`}
                    onClick={() => setThreshold(opt.value)}
                    type="button"
                  >
                    <span className="notif-threshold-label">{opt.label}</span>
                    <span className="notif-threshold-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <button
                className="notif-subscribe-btn"
                onClick={handleSubscribe}
                disabled={loading}
                type="button"
              >
                {loading ? 'Subscribing...' : 'Turn on alerts'}
              </button>
            </div>
          )}

          {/* Max spots reached */}
          {!isSubscribed(currentSpotId) && subs.length >= MAX_SPOTS && (
            <div className="notif-max-msg">
              Max {MAX_SPOTS} spots. Remove one to add another.
            </div>
          )}

          {/* Already subscribed to current spot */}
          {isSubscribed(currentSpotId) && subs.length < MAX_SPOTS && (
            <div className="notif-max-msg">
              You can add {MAX_SPOTS - subs.length} more spot{MAX_SPOTS - subs.length > 1 ? 's' : ''}.
            </div>
          )}

          {error && <div className="notif-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
