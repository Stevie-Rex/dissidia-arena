import '../../theme/css/rift-facets.css'

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
    <svg className="rift-facets" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      {facets.map((d, i) => (
        <path key={d} d={d} fill="var(--rift-crystal-wash)" opacity={0.035 + (i % 3) * 0.02} stroke="var(--rift-silver-edge)" strokeOpacity="0.12" strokeWidth="1" />
      ))}
    </svg>
  )
}
