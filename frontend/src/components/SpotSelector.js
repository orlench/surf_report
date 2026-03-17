import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import SpotMap from './SpotMap';
import './SpotSelector.css';

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function getRecentCustomSpots() {
  try {
    return JSON.parse(localStorage.getItem('customSpots') || '[]');
  } catch { return []; }
}

function SpotSelector({ spots, value, onChange, nearbySpots = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapInitialSearch, setMapInitialSearch] = useState('');
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(-1);
  const [customSpots, setCustomSpots] = useState(() => getRecentCustomSpots());
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Find selected spot name (check hardcoded spots + custom spots)
  const selectedSpot = spots?.find(s => s.id === value);
  const customMatch = customSpots.find(s => s.id === value);
  const selectedLabel = selectedSpot ? selectedSpot.name : (customMatch ? customMatch.name : value);

  // Build nearby spot IDs set for deduplication
  const nearbyIds = useMemo(() => new Set(nearbySpots.map(s => s.id)), [nearbySpots]);

  // Group and filter spots
  const { grouped, flatList, recentFiltered } = useMemo(() => {
    if (!search && nearbySpots.length > 0) {
      // Geo resolved: show nearbySpots + recent custom spots (deduped)
      const flat = [];
      nearbySpots.forEach(s => flat.push(s));
      const recent = customSpots.filter(cs => !nearbyIds.has(cs.id)).slice(0, 5);
      recent.forEach(cs => flat.push(cs));
      return { grouped: {}, flatList: flat, recentFiltered: recent };
    }

    // Searching, or geo not yet resolved: filter all spots by name/country
    const filtered = (spots || []).filter(spot => {
      if (!search) return true;
      const q = search.toLowerCase();
      return spot.name.toLowerCase().includes(q) ||
        spot.country.toLowerCase().includes(q);
    });

    const g = {};
    filtered.forEach(spot => {
      const country = spot.country || 'Other';
      if (!g[country]) g[country] = [];
      g[country].push(spot);
    });

    const flat = [];
    // Include custom spots in flatList for keyboard nav (fallback, no search)
    const recent = !search ? customSpots.slice(0, 5) : [];
    recent.forEach(cs => flat.push(cs));
    Object.entries(g).forEach(([, countrySpots]) => {
      countrySpots.forEach(spot => flat.push(spot));
    });

    return { grouped: g, flatList: flat, recentFiltered: recent };
  }, [spots, search, nearbySpots, nearbyIds, customSpots]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setCustomSpots(getRecentCustomSpots());
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.spot-option');
      if (items[highlighted]) {
        items[highlighted].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlighted]);

  const handleSelect = useCallback((spotId) => {
    onChange(spotId);
    setIsOpen(false);
    setSearch('');
    setHighlighted(-1);
  }, [onChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(prev => Math.min(prev + 1, flatList.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(prev => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Enter' && highlighted >= 0 && flatList[highlighted]) {
      e.preventDefault();
      handleSelect(flatList[highlighted].id);
    }
  }, [flatList, highlighted, handleSelect]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlighted(flatList.length > 0 ? 0 : -1);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="spot-selector" ref={containerRef}>
      <div className="spot-selector-row">
        <button
          className="spot-selector-trigger"
          onClick={() => setIsOpen(prev => !prev)}
          type="button"
        >
          <span className="spot-selector-value">{selectedLabel}</span>
          <svg className="spot-selector-chevron" viewBox="0 0 10 7" fill="none" data-open={isOpen}>
            <path d="M1 1.5L5 5.5L9 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className="spot-selector-map-btn"
          onClick={() => { setMapInitialSearch(''); setIsOpen(false); setShowMap(true); }}
          type="button"
          title="Find on map"
        >
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <path d="M1 4l6-2 6 2 6-2v14l-6 2-6-2-6 2V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M7 2v14M13 6v14" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="spot-selector-dropdown">
          <div className="spot-selector-search-wrap">
            <input
              ref={inputRef}
              className="spot-selector-search"
              type="text"
              placeholder="Search spots..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="spot-selector-list" ref={listRef}>
            {/* Default view: Near you + Recent */}
            {!search && nearbySpots.length > 0 && (
              <div>
                <div className="spot-selector-group">Near you</div>
                {nearbySpots.map(spot => {
                  const idx = flatList.indexOf(spot);
                  return (
                    <button
                      key={spot.id}
                      className={`spot-option${spot.id === value ? ' selected' : ''}${idx === highlighted ? ' highlighted' : ''}`}
                      onClick={() => handleSelect(spot.id)}
                      type="button"
                    >
                      <span>{spot.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!search && recentFiltered.length > 0 && (
              <div>
                <div className="spot-selector-group">Recent</div>
                {recentFiltered.map(cs => {
                  const idx = flatList.indexOf(cs);
                  return (
                    <button
                      key={cs.id}
                      className={`spot-option${cs.id === value ? ' selected' : ''}${idx === highlighted ? ' highlighted' : ''}`}
                      onClick={() => handleSelect(cs.id)}
                      type="button"
                    >
                      {cs.name}
                    </button>
                  );
                })}
              </div>
            )}
            {flatList.length === 0 && !search && (
              <div className="spot-selector-empty">No spots found</div>
            )}
            {/* Search results grouped by country (also fallback when geo not loaded) */}
            {search && flatList.length === 0 && (
              <button
                className="spot-selector-add-btn"
                onClick={() => {
                  setMapInitialSearch(search);
                  setIsOpen(false);
                  setSearch('');
                  setShowMap(true);
                }}
                type="button"
              >
                <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                  <path d="M1 4l6-2 6 2 6-2v14l-6 2-6-2-6 2V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M7 2v14M13 6v14" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Find "{search}" on map
              </button>
            )}
            {Object.entries(grouped).map(([country, countrySpots]) => (
              <div key={country}>
                <div className="spot-selector-group">{country}</div>
                {countrySpots.map(spot => {
                  const idx = flatList.indexOf(spot);
                  return (
                    <button
                      key={spot.id}
                      className={`spot-option${spot.id === value ? ' selected' : ''}${idx === highlighted ? ' highlighted' : ''}`}
                      onClick={() => handleSelect(spot.id)}
                      type="button"
                    >
                      {spot.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map overlay */}
      {showMap && (
        <SpotMap
          initialSearch={mapInitialSearch}
          onSelect={(spot) => {
            const id = slugify(spot.name);
            const spotMeta = { id, name: spot.name, lat: spot.lat, lon: spot.lon, country: spot.country, region: spot.region };
            // Save to recent custom spots
            const existing = getRecentCustomSpots();
            const updated = [spotMeta, ...existing.filter(s => s.id !== id)].slice(0, 20);
            localStorage.setItem('customSpots', JSON.stringify(updated));
            localStorage.setItem('activeCustomSpot', JSON.stringify(spotMeta));
            setCustomSpots(updated);
            setShowMap(false);
            onChange(id, spotMeta);
          }}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}

export default SpotSelector;
