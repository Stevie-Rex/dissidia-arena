/*
 * Rift's phone navigation (#45), ported from lab round 1: five equal emblem tiles. Hub, Ladder, Queue and Profile
 * are the sidebar's own items (navItems); More holds the rest. Its height is the --rift-phone-bar-h variable
 * (index.css), so anything floating at the bottom of a phone can sit above it.
 */
import { Link, useLocation } from 'react-router-dom'

import { useApp } from '../../state/AppState'
import { FramedIcon } from './crests'
import { GiHamburgerMenu } from './icons'
import { currentTileKey, TILE_KEYS } from './nav'
import { navItems, type NavItem } from './navItems'

const MORE: NavItem = { key: 'more', label: 'More', to: '/more', glyph: (s) => <GiHamburgerMenu size={s} />, hint: 'Rewards, Settings and the rest.' }

export default function BottomBar() {
  const { game } = useApp()
  const current = currentTileKey(useLocation().pathname)
  const items = [...navItems(game, undefined), MORE]
  const tiles = TILE_KEYS.map((key) => items.find((item) => item.key === key)!)
  return (
    <nav aria-label="Phone navigation" className="rift-bottombar">
      {tiles.map((t) => (
        <Link key={t.key} to={t.to} className="rift-tile" aria-current={current === t.key ? 'page' : undefined}>
          {t.glyph && <FramedIcon size={36} icon={t.glyph} />}
          <span className="rift-tile__label">{t.label}</span>
        </Link>
      ))}
    </nav>
  )
}
