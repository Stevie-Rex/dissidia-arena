/*
 * Original SVG for the lab: the hero, the crest frames, the crystal-shard cursor, the facet backdrop and a few
 * plain UI glyphs. Every colour is currentColor or a CSS variable, never a hex value. The nav and emblem icons
 * come from game-icons.net (see icons.tsx).
 */
import { useId, type ReactNode } from 'react'

import { GiFloatingCrystal, GiWingedSword } from './icons'

function Glyph({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function SunGlyph({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="16" cy="16" r="5" />
      <path d="M16 3 L16 7 M16 25 L16 29 M3 16 L7 16 M25 16 L29 16" />
    </Glyph>
  )
}

export function MoonGlyph({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M21 5 Q12 7 12 16 Q12 25 21 27 Q9 29 6 18 Q4 7 21 5 Z" />
    </Glyph>
  )
}

export function SoundGlyph({ muted, size }: { muted: boolean; size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M5 12 L10 12 L17 6 L17 26 L10 20 L5 20 Z" />
      {muted ? <path d="M21 12 L28 20 M28 12 L21 20" /> : <path d="M21 11 Q25 16 21 21 M24 8 Q31 16 24 24" />}
    </Glyph>
  )
}

/** The emblem for each game: game-icons' floating crystal for 012, winged sword for NT. */
export function GameEmblem({ game, size = 24 }: { game: '012' | 'NT'; size?: number }) {
  return game === '012' ? <GiFloatingCrystal size={size} /> : <GiWingedSword size={size} />
}

/** An original crystal-shard cursor, pointing right. It stands in for the 012 menu's glove. */
export function ShardCursor({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 40 24" aria-hidden focusable="false" className="lab-shard-cursor">
      <path d="M2 12 L14 3 L38 12 L14 21 Z" fill="var(--crystal-wash)" stroke="var(--silver-edge)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 3 L18 12 L14 21 M2 12 L38 12" stroke="var(--silver-hi)" strokeWidth="1" fill="none" opacity="0.8" />
    </svg>
  )
}

/* ---------- framed crests (prototype) ---------- */

export type Frame = 'none' | 'diamond' | 'hexagon' | 'shield'

const FRAME_PATHS: Record<Exclude<Frame, 'none'>, { outer: string; inner: string }> = {
  // A diamond with its four points cut off: the bevelled diamond.
  diamond: {
    outer: 'M44 4 L56 4 L96 44 L96 56 L56 96 L44 96 L4 56 L4 44 Z',
    inner: 'M45.5 10 L54.5 10 L90 45.5 L90 54.5 L54.5 90 L45.5 90 L10 54.5 L10 45.5 Z',
  },
  hexagon: {
    outer: 'M50 3 L93 27 L93 73 L50 97 L7 73 L7 27 Z',
    inner: 'M50 9.5 L87.5 30.5 L87.5 69.5 L50 90.5 L12.5 69.5 L12.5 30.5 Z',
  },
  shield: {
    outer: 'M8 6 L92 6 L92 46 Q92 80 50 97 Q8 80 8 46 Z',
    inner: 'M14 12 L86 12 L86 46 Q86 75 50 90.5 Q14 75 14 46 Z',
  },
}

/** A game emblem inside a silver-edged frame, drawn at any size. */
export function FramedCrest({ frame, game, size }: { frame: Frame; game: '012' | 'NT'; size: number }) {
  const id = useId()
  const emblem = Math.round(size * (frame === 'none' ? 0.8 : frame === 'shield' ? 0.5 : 0.52))
  return (
    <span className="lab-crest" style={{ width: size, height: size }}>
      {frame !== 'none' && (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden focusable="false">
          <defs>
            <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--silver-hi)" />
              <stop offset="0.5" stopColor="var(--silver-edge)" />
              <stop offset="1" stopColor="var(--silver-lo)" />
            </linearGradient>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--raised)" />
              <stop offset="1" stopColor="var(--bg)" />
            </linearGradient>
          </defs>
          <path d={FRAME_PATHS[frame].outer} fill={`url(#${id}-fill)`} stroke={`url(#${id}-silver)`} strokeWidth="3.5" strokeLinejoin="round" />
          <path d={FRAME_PATHS[frame].inner} fill="none" stroke="var(--silver-edge)" strokeWidth="1" opacity="0.45" strokeLinejoin="round" />
        </svg>
      )}
      <span className="lab-crest__emblem" style={frame === 'shield' ? { marginTop: -size * 0.06 } : undefined}>
        <GameEmblem game={game} size={emblem} />
      </span>
    </span>
  )
}

