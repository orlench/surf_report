import { useState, useEffect } from 'react';
import { fetchNearestSpot } from '../api/surfApi';

/**
 * Detects the visitor's location via IP geolocation.
 * Always fetches on mount to populate nearbySpots for the dropdown.
 * When `autoSelect` is true, also sets nearestSpot for auto-selection (first visit).
 */
export default function useGeoDetect(autoSelect) {
  const [location, setLocation] = useState(null);
  const [nearestSpot, setNearestSpot] = useState(null);
  const [nearestSpotName, setNearestSpotName] = useState(null);
  const [nearbySpots, setNearbySpots] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsDetecting(true);

    fetchNearestSpot()
      .then((data) => {
        if (cancelled) return;
        setLocation(data.location);
        setNearbySpots(data.nearbySpots || []);
        if (autoSelect) {
          setNearestSpot(data.nearestSpot);
          setNearestSpotName(data.nearestSpotName);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsDetecting(false);
      });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { location, nearestSpot, nearestSpotName, nearbySpots, isDetecting, error };
}
