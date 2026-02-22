import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import spotData from '../data/surfSpots.json';
import './SpotMap.css';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const DEFAULT_VIEW = { latitude: 30, longitude: 0, zoom: 2 };

// Convert spots to GeoJSON for clustering
function spotsToGeoJSON(spots) {
  return {
    type: 'FeatureCollection',
    features: spots.map((spot, i) => ({
      type: 'Feature',
      id: i,
      geometry: { type: 'Point', coordinates: [spot.lon, spot.lat] },
      properties: {
        name: spot.name,
        country: spot.country,
        region: spot.region,
        idx: i
      }
    }))
  };
}

function SpotMap({ onSelect, onClose }) {
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const [viewState, setViewState] = useState(DEFAULT_VIEW);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [geolocated, setGeolocated] = useState(false);

  const allSpots = spotData.spots;
  const geojson = useMemo(() => spotsToGeoJSON(allSpots), [allSpots]);

  // Geolocate on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setViewState(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          zoom: 8
        }));
        setGeolocated(true);
      },
      () => { /* permission denied — stay at default view */ },
      { timeout: 5000 }
    );
  }, []);

  // Focus search on mount
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 300);
  }, []);

  // Search filtering
  useEffect(() => {
    if (!search || search.length < 2) {
      setSearchResults([]);
      return;
    }
    const q = search.toLowerCase();
    const results = allSpots
      .filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q)
      )
      .slice(0, 20);
    setSearchResults(results);
  }, [search, allSpots]);

  const flyTo = useCallback((lat, lon, zoom = 12) => {
    mapRef.current?.flyTo({
      center: [lon, lat],
      zoom,
      duration: 1500,
      essential: true
    });
  }, []);

  const handleSearchSelect = useCallback((spot) => {
    setSearch('');
    setSearchResults([]);
    setSelectedSpot(spot);
    flyTo(spot.lat, spot.lon);
  }, [flyTo]);

  const handleMapClick = useCallback(async (e) => {
    // Get the underlying MapLibre map instance
    const mapInstance = mapRef.current?.getMap ? mapRef.current.getMap() : mapRef.current;
    if (!mapInstance) return;

    // Check for cluster click
    const clusterFeatures = mapInstance.queryRenderedFeatures(e.point, {
      layers: ['clusters']
    });
    if (clusterFeatures.length > 0) {
      const cluster = clusterFeatures[0];
      const source = mapInstance.getSource('spots');
      try {
        const zoom = await source.getClusterExpansionZoom(cluster.properties.cluster_id);
        flyTo(
          cluster.geometry.coordinates[1],
          cluster.geometry.coordinates[0],
          zoom
        );
      } catch (err) {
        // Fallback: just zoom in a bit
        flyTo(
          cluster.geometry.coordinates[1],
          cluster.geometry.coordinates[0],
          (mapInstance.getZoom() || 2) + 3
        );
      }
      return;
    }

    // Check for spot pin click
    const spotFeatures = mapInstance.queryRenderedFeatures(e.point, {
      layers: ['spot-pins']
    });
    if (spotFeatures.length > 0) {
      const feature = spotFeatures[0];
      const idx = feature.properties.idx;
      const spot = allSpots[idx];
      if (spot) {
        setSelectedSpot(spot);
        flyTo(spot.lat, spot.lon);
      }
    }
  }, [allSpots, flyTo]);

  const handleConfirm = useCallback(() => {
    if (!selectedSpot) return;
    onSelect(selectedSpot);
  }, [selectedSpot, onSelect]);

  // Cluster + pin layers
  const clusterLayer = {
    id: 'clusters',
    type: 'circle',
    source: 'spots',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#3b82f6', 20,
        '#2563eb', 50,
        '#1d4ed8'
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        16, 20,
        22, 50,
        28
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255,255,255,0.3)'
    }
  };

  const clusterCountLayer = {
    id: 'cluster-count',
    type: 'symbol',
    source: 'spots',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-size': 12
    },
    paint: {
      'text-color': '#ffffff'
    }
  };

  const spotPinLayer = {
    id: 'spot-pins',
    type: 'circle',
    source: 'spots',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#3b82f6',
      'circle-radius': 6,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  };

  return createPortal(
    <div className="spot-map-overlay">
      {/* Close button */}
      <button className="spot-map-close" onClick={onClose} type="button">
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Search bar */}
      <div className="spot-map-search-container">
        <div className="spot-map-search-wrap">
          <svg className="spot-map-search-icon" viewBox="0 0 20 20" fill="none" width="16" height="16">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            className="spot-map-search"
            type="text"
            placeholder="Search surf spots..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="spot-map-search-clear" onClick={() => { setSearch(''); setSearchResults([]); }} type="button">
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="spot-map-results">
            {searchResults.map((spot, i) => (
              <button
                key={`${spot.name}-${spot.lat}-${spot.lon}`}
                className="spot-map-result"
                onClick={() => handleSearchSelect(spot)}
                type="button"
              >
                <span className="spot-map-result-name">{spot.name}</span>
                <span className="spot-map-result-loc">
                  {[spot.region, spot.country].filter(Boolean).join(', ')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={e => setViewState(e.viewState)}
        onClick={handleMapClick}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        cursor="pointer"
        attributionControl={false}
        interactiveLayerIds={['clusters', 'spot-pins']}
      >
        <NavigationControl position="bottom-right" />
        <Source
          id="spots"
          type="geojson"
          data={geojson}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...spotPinLayer} />
        </Source>

        {/* Selected spot marker */}
        {selectedSpot && (
          <Marker
            latitude={selectedSpot.lat}
            longitude={selectedSpot.lon}
            anchor="bottom"
          >
            <div className="spot-map-selected-pin">
              <svg viewBox="0 0 24 36" width="28" height="42">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#3b82f6" />
                <circle cx="12" cy="12" r="5" fill="#ffffff" />
              </svg>
            </div>
          </Marker>
        )}
      </Map>

      {/* Bottom sheet */}
      {selectedSpot && (
        <div className="spot-map-sheet">
          <div className="spot-map-sheet-handle" />
          <h3 className="spot-map-sheet-name">{selectedSpot.name}</h3>
          <p className="spot-map-sheet-loc">
            {[selectedSpot.region, selectedSpot.country].filter(Boolean).join(', ')}
          </p>
          <p className="spot-map-sheet-coords">
            {selectedSpot.lat.toFixed(4)}, {selectedSpot.lon.toFixed(4)}
          </p>
          <button
            className="spot-map-sheet-btn"
            onClick={handleConfirm}
            type="button"
          >
            Check conditions
          </button>
        </div>
      )}

      {/* Geolocate button */}
      {!geolocated && (
        <button
          className="spot-map-geolocate"
          onClick={() => {
            navigator.geolocation?.getCurrentPosition(
              (pos) => {
                flyTo(pos.coords.latitude, pos.coords.longitude, 8);
                setGeolocated(true);
              },
              () => {}
            );
          }}
          type="button"
          title="Go to my location"
        >
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>,
    document.body
  );
}

export default SpotMap;
