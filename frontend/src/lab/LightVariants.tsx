/*
 * PROTOTYPE (#55): three light-mode directions for the Rift, side by side in the lab. Throwaway; this branch
 * never merges. Each direction restyles the whole lab in light mode through lab-light.css, and swaps in its own
 * hero and backdrop from here. Pick one with ?light=a|b|c or the floating switcher (← and → keys work too).
 *
 *   A · Pearl Rift      cool pearl ground, the menus become dark sapphire bars floating on it (inverted panels)
 *   B · Vellum Codex    warm vellum and ink, double-ruled plates, ledger rows, watercolour hero, no slants
 *   C · Burnished Steel mid-tone brushed metal, bevelled plates, recessed wells, pressable keys, enamel selection
 *
 * Every colour here is a CSS variable (CI rejects hex colours in .tsx); the values live in lab-light.css.
 */
import { useEffect } from 'react'

import { FacetBackdrop, HeroComposition } from './crests'

export type LightVariant = 'a' | 'b' | 'c' | 'p5'

export const LIGHT_VARIANTS: { key: LightVariant; name: string; idea: string }[] = [
  { key: 'a', name: 'Pearl Rift', idea: 'Pearl ground, dark sapphire menus floating on it' },
  { key: 'b', name: 'Vellum Codex', idea: 'Vellum and ink, ruled plates, watercolour hero' },
  { key: 'c', name: 'Burnished Steel', idea: 'Brushed metal plates, wells and pressable keys' },
  { key: 'p5', name: 'Pass 5 (current)', idea: 'The light mode as it stood on #55, for comparison' },
]

export function readLightVariant(): LightVariant | null {
  const v = new URLSearchParams(window.location.search).get('light')
  return LIGHT_VARIANTS.some((x) => x.key === v) ? (v as LightVariant) : null
}

function writeLightVariant(v: LightVariant) {
  const url = new URL(window.location.href)
  url.searchParams.set('light', v)
  window.history.replaceState(null, '', url)
}

/* ---------- the floating switcher (not part of any design) ---------- */

export function LightSwitcher({ value, onChange }: { value: LightVariant; onChange: (v: LightVariant) => void }) {
  const i = LIGHT_VARIANTS.findIndex((x) => x.key === value)
  const step = (d: number) => {
    const next = LIGHT_VARIANTS[(i + d + LIGHT_VARIANTS.length) % LIGHT_VARIANTS.length].key
    writeLightVariant(next)
    onChange(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.matches('input, textarea, select, [contenteditable], [role="spinbutton"]') || el.isContentEditable)) return
      e.preventDefault()
      step(e.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!import.meta.env.DEV) return null
  const cur = LIGHT_VARIANTS[i]
  return (
    <div className="lab-lv-switch" role="group" aria-label="Light mode variant">
      <button type="button" aria-label="Previous variant" onClick={() => step(-1)}>
        ◀
      </button>
      <span className="lab-lv-switch__label" aria-live="polite">
        <b>{cur.key === 'p5' ? '0' : cur.key.toUpperCase()}</b>
        {cur.name}
        <small>{cur.idea}</small>
      </span>
      <button type="button" aria-label="Next variant" onClick={() => step(1)}>
        ▶
      </button>
    </div>
  )
}

/* ---------- backdrops ---------- */

