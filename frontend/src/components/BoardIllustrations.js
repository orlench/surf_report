/**
 * Detailed inline SVG surfboard illustrations — top-down view.
 * White on colored hero backgrounds. Each shows distinctive outline,
 * stringer, fin setup, and tail shape for the board type.
 */

function Longboard() {
  // Classic log: wide rounded nose, square tail, single fin, full stringer
  return (
    <svg viewBox="0 0 40 160" className="board-svg" aria-label="Longboard">
      <defs>
        <linearGradient id="lg-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Board outline */}
      <path d="M20 2 C28 2, 35 10, 36 28 L37 70 Q37 100, 36 125 C35 140, 30 152, 27 156 L20 158 L13 156 C10 152, 5 140, 4 125 Q3 100, 3 70 L4 28 C5 10, 12 2, 20 2Z"
        fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="0.5" />
      {/* Gloss highlight */}
      <path d="M20 2 C28 2, 35 10, 36 28 L37 70 Q37 100, 36 125 C35 140, 30 152, 27 156 L20 158 L13 156 C10 152, 5 140, 4 125 Q3 100, 3 70 L4 28 C5 10, 12 2, 20 2Z"
        fill="url(#lg-shine)" />
      {/* Stringer */}
      <line x1="20" y1="6" x2="20" y2="155" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
      {/* Nose concave hint */}
      <ellipse cx="20" cy="16" rx="8" ry="3" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
      {/* Single fin */}
      <path d="M20 142 L17 152 Q20 154, 23 152 Z" fill="currentColor" opacity="0.5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
      {/* Leash plug */}
      <circle cx="20" cy="150" r="1" fill="rgba(0,0,0,0.12)" />
    </svg>
  );
}

function Fish() {
  // Classic fish: wide body, swallowtail, twin keel fins
  return (
    <svg viewBox="0 0 44 120" className="board-svg" aria-label="Fish">
      <defs>
        <linearGradient id="fish-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="35%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="65%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Board outline — wide, blunt nose, swallowtail */}
      <path d="M22 3 C30 3, 38 12, 40 28 L41 55 Q41 80, 39 95 C38 104, 34 112, 30 116 L28 118 Q25 114, 22 118 Q19 114, 16 118 L14 116 C10 112, 6 104, 5 95 Q3 80, 3 55 L4 28 C6 12, 14 3, 22 3Z"
        fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="0.5" />
      {/* Gloss */}
      <path d="M22 3 C30 3, 38 12, 40 28 L41 55 Q41 80, 39 95 C38 104, 34 112, 30 116 L28 118 Q25 114, 22 118 Q19 114, 16 118 L14 116 C10 112, 6 104, 5 95 Q3 80, 3 55 L4 28 C6 12, 14 3, 22 3Z"
        fill="url(#fish-shine)" />
      {/* Stringer */}
      <line x1="22" y1="7" x2="22" y2="115" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
      {/* Twin keel fins — larger, raked */}
      <path d="M13 96 L9 108 Q11 111, 14 107 Z" fill="currentColor" opacity="0.5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
      <path d="M31 96 L35 108 Q33 111, 30 107 Z" fill="currentColor" opacity="0.5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
      {/* Concave lines */}
      <path d="M10 35 Q22 30, 34 35" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
      <path d="M8 60 Q22 55, 36 60" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
    </svg>
  );
}

function Midlength() {
  // Egg / mid-length: rounded nose, gentle curves, 2+1 fin setup
  return (
    <svg viewBox="0 0 40 140" className="board-svg" aria-label="Mid-length">
      <defs>
        <linearGradient id="mid-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Board outline — rounded egg shape */}
      <path d="M20 3 C28 3, 34 12, 36 26 L37 60 Q37 90, 35 110 C34 122, 28 132, 24 135 Q20 137, 16 135 C12 132, 6 122, 5 110 Q3 90, 3 60 L4 26 C6 12, 12 3, 20 3Z"
        fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="0.5" />
      <path d="M20 3 C28 3, 34 12, 36 26 L37 60 Q37 90, 35 110 C34 122, 28 132, 24 135 Q20 137, 16 135 C12 132, 6 122, 5 110 Q3 90, 3 60 L4 26 C6 12, 12 3, 20 3Z"
        fill="url(#mid-shine)" />
      {/* Stringer */}
      <line x1="20" y1="7" x2="20" y2="133" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
      {/* 2+1 fin setup: center fin + two side bites */}
      <path d="M20 120 L18 130 Q20 132, 22 130 Z" fill="currentColor" opacity="0.5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
      <path d="M11 118 L9 125 Q11 127, 13 124 Z" fill="currentColor" opacity="0.45" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />
      <path d="M29 118 L31 125 Q29 127, 27 124 Z" fill="currentColor" opacity="0.45" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />
      {/* Rail line hint */}
      <path d="M10 30 Q20 26, 30 30" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.4" />
      {/* Leash plug */}
      <circle cx="20" cy="131" r="0.8" fill="rgba(0,0,0,0.12)" />
    </svg>
  );
}

