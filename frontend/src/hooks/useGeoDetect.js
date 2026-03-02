import { useState, useEffect } from 'react';
import { fetchNearestSpot } from '../api/surfApi';

/**
 * Detects the visitor's location via IP geolocation and returns the nearest spot.
 * Only fires when `enabled` is true (i.e. no selectedSpot in localStorage).
 */
export default function useGeoDetect(enabled) {
  const [location, setLocation] = useState(null);
  const [nearestSpot, setNearestSpot] = useState(null);
  const [nearestSpotName, setNearestSpotName] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setIsDetecting(true);

    fetchNearestSpot()
      .then((data) => {
        if (cancelled) return;
        setLocation(data.location);
        setNearestSpot(data.nearestSpot);
        setNearestSpotName(data.nearestSpotName);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        // Fallback to default spot
        setNearestSpot('netanya_kontiki');
        setNearestSpotName('Netanya Kontiki');
      })
      .finally(() => {
        if (!cancelled) setIsDetecting(false);
      });

    return () => { cancelled = true; };
  }, [enabled]);

  return { location, nearestSpot, nearestSpotName, isDetecting, error };
}
