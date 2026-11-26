/*
 * Rift's crest frames and plain UI glyphs. Original SVG; every colour is currentColor or a --rift-* variable.
 * Ported from the lab (#40): only the bevelled diamond frame was picked.
 */
import { useId, type ReactNode } from 'react'

import type { GameId } from '../../data/mock'
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

/** Each game's emblem: game-icons' floating crystal for 012, the winged sword for NT. */
export function GameEmblem({ game, size = 24 }: { game: GameId; size?: number }) {
  return game === '012' ? <GiFloatingCrystal size={size} /> : <GiWingedSword size={size} />
}

// A diamond with its four points cut off: the bevelled diamond.
const OUTER = 'M44 4 L56 4 L96 44 L96 56 L56 96 L44 96 L4 56 L4 44 Z'
const INNER = 'M45.5 10 L54.5 10 L90 45.5 L90 54.5 L54.5 90 L45.5 90 L10 54.5 L10 45.5 Z'
/** How big the icon sits inside the frame, as a share of the frame's size. */
const ICON_SCALE = 0.52

/**
 * An icon in a bevelled diamond with a silver edge. `icon` gets the inner size. The fill reads --rift-frame-top and
 * --rift-frame-bottom and the icon --rift-crest-ink, so a pressed or current control can re-tint them.
 * `data-crest` marks it for the icon-against-frame contrast check in e2e/appearance.spec.ts.
 */
export function FramedIcon({ size, icon }: { size: number; icon: (size: number) => ReactNode }) {
  const id = useId()
  return (
    <span className="da-crest" data-crest style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden focusable="false">
        <defs>
          <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--rift-frame-hi)" />
            <stop offset="0.5" stopColor="var(--rift-frame-mid)" />
            <stop offset="1" stopColor="var(--rift-frame-lo)" />
          </linearGradient>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop data-crest-fill offset="0" stopColor="var(--rift-frame-top)" />
            <stop data-crest-fill offset="1" stopColor="var(--rift-frame-bottom)" />
          </linearGradient>
        </defs>
        <path d={OUTER} fill={`url(#${id}-fill)`} stroke={`url(#${id}-silver)`} strokeWidth={size < 40 ? 5 : 3.5} strokeLinejoin="round" />
        {size >= 40 && <path d={INNER} fill="none" stroke="var(--rift-frame-mid)" strokeWidth="1" opacity="0.45" strokeLinejoin="round" />}
      </svg>
      <span className="da-crest__icon" data-crest-icon>
        {icon(Math.round(size * ICON_SCALE))}
      </span>
    </span>
  )
}

/** A game emblem in a diamond crest. */
export function GameCrest({ game, size }: { game: GameId; size: number }) {
  return <FramedIcon size={size} icon={(s) => <GameEmblem game={game} size={s} />} />
}

/** An original crystal-shard cursor, pointing right. It marks the selected menu row, like the 012 menu's glove. */
export function ShardCursor({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 40 24" aria-hidden focusable="false" className="rift-shard-cursor">
      <path d="M2 12 L14 3 L38 12 L14 21 Z" fill="var(--rift-crystal-wash)" stroke="var(--rift-silver-edge)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 3 L18 12 L14 21 M2 12 L38 12" stroke="var(--rift-silver-hi)" strokeWidth="1" fill="none" opacity="0.8" />
    </svg>
  )
}
