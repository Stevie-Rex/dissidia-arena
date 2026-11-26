import { useAppearance } from '../../state/Appearance'

const CRYSTAL = 'M0 -92 L44 -34 L44 34 L0 92 L-44 34 L-44 -34 Z'
const CRYSTAL_FACETS = 'M0 -92 L0 92 M-44 -34 L0 -10 L44 -34 M-44 34 L0 10 L44 34'

function ChaosHero() {
  return (
    <svg className="rift-hero__art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id="rift-hero-cosmos-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--rift-art-cosmos-hi)" />
          <stop offset="1" stopColor="var(--rift-art-cosmos-lo)" />
        </linearGradient>
        <linearGradient id="rift-hero-chaos-sky" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--rift-art-chaos-hi)" />
          <stop offset="1" stopColor="var(--rift-art-chaos-lo)" />
        </linearGradient>
        <radialGradient id="rift-hero-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--rift-art-sun)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--rift-art-sun)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rift-hero-shimmer" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--rift-art-sun)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--rift-art-sun)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--rift-art-sun)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="rift-hero-void" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--rift-art-void)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--rift-art-void)" stopOpacity="0" />
        </radialGradient>
        <clipPath id="rift-hero-cosmos-half">
          <path d="M0 0 L690 0 L510 520 L0 520 Z" />
        </clipPath>
        <clipPath id="rift-hero-chaos-half">
          <path d="M690 0 L1200 0 L1200 520 L510 520 Z" />
        </clipPath>
      </defs>

      <g clipPath="url(#rift-hero-cosmos-half)">
        <rect width="1200" height="520" fill="url(#rift-hero-cosmos-sky)" />
        <ellipse cx="300" cy="150" rx="360" ry="240" fill="url(#rift-hero-glow)" />
        <g fill="var(--rift-crystal-wash)" stroke="var(--rift-art-seam)" strokeOpacity="0.25" strokeWidth="1">
          <path d="M0 0 L260 0 L120 190 Z" opacity="0.08" />
          <path d="M120 190 L260 0 L380 150 Z" opacity="0.05" />
          <path d="M0 520 L0 300 L210 520 Z" opacity="0.07" />
          <path d="M420 0 L620 0 L540 120 Z" opacity="0.05" />
        </g>
        <rect className="rift-hero__shimmer" x="-260" y="-100" width="260" height="720" fill="url(#rift-hero-shimmer)" />
      </g>

      <g clipPath="url(#rift-hero-chaos-half)">
        <rect width="1200" height="520" fill="url(#rift-hero-chaos-sky)" />
        <circle cx="980" cy="380" r="240" fill="url(#rift-hero-void)" />
        <g stroke="var(--rift-art-crack)" strokeWidth="1.5" fill="none" opacity="0.7">
          <path d="M980 380 L1080 300 L1130 320 L1200 250" />
          <path d="M980 380 L930 270 L960 200 L920 90" />
          <path d="M980 380 L1100 440 L1200 430" />
          <path d="M980 380 L860 440 L820 520" />
        </g>
        <path d="M980 330 L1010 380 L980 430 L950 380 Z" fill="none" stroke="var(--rift-art-crack)" strokeWidth="1.6" />
      </g>

      <path d="M690 0 L510 520" stroke="var(--rift-art-seam)" strokeWidth="2" />
      <g transform="translate(600 260)">
        <path d="M0 -92 L44 -34 L44 34 L0 92 L-44 34 L-44 -34 Z" fill="var(--rift-art-crystal-fill)" stroke="var(--rift-art-seam)" strokeWidth="1.6" />
        <path d="M0 -92 L0 92 M-44 -34 L0 -10 L44 -34 M-44 34 L0 10 L44 34" stroke="var(--rift-art-seam)" strokeWidth="1" opacity="0.7" />
      </g>
    </svg>
  )
}

