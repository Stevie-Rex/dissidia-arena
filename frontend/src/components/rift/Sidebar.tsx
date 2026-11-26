/*
 * Rift's desktop sidebar (#43), ported from lab round 1: the brand, the game switcher, the player card, the 012
 * menu bars and the foot. Phones use the compact header and bottom bar.
 */
import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { GAMES, type GameId } from '../../data/mock'
import { cx } from '../../lib/format'
import { useApp } from '../../state/AppState'
import { useAppearance } from '../../state/Appearance'
import { usePickGame } from '../../usePickGame'
import InterfaceSwitcher from '../appearance/InterfaceSwitcher'
import ModeToggle from '../appearance/ModeToggle'
import { Avatar, Btn } from '../ui'
import { FramedIcon, GameCrest, ShardCursor } from './crests'
import { hinted } from './hints'
import { currentNavKey } from './nav'
import { navItems, type NavItem } from './navItems'
import { GiGears } from './icons'

/**
 * The 012 menu bars as links. The selection (selection blue and the shard cursor) follows the pointer and keyboard
 * focus, and falls back to the current page when they leave. The current page also keeps its edge.
 */
export function MenuBars({ label, items, current }: { label: string; items: NavItem[]; current?: string }) {
  const [hover, setHover] = useState<string | null>(null)
  const sel = hover ?? current
  const bar = (item: NavItem, sub: boolean) => {
    const h = hinted(`${label}-${item.key}`, item.hint)
    const selected = sel === item.key
    const isCurrent = current === item.key
    return (
      <li key={item.key}>
        <Link
          to={item.to}
          className={cx('rift-bar', sub && 'rift-bar--sub', selected && 'is-selected', isCurrent && 'is-current')}
          aria-current={isCurrent ? 'page' : undefined}
          onMouseEnter={() => setHover(item.key)}
          onFocus={() => setHover(item.key)}
          {...h.props}
        >
          <span className="rift-bar__cursor">{selected && <ShardCursor size={18} />}</span>
          {item.glyph && <FramedIcon size={30} icon={item.glyph} />}
          <span className="rift-bar__label">{item.label}</span>
          {h.node}
        </Link>
        {item.children && <ul className="rift-bars rift-bars--sub">{item.children.map((c) => bar(c, true))}</ul>}
      </li>
    )
  }
  return (
    <nav aria-label={label} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)}>
      <ul className="rift-bars">{items.map((i) => bar(i, false))}</ul>
    </nav>
  )
}

/** Ranked wins and the next unlock. Progress counts from zero, as on the Rewards page (wins / goal). */
export function PlayerCard() {
  const { user, signIn } = useApp()
  const { appearance } = useAppearance()
  if (user === undefined) return <div className="rift-player" aria-hidden />
  if (user === null)
    return (
      <div className="rift-player">
        <p className="rift-player__name">Not signed in</p>
        <p className="rift-player__note">Sign in with Discord to queue and count your ranked wins.</p>
        <Btn className="mt-2.5 w-full" onClick={signIn}>
          Sign in
        </Btn>
      </div>
    )
  const wins = appearance.ranked_wins
  const next = appearance.next
  const pct = next ? next.percent : 100
  const label = next ? `Progress to ${next.name}` : 'Every reward unlocked'
  return (
    <div className="rift-player">
      <div className="rift-player__top">
        <Avatar name={user.displayName} src={user.avatarUrl} ring="you" size={40} />
        <div className="min-w-0">
          <p className="rift-player__name">{user.displayName}</p>
          <p className="rift-player__wins">
            <strong>{wins}</strong> ranked {wins === 1 ? 'win' : 'wins'}
          </p>
        </div>
      </div>
      <div className="rift-player__unlock">
        <span>{next ? `Next: ${next.name}` : 'Every reward unlocked'}</span>
        {next && (
          <span className="rift-player__count">
            {wins}/{next.goal}
          </span>
        )}
      </div>
      <div className="rift-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Credits() {
  return (
    <p className="rift-sidebar__small">
      Icons by Lorc and Delapouite from <a href="https://game-icons.net">game-icons.net</a>,{' '}
      <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>.
    </p>
  )
}

export default function Sidebar({ className }: { className?: string }) {
  const { game, user } = useApp()
  const pick = usePickGame()
  const { pathname } = useLocation()
  const current = currentNavKey(pathname)
  const settings = hinted('foot-settings', 'Rift and Classic, Chaos mode and Cosmos mode, and your other settings.')
  return (
    <aside aria-label="Sidebar" className={cx('rift-sidebar', className)}>
      <Link to="/" className="rift-brand">
        Dissidia Arena
      </Link>

      <div className="rift-switch" role="group" aria-label="Game">
        {(['012', 'nt'] as GameId[]).map((g) => (
          <button key={g} type="button" aria-pressed={game === g} title={GAMES[g].name} className="da-pill da-pill--crest" onClick={() => pick(g)}>
            <GameCrest game={g} size={30} />
            {GAMES[g].short}
          </button>
        ))}
      </div>

      <PlayerCard />

      <MenuBars label="Main" items={navItems(game, user?.role)} current={current} />

      <div className="rift-sidebar__foot">
        <NavLink to="/config" className="rift-foot-btn" {...settings.props}>
          <GiGears size={18} />
          <span>Settings</span>
          {settings.node}
        </NavLink>
        <ModeToggle wide className="rift-foot-btn" />
        <InterfaceSwitcher className="rift-sidebar__interface" />
        <p className="rift-sidebar__small rift-sidebar__fan">Dissidia Arena — a fan project</p>
        <Credits />
      </div>
    </aside>
  )
}