/** A: a fine crystal lattice and a few motes of light over the pearl ground. B and C draw theirs in CSS. */
function PearlBackdrop() {
  const lines = [
    'M-100 900 L700 -100', 'M200 1000 L1100 -100', 'M700 1000 L1540 0', 'M1100 1000 L1540 400',
    'M-100 200 L700 1000', 'M300 -100 L1300 1000', 'M800 -100 L1540 700',
  ]
  const motes = [
    [180, 140, 5], [260, 420, 3], [520, 90, 4], [930, 180, 3], [1220, 120, 5], [1330, 610, 4],
    [1080, 760, 3], [640, 820, 4], [90, 700, 3], [420, 600, 2.5], [1160, 420, 2.5], [760, 360, 2],
  ]
  return (
    <svg className="lab-facets" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      {lines.map((d) => (
        <path key={d} d={d} stroke="var(--lv-lattice)" strokeWidth="1" fill="none" />
      ))}
      {motes.map(([x, y, r]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - r * 2} L${x + r} ${y} L${x} ${y + r * 2} L${x - r} ${y} Z`} fill="var(--lv-mote)" />
      ))}
    </svg>
  )
}

/** C with glass plates, on the Hub only: the facet backdrop in dimmed steel, so the frosted plates have something to sit on. */
export function SteelFacets() {
  return (
    <div className="lab-facets-steel" aria-hidden>
      <FacetBackdrop />
    </div>
  )
}

export function LightBackdrop({ variant }: { variant: LightVariant }) {
  if (variant === 'a') return <PearlBackdrop />
  if (variant === 'p5') return <FacetBackdrop />
  return null
}

/* ---------- heroes ---------- */

/** The 012 crystal shape, centred on 0,0, at scale 1 about 88 wide and 184 tall. */
const CRYSTAL = 'M0 -92 L44 -34 L44 34 L0 92 L-44 34 L-44 -34 Z'
const CRYSTAL_FACETS = 'M0 -92 L0 92 M-44 -34 L0 -10 L44 -34 M-44 34 L0 10 L44 34'

/**
 * A · Pearl Rift. A bright pearl field for Cosmos with a lattice of light, a dusk-violet wedge for Chaos, and a
 * cut crystal on the seam inside three faint halos. One shimmer crosses the Cosmos side.
 */
function PearlHero() {
  const lattice = ['M-40 470 L440 -40', 'M120 560 L640 -40', 'M-40 160 L420 560', 'M200 -40 L760 560', 'M420 -40 L800 360']
  const motes = [[110, 120, 4], [300, 210, 3], [470, 80, 5], [220, 380, 3], [540, 300, 2.5], [380, 450, 3.5], [640, 120, 3]]
  return (
    <svg className="lab-hero__art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <radialGradient id="lv-a-sky" cx="0.3" cy="0.35" r="0.85">
          <stop offset="0" stopColor="var(--hero-cosmos-hi)" />
          <stop offset="1" stopColor="var(--hero-cosmos-lo)" />
        </radialGradient>
        <linearGradient id="lv-a-dusk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hero-chaos-hi)" />
          <stop offset="1" stopColor="var(--hero-chaos-lo)" />
        </linearGradient>
        <linearGradient id="lv-a-gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--silver-hi)" />
          <stop offset="0.5" stopColor="var(--crystal-wash)" />
          <stop offset="1" stopColor="var(--cosmos-deep)" />
        </linearGradient>
        <linearGradient id="lv-a-shimmer" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--hero-sun)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--hero-sun)" stopOpacity="0.7" />
          <stop offset="1" stopColor="var(--hero-sun)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="lv-a-cosmos">
          <path d="M0 0 L800 0 L620 520 L0 520 Z" />
        </clipPath>
        <clipPath id="lv-a-chaos">
          <path d="M800 0 L1200 0 L1200 520 L620 520 Z" />
        </clipPath>
      </defs>

      <rect width="1200" height="520" fill="url(#lv-a-sky)" />
      <g clipPath="url(#lv-a-cosmos)">
        {lattice.map((d) => (
          <path key={d} d={d} stroke="var(--lv-lattice)" strokeWidth="1.2" fill="none" />
        ))}
        {motes.map(([x, y, r]) => (
          <path key={`${x}-${y}`} d={`M${x} ${y - r * 2} L${x + r} ${y} L${x} ${y + r * 2} L${x - r} ${y} Z`} fill="var(--lv-mote)" />
        ))}
        <rect className="lab-hero__shimmer" x="-260" y="-100" width="220" height="720" fill="url(#lv-a-shimmer)" transform="skewX(-18)" />
      </g>
      <g clipPath="url(#lv-a-chaos)">
        <rect width="1200" height="520" fill="url(#lv-a-dusk)" />
        <g stroke="var(--hero-crack)" strokeWidth="1.3" fill="none" opacity="0.65">
          <path d="M1010 330 L1090 270 L1140 290 L1200 220" />
          <path d="M1010 330 L970 230 L1000 160 L960 40" />
          <path d="M1010 330 L1120 400 L1200 390" />
          <path d="M1010 330 L900 410 L860 520" />
        </g>
      </g>

      <path d="M800 0 L620 520" stroke="var(--silver-hi)" strokeWidth="4" />
      <path d="M800 0 L620 520" stroke="var(--hero-seam)" strokeWidth="1" />
      <g transform="translate(710 260)">
        {[2.6, 1.9, 1.4].map((s, i) => (
          <path key={s} d={CRYSTAL} transform={`scale(${s})`} fill="none" stroke="var(--hero-seam)" strokeWidth={1.2 / s} opacity={0.25 + i * 0.18} />
        ))}
        <path d={CRYSTAL} fill="url(#lv-a-gem)" stroke="var(--silver-hi)" strokeWidth="2" />
        <path d={CRYSTAL_FACETS} stroke="var(--silver-hi)" strokeWidth="1" opacity="0.8" fill="none" />
      </g>
    </svg>
  )
}

/**
 * B · Vellum Codex. Lapis and oxblood washes bleed into the vellum, an ink-drawn crystal sits over them with
 * hatching on its Chaos face, and a gilt double rule marks the seam. The left stays bare paper for the copy.
 */
function CodexHero() {
  const hatch = Array.from({ length: 22 }, (_, i) => `M${-60 + i * 8} -100 L${-10 + i * 8} 100`)
  return (
    <svg className="lab-hero__art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        {/* Watercolour: a ragged edge, pigment pooled darker at the rim, and granulation in the body. */}
        <filter id="lv-b-wash" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="4" seed="7" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="55" xChannelSelector="R" yChannelSelector="G" result="shape" />
          <feGaussianBlur in="shape" stdDeviation="1.2" result="soft" />
          <feMorphology in="soft" operator="erode" radius="5" result="inner" />
          <feComposite in="soft" in2="inner" operator="out" result="rim" />
          <feGaussianBlur in="rim" stdDeviation="1.5" result="rimSoft" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="2" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.25" result="grainMask" />
          <feComposite in="soft" in2="grainMask" operator="in" result="body" />
          <feMerge>
            <feMergeNode in="body" />
            <feMergeNode in="rimSoft" />
            <feMergeNode in="rimSoft" />
          </feMerge>
        </filter>
        <filter id="lv-b-ink">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
        </filter>
        <linearGradient id="lv-b-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--hero-sun)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--hero-sun)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--hero-sun)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="lv-b-crystal">
          <path d={CRYSTAL} transform="scale(1.5)" />
        </clipPath>
      </defs>

      <rect width="1200" height="520" fill="var(--hero-paper)" />
      {/* Each wash is its own layer, so where two overlap the colour deepens, as glazes do. */}
      <g opacity="0.3" filter="url(#lv-b-wash)">
        <path d="M560 120 Q660 40 790 90 Q870 130 850 230 Q830 330 720 380 Q600 420 545 330 Q500 220 560 120 Z" fill="var(--hero-lapis)" />
      </g>
      <g opacity="0.26" filter="url(#lv-b-wash)">
        <path d="M600 260 Q680 210 770 250 Q820 300 780 380 Q700 450 620 410 Q570 340 600 260 Z" fill="var(--hero-lapis)" />
      </g>
      <g opacity="0.28" filter="url(#lv-b-wash)">
        <path d="M930 110 Q1040 60 1150 120 Q1230 200 1190 330 Q1140 450 1010 440 Q900 420 890 300 Q880 180 930 110 Z" fill="var(--hero-ox)" />
      </g>
      <g opacity="0.24" filter="url(#lv-b-wash)">
        <path d="M1010 240 Q1080 200 1140 260 Q1170 340 1100 380 Q1020 400 990 330 Q980 270 1010 240 Z" fill="var(--hero-ox)" />
      </g>
      <g opacity="0.5" filter="url(#lv-b-wash)">
        <path d="M830 190 Q880 170 910 210 Q930 270 890 310 Q840 330 815 280 Q800 220 830 190 Z" fill="var(--hero-sun)" />
      </g>
      <rect className="lab-hero__shimmer" x="-260" y="-100" width="220" height="720" fill="url(#lv-b-sheen)" transform="skewX(-18)" />

      <path d="M920 0 L820 520" stroke="var(--hero-seam)" strokeWidth="1.4" />
      <path d="M928 0 L828 520" stroke="var(--hero-seam)" strokeWidth="0.7" />

      <g transform="translate(872 262)" filter="url(#lv-b-ink)">
        <g clipPath="url(#lv-b-crystal)">
          <g transform="translate(0 0)" stroke="var(--hero-ink)" strokeWidth="0.8" opacity="0.55">
            {hatch.map((d) => (
              <path key={d} d={d} transform="translate(66 0)" />
            ))}
          </g>
        </g>
        <path d={CRYSTAL} transform="scale(1.5)" fill="var(--hero-crystal-fill)" fillOpacity="0.35" stroke="var(--hero-ink)" strokeWidth="1.3" />
        <path d={CRYSTAL_FACETS} transform="scale(1.5)" stroke="var(--hero-ink)" strokeWidth="0.8" fill="none" />
      </g>
    </svg>
  )
}

/**
 * C · Burnished Steel. Brushed steel for Cosmos, blackened steel for Chaos, and a machined medallion across the
 * seam with a cut gem set in it. One specular sweep crosses the polished side.
 *
 * `scale` (pass 6, #58) shrinks the medallion and the Chaos slab together: the slab keeps its seam angle and is
 * `scale` times as wide, and the medallion stays centred on the seam at `scale` times its size.
 */
function SteelHero({ scale = 1 }: { scale?: number }) {
  // At full size the seam runs from 860,0 to 660,520 and the medallion sits on it at 760,260, 440 from the edge.
  const cx = +(1200 - 440 * scale).toFixed(1)
  const top = cx + 100
  const bottom = cx - 100
  // Eight small cut stones set into the rim, at the compass points and between them.
  const studs = Array.from({ length: 8 }, (_, i) => {
    const a = ((i * 45 - 90) * Math.PI) / 180
    return { x: +(Math.cos(a) * 224).toFixed(1), y: +(Math.sin(a) * 224).toFixed(1), big: i % 2 === 0 }
  })
  return (
    <svg className="lab-hero__art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <pattern id="lv-c-brush" width="7" height="3" patternUnits="userSpaceOnUse">
          <rect width="7" height="1" fill="var(--steel-hi)" opacity="0.35" />
        </pattern>
        <linearGradient id="lv-c-plate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hero-cosmos-hi)" />
          <stop offset="1" stopColor="var(--hero-cosmos-lo)" />
        </linearGradient>
        <linearGradient id="lv-c-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hero-chaos-hi)" />
          <stop offset="1" stopColor="var(--hero-chaos-lo)" />
        </linearGradient>
        <linearGradient id="lv-c-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--steel-hi)" />
          <stop offset="0.5" stopColor="var(--silver-edge)" />
          <stop offset="1" stopColor="var(--steel-lo)" />
        </linearGradient>
        <linearGradient id="lv-c-gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hero-gem-hi)" />
          <stop offset="1" stopColor="var(--hero-gem-lo)" />
        </linearGradient>
        <linearGradient id="lv-c-spec" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--hero-sun)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--hero-sun)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--hero-sun)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="lv-c-chaos">
          <path d={`M${top} 0 L1200 0 L1200 520 L${bottom} 520 Z`} />
        </clipPath>
        <clipPath id="lv-c-cosmos">
          <path d={`M0 0 L${top} 0 L${bottom} 520 L0 520 Z`} />
        </clipPath>
      </defs>

      <rect width="1200" height="520" fill="url(#lv-c-plate)" />
      <rect width="1200" height="520" fill="url(#lv-c-brush)" />
      <g clipPath="url(#lv-c-cosmos)">
        <rect className="lab-hero__shimmer" x="-260" y="-100" width="200" height="720" fill="url(#lv-c-spec)" transform="skewX(-18)" />
      </g>
      <g clipPath="url(#lv-c-chaos)">
        <rect width="1200" height="520" fill="url(#lv-c-dark)" />
        <rect width="1200" height="520" fill="url(#lv-c-brush)" opacity="0.25" />
        <g stroke="var(--hero-crack)" strokeWidth="1.4" fill="none" opacity="0.8">
          <path d="M1080 120 L1130 170 L1120 230 L1200 290" />
          <path d="M1080 120 L1040 40 L1060 0" />
          <path d="M1130 420 L1060 470 L1040 520" />
        </g>
      </g>

      <g transform={`translate(${cx} 260) scale(${scale})`}>
        <circle r="236" fill="none" stroke="var(--steel-lo)" strokeWidth="2" opacity="0.6" />
        <circle r="224" fill="none" stroke="url(#lv-c-rim)" strokeWidth="16" />
        <circle r="200" fill="none" stroke="var(--steel-lo)" strokeWidth="1" opacity="0.7" />
        <circle r="196" fill="none" stroke="var(--steel-hi)" strokeWidth="1" opacity="0.6" />
        <circle r="160" fill="none" stroke="var(--steel-lo)" strokeWidth="1" opacity="0.45" />
        {studs.map(({ x, y, big }) => (
          <path
            key={`${x}-${y}`}
            d={CRYSTAL}
            transform={`translate(${x} ${y}) scale(${big ? 0.16 : 0.1})`}
            fill="url(#lv-c-gem)"
            stroke="var(--steel-hi)"
            strokeWidth={big ? 10 : 14}
          />
        ))}
        <circle r="120" fill="none" stroke="url(#lv-c-rim)" strokeWidth="8" />
        <path d={CRYSTAL} transform="scale(1.15)" fill="url(#lv-c-gem)" stroke="var(--steel-hi)" strokeWidth="2" />
        <path d={CRYSTAL_FACETS} transform="scale(1.15)" stroke="var(--steel-hi)" strokeWidth="1" opacity="0.75" fill="none" />
      </g>
    </svg>
  )
}

export function LightHero({ variant, medallion = 1 }: { variant: LightVariant; medallion?: number }) {
  if (variant === 'a') return <PearlHero />
  if (variant === 'b') return <CodexHero />
  if (variant === 'c') return <SteelHero scale={medallion} />
  return <HeroComposition />
}