function Shortboard() {
  // Performance shortboard: pointed nose, narrow, thruster fins, pulled tail
  return (
    <svg viewBox="0 0 36 130" className="board-svg" aria-label="Shortboard">
      <defs>
        <linearGradient id="sb-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Board outline — pointed nose, squash tail */}
      <path d="M18 2 C22 4, 30 16, 32 30 L33 55 Q33 80, 32 100 C31 110, 27 120, 24 124 L22 126 Q20 127, 18 126 Q16 127, 14 126 L12 124 C9 120, 5 110, 4 100 Q3 80, 3 55 L4 30 C6 16, 14 4, 18 2Z"
        fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="0.5" />
      <path d="M18 2 C22 4, 30 16, 32 30 L33 55 Q33 80, 32 100 C31 110, 27 120, 24 124 L22 126 Q20 127, 18 126 Q16 127, 14 126 L12 124 C9 120, 5 110, 4 100 Q3 80, 3 55 L4 30 C6 16, 14 4, 18 2Z"
        fill="url(#sb-shine)" />
      {/* Stringer */}
      <line x1="18" y1="5" x2="18" y2="124" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
      {/* Thruster fins (3) */}
      <path d="M18 110 L16 120 Q18 122, 20 120 Z" fill="currentColor" opacity="0.5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
      <path d="M9 106 L7 114 Q9 116, 11 113 Z" fill="currentColor" opacity="0.45" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />
      <path d="M27 106 L29 114 Q27 116, 25 113 Z" fill="currentColor" opacity="0.45" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />
      {/* Concave channels */}
      <path d="M8 40 Q18 36, 28 40" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.4" />
      <path d="M7 65 Q18 61, 29 65" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.4" />
      {/* Nose rocker hint */}
      <path d="M14 8 Q18 5, 22 8" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="0.4" />
      {/* Leash plug */}
      <circle cx="18" cy="122" r="0.8" fill="rgba(0,0,0,0.12)" />
    </svg>
  );
}

function Stepup() {
  // Step-up: longer shortboard, pintail, slightly wider, thruster fins
  return (
    <svg viewBox="0 0 36 145" className="board-svg" aria-label="Step-up">
      <defs>
        <linearGradient id="su-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Board outline — pointed nose, pintail */}
      <path d="M18 2 C23 4, 31 18, 33 34 L34 65 Q34 95, 32 115 C31 126, 26 135, 22 140 L18 143 L14 140 C10 135, 5 126, 4 115 Q2 95, 2 65 L3 34 C5 18, 13 4, 18 2Z"
        fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="0.5" />
      <path d="M18 2 C23 4, 31 18, 33 34 L34 65 Q34 95, 32 115 C31 126, 26 135, 22 140 L18 143 L14 140 C10 135, 5 126, 4 115 Q2 95, 2 65 L3 34 C5 18, 13 4, 18 2Z"
        fill="url(#su-shine)" />
      {/* Stringer */}
      <line x1="18" y1="6" x2="18" y2="140" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
      {/* Thruster fins */}
      <path d="M18 126 L16 136 Q18 138, 20 136 Z" fill="currentColor" opacity="0.5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
      <path d="M9 122 L7 130 Q9 132, 11 129 Z" fill="currentColor" opacity="0.45" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />
      <path d="M27 122 L29 130 Q27 132, 25 129 Z" fill="currentColor" opacity="0.45" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />
      {/* Concave */}
      <path d="M8 45 Q18 41, 28 45" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.4" />
      {/* Leash plug */}
      <circle cx="18" cy="138" r="0.8" fill="rgba(0,0,0,0.12)" />
    </svg>
  );
}

function Gun() {
  // Big wave gun: very long, narrow, heavy pintail, single or thruster
  return (
    <svg viewBox="0 0 30 170" className="board-svg" aria-label="Gun">
      <defs>
        <linearGradient id="gun-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Board outline — long, narrow, pulled nose and tail */}
      <path d="M15 2 C19 5, 25 20, 27 38 L28 70 Q28 110, 26 135 C25 148, 21 158, 18 163 L15 166 L12 163 C9 158, 5 148, 4 135 Q2 110, 2 70 L3 38 C5 20, 11 5, 15 2Z"
        fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="0.5" />
      <path d="M15 2 C19 5, 25 20, 27 38 L28 70 Q28 110, 26 135 C25 148, 21 158, 18 163 L15 166 L12 163 C9 158, 5 148, 4 135 Q2 110, 2 70 L3 38 C5 20, 11 5, 15 2Z"
        fill="url(#gun-shine)" />
      {/* Stringer */}
      <line x1="15" y1="6" x2="15" y2="163" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
      {/* Thruster fins */}
      <path d="M15 148 L13 158 Q15 160, 17 158 Z" fill="currentColor" opacity="0.5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
      <path d="M8 144 L6 152 Q8 154, 10 151 Z" fill="currentColor" opacity="0.45" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />
      <path d="M22 144 L24 152 Q22 154, 20 151 Z" fill="currentColor" opacity="0.45" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />
      {/* Leash plug */}
      <circle cx="15" cy="160" r="0.8" fill="rgba(0,0,0,0.12)" />
    </svg>
  );
}