function SteelHero() {
  const scale = 0.8
  // At full size the seam runs from 860,0 to 660,520 and the medallion sits on it at 760,260, 440 from the edge.
  const cx = +(1200 - 440 * scale).toFixed(1)
  const top = cx + 100
  const bottom = cx - 100
  // Eight small cut stones set into the rim, at the compass points and between them.
  const studs = Array.from({ length: 8 }, (_, i) => {
    const a = ((i * 45 - 90) * Math.PI) / 180
    return { x: +(Math.cos(a) * 224).toFixed(1), y: +(Math.sin(a) * 224).toFixed(1), big: i % 2 === 0 }
  })
  // Anchored right: when a narrow band crops the art, the plain steel on the left goes, not the medallion and slab.
  return (
    <svg className="rift-hero__art" viewBox="0 0 1200 520" preserveAspectRatio="xMaxYMid slice" aria-hidden focusable="false">
      <defs>
        <pattern id="rift-steel-brush" width="7" height="3" patternUnits="userSpaceOnUse">
          <rect width="7" height="1" fill="var(--rift-steel-hi)" opacity="0.35" />
        </pattern>
        <linearGradient id="rift-steel-plate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--rift-art-cosmos-hi)" />
          <stop offset="1" stopColor="var(--rift-art-cosmos-lo)" />
        </linearGradient>
        <linearGradient id="rift-steel-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--rift-art-chaos-hi)" />
          <stop offset="1" stopColor="var(--rift-art-chaos-lo)" />
        </linearGradient>
        <linearGradient id="rift-steel-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--rift-steel-hi)" />
          <stop offset="0.5" stopColor="var(--rift-silver-edge)" />
          <stop offset="1" stopColor="var(--rift-steel-lo)" />
        </linearGradient>
        <linearGradient id="rift-steel-gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--rift-art-gem-hi)" />
          <stop offset="1" stopColor="var(--rift-art-gem-lo)" />
        </linearGradient>
        <linearGradient id="rift-steel-spec" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--rift-art-sun)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--rift-art-sun)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--rift-art-sun)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="rift-steel-chaos">
          <path d={`M${top} 0 L1200 0 L1200 520 L${bottom} 520 Z`} />
        </clipPath>
        <clipPath id="rift-steel-cosmos">
          <path d={`M0 0 L${top} 0 L${bottom} 520 L0 520 Z`} />
        </clipPath>
      </defs>

      <rect width="1200" height="520" fill="url(#rift-steel-plate)" />
      <rect width="1200" height="520" fill="url(#rift-steel-brush)" />
      <g clipPath="url(#rift-steel-cosmos)">
        <rect className="rift-hero__shimmer" x="-260" y="-100" width="200" height="720" fill="url(#rift-steel-spec)" />
      </g>
      <g clipPath="url(#rift-steel-chaos)">
        <rect width="1200" height="520" fill="url(#rift-steel-dark)" />
        <rect width="1200" height="520" fill="url(#rift-steel-brush)" opacity="0.25" />
        <g stroke="var(--rift-art-crack)" strokeWidth="1.4" fill="none" opacity="0.8">
          <path d="M1080 120 L1130 170 L1120 230 L1200 290" />
          <path d="M1080 120 L1040 40 L1060 0" />
          <path d="M1130 420 L1060 470 L1040 520" />
        </g>
      </g>

      <g transform={`translate(${cx} 260) scale(${scale})`}>
        <circle r="236" fill="none" stroke="var(--rift-steel-lo)" strokeWidth="2" opacity="0.6" />
        <circle r="224" fill="none" stroke="url(#rift-steel-rim)" strokeWidth="16" />
        <circle r="200" fill="none" stroke="var(--rift-steel-lo)" strokeWidth="1" opacity="0.7" />
        <circle r="196" fill="none" stroke="var(--rift-steel-hi)" strokeWidth="1" opacity="0.6" />
        <circle r="160" fill="none" stroke="var(--rift-steel-lo)" strokeWidth="1" opacity="0.45" />
        {studs.map(({ x, y, big }) => (
          <path
            key={`${x}-${y}`}
            d={CRYSTAL}
            transform={`translate(${x} ${y}) scale(${big ? 0.16 : 0.1})`}
            fill="url(#rift-steel-gem)"
            stroke="var(--rift-steel-hi)"
            strokeWidth={big ? 10 : 14}
          />
        ))}
        <circle r="120" fill="none" stroke="url(#rift-steel-rim)" strokeWidth="8" />
        <path d={CRYSTAL} transform="scale(1.15)" fill="url(#rift-steel-gem)" stroke="var(--rift-steel-hi)" strokeWidth="2" />
        <path d={CRYSTAL_FACETS} transform="scale(1.15)" stroke="var(--rift-steel-hi)" strokeWidth="1" opacity="0.75" fill="none" />
      </g>
    </svg>
  )
}

// Replace this slot when commissioned artwork is ready.
export default function HomeHeroArt() {
  const { prefs } = useAppearance()
  return prefs.rift_mode === 'cosmos' ? <SteelHero /> : <ChaosHero />
}