/* ---------- backdrop and hero ---------- */

/** Static, abstract crystal facets behind the glass pages. No light streaks and no motion. */
export function FacetBackdrop() {
  const facets = [
    'M0 0 L380 0 L180 260 Z',
    'M180 260 L380 0 L520 210 Z',
    'M1440 0 L1100 0 L1290 330 Z',
    'M1290 330 L1100 0 L980 240 Z',
    'M0 900 L0 560 L260 900 Z',
    'M1440 900 L1440 520 L1180 900 Z',
    'M1180 900 L1440 520 L1060 690 Z',
    'M260 900 L0 560 L340 650 Z',
  ]
  return (
    <svg className="lab-facets" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      {facets.map((d, i) => (
        <path key={d} d={d} fill="var(--crystal-wash)" opacity={0.035 + (i % 3) * 0.02} stroke="var(--silver-edge)" strokeOpacity="0.12" strokeWidth="1" />
      ))}
    </svg>
  )
}

/**
 * Home's hero slot: an abstract Cosmos and Chaos composition. A soft glow and crystal facets on the Cosmos
 * side, a cracked dark field on the Chaos side, the theme's faceted crystal on the seam. One shimmer crosses
 * the Cosmos side in one direction; it is the only ambient motion and stops under reduced motion. Swapping
 * commissioned art in replaces this one component.
 */
export function HeroComposition() {
  return (
    <svg className="lab-hero__art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id="lab-cosmos-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hero-cosmos-hi)" />
          <stop offset="1" stopColor="var(--hero-cosmos-lo)" />
        </linearGradient>
        <linearGradient id="lab-chaos-sky" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--hero-chaos-hi)" />
          <stop offset="1" stopColor="var(--hero-chaos-lo)" />
        </linearGradient>
        <radialGradient id="lab-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--hero-sun)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--hero-sun)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lab-shimmer" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--hero-sun)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--hero-sun)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--hero-sun)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lab-void" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--hero-void)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--hero-void)" stopOpacity="0" />
        </radialGradient>
        <clipPath id="lab-cosmos-half">
          <path d="M0 0 L690 0 L510 520 L0 520 Z" />
        </clipPath>
        <clipPath id="lab-chaos-half">
          <path d="M690 0 L1200 0 L1200 520 L510 520 Z" />
        </clipPath>
      </defs>

      <g clipPath="url(#lab-cosmos-half)">
        <rect width="1200" height="520" fill="url(#lab-cosmos-sky)" />
        <ellipse cx="300" cy="150" rx="360" ry="240" fill="url(#lab-glow)" />
        <g fill="var(--crystal-wash)" stroke="var(--hero-seam)" strokeOpacity="0.25" strokeWidth="1">
          <path d="M0 0 L260 0 L120 190 Z" opacity="0.08" />
          <path d="M120 190 L260 0 L380 150 Z" opacity="0.05" />
          <path d="M0 520 L0 300 L210 520 Z" opacity="0.07" />
          <path d="M420 0 L620 0 L540 120 Z" opacity="0.05" />
        </g>
        <rect className="lab-hero__shimmer" x="-260" y="-100" width="260" height="720" fill="url(#lab-shimmer)" transform="skewX(-18)" />
      </g>

      <g clipPath="url(#lab-chaos-half)">
        <rect width="1200" height="520" fill="url(#lab-chaos-sky)" />
        <circle cx="980" cy="380" r="240" fill="url(#lab-void)" />
        <g stroke="var(--hero-crack)" strokeWidth="1.5" fill="none" opacity="0.7">
          <path d="M980 380 L1080 300 L1130 320 L1200 250" />
          <path d="M980 380 L930 270 L960 200 L920 90" />
          <path d="M980 380 L1100 440 L1200 430" />
          <path d="M980 380 L860 440 L820 520" />
        </g>
        <path d="M980 330 L1010 380 L980 430 L950 380 Z" fill="none" stroke="var(--hero-crack)" strokeWidth="1.6" />
      </g>

      <path d="M690 0 L510 520" stroke="var(--hero-seam)" strokeWidth="2" />
      <g transform="translate(600 260)">
        <path d="M0 -92 L44 -34 L44 34 L0 92 L-44 34 L-44 -34 Z" fill="var(--hero-crystal-fill)" stroke="var(--hero-seam)" strokeWidth="1.6" />
        <path d="M0 -92 L0 92 M-44 -34 L0 -10 L44 -34 M-44 34 L0 10 L44 34" stroke="var(--hero-seam)" strokeWidth="1" opacity="0.7" />
      </g>
    </svg>
  )
}