function SUP() {
  // Stand-up paddleboard: thick, wide, round nose, deck pad, handle, fin
  return (
    <svg viewBox="0 0 46 160" className="board-svg" aria-label="SUP">
      <defs>
        <linearGradient id="sup-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="35%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="65%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Board outline — wide and thick */}
      <path d="M23 3 C32 3, 40 12, 42 28 L43 65 Q43 100, 41 125 C40 140, 34 150, 29 154 Q23 158, 17 154 C12 150, 6 140, 5 125 Q3 100, 3 65 L4 28 C6 12, 14 3, 23 3Z"
        fill="currentColor" opacity="0.85" stroke="currentColor" strokeWidth="0.5" />
      <path d="M23 3 C32 3, 40 12, 42 28 L43 65 Q43 100, 41 125 C40 140, 34 150, 29 154 Q23 158, 17 154 C12 150, 6 140, 5 125 Q3 100, 3 65 L4 28 C6 12, 14 3, 23 3Z"
        fill="url(#sup-shine)" />
      {/* Stringer */}
      <line x1="23" y1="7" x2="23" y2="152" stroke="rgba(0,0,0,0.12)" strokeWidth="0.6" />
      {/* Deck pad area */}
      <rect x="13" y="55" width="20" height="45" rx="4" fill="rgba(0,0,0,0.06)" />
      {/* Deck pad grip lines */}
      <line x1="15" y1="62" x2="31" y2="62" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      <line x1="15" y1="68" x2="31" y2="68" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      <line x1="15" y1="74" x2="31" y2="74" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      <line x1="15" y1="80" x2="31" y2="80" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      <line x1="15" y1="86" x2="31" y2="86" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      <line x1="15" y1="92" x2="31" y2="92" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      {/* Carry handle */}
      <rect x="19" y="76" width="8" height="3" rx="1.5" fill="rgba(0,0,0,0.1)" />
      {/* Single fin */}
      <path d="M23 138 L20 148 Q23 151, 26 148 Z" fill="currentColor" opacity="0.5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
      {/* Leash plug */}
      <circle cx="23" cy="149" r="1" fill="rgba(0,0,0,0.12)" />
    </svg>
  );
}

function AnyBoard() {
  // "Any board" — show a quiver of 3 boards fanned out
  return (
    <svg viewBox="0 0 60 130" className="board-svg" aria-label="Any board">
      {/* Left board (longboard silhouette, tilted) */}
      <g transform="rotate(-12 30 65)" opacity="0.5">
        <path d="M24 5 C28 5, 32 12, 33 22 L33 55 Q33 80, 32 95 C31 105, 28 110, 26 112 L24 114 L22 112 C20 110, 17 105, 16 95 Q15 80, 15 55 L16 22 C17 12, 20 5, 24 5Z"
          fill="currentColor" stroke="currentColor" strokeWidth="0.3" />
      </g>
      {/* Center board (shortboard, upright) */}
      <g opacity="0.85">
        <path d="M30 2 C33 4, 38 14, 39 26 L39 55 Q39 80, 38 98 C37 108, 34 116, 32 119 L30 121 L28 119 C26 116, 23 108, 22 98 Q21 80, 21 55 L22 26 C23 14, 27 4, 30 2Z"
          fill="currentColor" stroke="currentColor" strokeWidth="0.4" />
        <line x1="30" y1="6" x2="30" y2="118" stroke="rgba(0,0,0,0.12)" strokeWidth="0.5" />
      </g>
      {/* Right board (fish silhouette, tilted) */}
      <g transform="rotate(12 30 65)" opacity="0.5">
        <path d="M36 8 C40 8, 44 15, 45 24 L45 52 Q45 72, 44 85 C43 93, 40 100, 38 103 Q36 100, 34 103 C32 100, 29 93, 28 85 Q27 72, 27 52 L28 24 C29 15, 32 8, 36 8Z"
          fill="currentColor" stroke="currentColor" strokeWidth="0.3" />
      </g>
    </svg>
  );
}

const BOARD_COMPONENTS = {
  longboard: Longboard,
  fish: Fish,
  midlength: Midlength,
  shortboard: Shortboard,
  stepup: Stepup,
  gun: Gun,
  sup: SUP,
  any: AnyBoard
};

export function getBoardSVG(boardType) {
  const Component = BOARD_COMPONENTS[boardType] || Midlength;
  return <Component />;
}
