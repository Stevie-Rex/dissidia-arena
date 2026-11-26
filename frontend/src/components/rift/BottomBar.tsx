/*
 * Rift's phone navigation (#45), ported from lab round 1: five equal emblem tiles. Its height is the
 * --rift-phone-bar variable (index.css), so anything floating at the bottom of a phone can sit above it.
 */
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useApp } from '../../state/AppState'
import { FramedIcon } from './crests'
import { GiCrossedSwords, GiHamburgerMenu, GiLaurels, GiStoneTower, GiVisoredHelm } from './icons'
import { currentTileKey } from './nav'

type Tile = { key: string; label: string; to: string; glyph: (size: number) => ReactNode }

export default function BottomBar() {
  const { game } = useApp()
  const current = currentTileKey(useLocation().pathname)
  const tiles: Tile[] = [
    { key: 'hub', label: 'Hub', to: `/${game}`, glyph: (s) => <GiStoneTower size={s} /> },
    { key: 'ladder', label: 'Ladder', to: `/${game}/ladder`, glyph: (s) => <GiLaurels size={s} /> },
    { key: 'queue', label: 'Queue', to: '/queue', glyph: (s) => <GiCrossedSwords size={s} /> },
    { key: 'profile', label: 'Profile', to: '/players/me', glyph: (s) => <GiVisoredHelm size={s} /> },
    { key: 'more', label: 'More', to: '/more', glyph: (s) => <GiHamburgerMenu size={s} /> },
  ]
  return (
    <nav aria-label="Phone navigation" className="rift-bottombar">
      {tiles.map((t) => (
        <Link key={t.key} to={t.to} className="rift-tile" aria-current={current === t.key ? 'page' : undefined}>
          <FramedIcon size={36} icon={t.glyph} />
          <span className="rift-tile__label">{t.label}</span>
        </Link>
      ))}
    </nav>
  )
}
