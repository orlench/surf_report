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

function SpotSelector({ spots, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Find selected spot name (check hardcoded spots + custom spots)
  const selectedSpot = spots?.find(s => s.id === value);
  const customSpots = useMemo(() => getRecentCustomSpots(), []);
  const customMatch = customSpots.find(s => s.id === value);
  const selectedLabel = selectedSpot ? selectedSpot.name : (customMatch ? customMatch.name : value);

  // Group and filter spots
  const { grouped, flatList } = useMemo(() => {
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
    Object.entries(g).forEach(([, countrySpots]) => {
      countrySpots.forEach(spot => flat.push(spot));
    });

    return { grouped: g, flatList: flat };
  }, [spots, search]);

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
            {/* Recent custom spots */}
            {!search && customSpots.length > 0 && (
              <div>
                <div className="spot-selector-group">Recent</div>
                {customSpots.slice(0, 5).map(cs => (
                  <button
                    key={cs.id}
                    className={`spot-option${cs.id === value ? ' selected' : ''}`}
                    onClick={() => handleSelect(cs.id)}
                    type="button"
                  >
                    {cs.name}
                  </button>
                ))}
              </div>
            )}
            {flatList.length === 0 && !customSpots.length && (
              <div className="spot-selector-empty">No spots found</div>
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
          {/* Find on map button */}
          <button
            className="spot-selector-map-btn"
            onClick={() => { setIsOpen(false); setShowMap(true); }}
            type="button"
          >
            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
              <path d="M1 4l6-2 6 2 6-2v14l-6 2-6-2-6 2V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M7 2v14M13 6v14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Find on map
          </button>
        </div>
      )}

      {/* Map overlay */}
      {showMap && (
        <SpotMap
          onSelect={(spot) => {
            const id = slugify(spot.name);
            // Save to recent custom spots
            const existing = getRecentCustomSpots();
            const updated = [
              { id, name: spot.name, lat: spot.lat, lon: spot.lon, country: spot.country, region: spot.region },
              ...existing.filter(s => s.id !== id)
            ].slice(0, 20);
            localStorage.setItem('customSpots', JSON.stringify(updated));
            // Also store the active custom spot metadata for Dashboard
            localStorage.setItem('activeCustomSpot', JSON.stringify({
              id, name: spot.name, lat: spot.lat, lon: spot.lon, country: spot.country
            }));
            setShowMap(false);
            onChange(id);
          }}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}

export default SpotSelector;
