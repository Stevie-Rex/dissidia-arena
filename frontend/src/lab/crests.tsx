/* Original SVG crests for the lab. Every colour is currentColor or a CSS variable, never a hex value. */
import type { ReactNode } from 'react'

function Crest({ children, size = 28 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** Shield outline shared by the tiles. */
const SHIELD = 'M16 2 L28 7 L28 16 Q28 25 16 30 Q4 25 4 16 L4 7 Z'

export function HubCrest({ size }: { size?: number }) {
  return (
    <Crest size={size}>
      <path d={SHIELD} />
      <path d="M10 22 L10 14 L16 10 L22 14 L22 22" />
      <path d="M14 22 L14 17 L18 17 L18 22" />
    </Crest>
  )
}

export function LadderCrest({ size }: { size?: number }) {
  return (
    <Crest size={size}>
      <path d={SHIELD} />
      <path d="M10 13 L16 9 L22 13" />
      <path d="M10 18 L16 14 L22 18" />
      <path d="M10 23 L16 19 L22 23" />
    </Crest>
  )
}

export function QueueCrest({ size }: { size?: number }) {
  return (
    <Crest size={size}>
      <path d="M16 1.5 L26 9 L26 23 L16 30.5 L6 23 L6 9 Z" />
      <path d="M11 21 L21 9 M21 21 L11 9" />
      <path d="M9.5 19.5 L12.5 22.5 M22.5 19.5 L19.5 22.5" />
      <circle cx="16" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </Crest>
  )
}

export function ProfileCrest({ size }: { size?: number }) {
  return (
    <Crest size={size}>
      <path d={SHIELD} />
      <path d="M11 20 Q11 11 16 10 Q21 11 21 20 L18.5 22 L13.5 22 Z" />
      <path d="M12 16 L20 16 M16 16 L16 21" />
    </Crest>
  )
}

export function MoreCrest({ size }: { size?: number }) {
  return (
    <Crest size={size}>
      <path d={SHIELD} />
      <path d="M10 16 L11.5 14.5 L13 16 L11.5 17.5 Z M14.5 16 L16 14.5 L17.5 16 L16 17.5 Z M19 16 L20.5 14.5 L22 16 L20.5 17.5 Z" />
    </Crest>
  )
}

export function AdminCrest({ size = 18 }: { size?: number }) {
  return (
    <Crest size={size}>
      <path d={SHIELD} />
      <path d="M16 9 L16 23 M11 13 L21 13" />
    </Crest>
  )
}

export function SettingsCrest({ size = 18 }: { size?: number }) {
  return (
    <Crest size={size}>
      <circle cx="16" cy="16" r="4" />
      <path d="M16 3 L16 8 M16 24 L16 29 M3 16 L8 16 M24 16 L29 16 M6.8 6.8 L10.3 10.3 M21.7 21.7 L25.2 25.2 M6.8 25.2 L10.3 21.7 M21.7 10.3 L25.2 6.8" />
    </Crest>
  )
}

export function SunGlyph({ size = 18 }: { size?: number }) {
  return (
    <Crest size={size}>
      <circle cx="16" cy="16" r="5" />
      <path d="M16 3 L16 7 M16 25 L16 29 M3 16 L7 16 M25 16 L29 16" />
    </Crest>
  )
}

export function MoonGlyph({ size = 18 }: { size?: number }) {
  return (
    <Crest size={size}>
      <path d="M21 5 Q12 7 12 16 Q12 25 21 27 Q9 29 6 18 Q4 7 21 5 Z" />
    </Crest>
  )
}

export function FeedbackCrest({ size = 18 }: { size?: number }) {
  return (
    <Crest size={size}>
      <path d="M5 7 L27 7 L27 21 L14 21 L8 26 L8 21 L5 21 Z" />
      <path d="M10 12 L22 12 M10 16 L18 16" />
    </Crest>
  )
}

/** The emblem for each game in the switcher: 012 a twelve-pointed star, NT a split crystal. */
export function GameEmblem({ game, size = 26 }: { game: '012' | 'NT'; size?: number }) {
  if (game === '012')
    return (
      <Crest size={size}>
        <path d="M16 3 L18 12 L27 9 L20 16 L27 23 L18 20 L16 29 L14 20 L5 23 L12 16 L5 9 L14 12 Z" />
        <circle cx="16" cy="16" r="2.2" />
      </Crest>
    )
  return (
    <Crest size={size}>
      <path d="M16 2 L25 12 L16 30 L7 12 Z" />
      <path d="M16 2 L16 30 M7 12 L25 12" />
    </Crest>
  )
}

/**
 * Home's hero slot: an abstract Cosmos and Chaos composition. Light rays and a warm sun on the Cosmos side,
 * a cracked dark field on the Chaos side, a crystal on the seam. The motifs are the theme's own SVGs
 * (theme/assets/cosmos.svg sun, chaos.svg cracked diamond, crystal.svg faceted hexagon), drawn inline so they
 * take the palette's colours. Swapping commissioned art in replaces this one component.
 */
export function HeroComposition() {
  const rays = Array.from({ length: 14 }, (_, i) => -64 + i * 9)
  return (
    <svg className="lab-hero__art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="lab-cosmos-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hero-cosmos-hi)" />
          <stop offset="1" stopColor="var(--hero-cosmos-lo)" />
        </linearGradient>
        <linearGradient id="lab-chaos-sky" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--hero-chaos-hi)" />
          <stop offset="1" stopColor="var(--hero-chaos-lo)" />
        </linearGradient>
        <radialGradient id="lab-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--hero-sun)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--hero-sun)" stopOpacity="0" />
        </radialGradient>
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
        <g className="lab-hero__rays" style={{ transformOrigin: '230px 150px' }}>
          {rays.map((a) => (
            <path
              key={a}
              d="M230 150 L1300 132 L1300 168 Z"
              transform={`rotate(${a} 230 150)`}
              fill="var(--hero-sun)"
              opacity="0.08"
            />
          ))}
        </g>
        <circle cx="230" cy="150" r="190" fill="url(#lab-sun)" />
        <g stroke="var(--hero-sun)" strokeWidth="1.4" fill="none" opacity="0.7">
          <circle cx="230" cy="150" r="46" />
          <path d="M230 70 L230 96 M230 204 L230 230 M150 150 L176 150 M284 150 L310 150" />
        </g>
      </g>

      <g clipPath="url(#lab-chaos-half)">
        <rect width="1200" height="520" fill="url(#lab-chaos-sky)" />
        <circle cx="980" cy="380" r="240" fill="url(#lab-void)" />
        <g stroke="var(--hero-crack)" strokeWidth="1.5" fill="none" opacity="0.75">
          <path d="M980 380 L1080 300 L1130 320 L1200 250" />
          <path d="M980 380 L930 270 L960 200 L920 90" />
          <path d="M980 380 L1100 440 L1200 430" />
          <path d="M980 380 L860 440 L820 520" />
          <path d="M930 270 L860 250" />
        </g>
        <path d="M980 330 L1010 380 L980 430 L950 380 Z" fill="none" stroke="var(--hero-crack)" strokeWidth="1.6" />
      </g>

      <path d="M690 0 L510 520" stroke="var(--hero-seam)" strokeWidth="2" />
      <g className="lab-hero__crystal" transform="translate(600 260)">
        <path d="M0 -92 L44 -34 L44 34 L0 92 L-44 34 L-44 -34 Z" fill="var(--hero-crystal-fill)" stroke="var(--hero-seam)" strokeWidth="1.6" />
        <path d="M0 -92 L0 92 M-44 -34 L0 -10 L44 -34 M-44 34 L0 10 L44 34" stroke="var(--hero-seam)" strokeWidth="1" opacity="0.7" />
      </g>
    </svg>
  )
}
