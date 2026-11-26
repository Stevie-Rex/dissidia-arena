/*
 * Lab (#40), design pass 5. A dev-only page for choosing the Rift redesign by eye. Fixed sample data, no API,
 * no sign-in. This branch never merges. Decisions so far are recorded on #40.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'

import { Avatar } from '../components/ui'
import { cx } from '../lib/format'
import { FacetBackdrop, FramedCrest, FramedIcon, GameEmblem, MoonGlyph, SoundGlyph, SunGlyph, type Frame } from './crests'
import {
  GiCrenulatedShield,
  GiCrossedSwords,
  GiFloatingCrystal,
  GiGears,
  GiHamburgerMenu,
  GiLaurels,
  GiQuillInk,
  GiStoneTower,
  GiTrophy,
  GiVisoredHelm,
  GiWingedSword,
  PhGearFill,
} from './icons'
import { HelpStrip, MenuBars, PickerList, TabTitle, type MenuItem, type PickerSpec } from './menus'
import { GAMES, MATCH, OPPONENT, PLAYER, nextUnlock, type LabGame } from './sample'
import { loadMuted, playMatchFound, saveMuted, unlockAudio } from './sound'
import { LIGHT_VARIANTS, LightBackdrop, LightHero, LightSwitcher, readLightVariant, type LightVariant } from './LightVariants'
import './lab.css'
import './lab-light.css'

type FontSet = 'a' | 'b' | 'c'
type Mode = 'dark' | 'light'
/** Where match status shows. (Not "placement": that is a glossary term for a player's first matches.) */
type StatusSpot = 'sidebar' | 'floating'
type Status = 'none' | 'searching' | 'ready'
type BannerStyle = 'blade' | 'blade2' | 'shard' | 'ribbon'
type Anim = 'shatter' | 'split' | 'sigil'
type Page = 'home' | 'hub' | 'match' | 'menus' | 'crests' | 'light'
type Screen = 'desktop' | 'phone'
/** Pass 4: the font for the match score. */
type ScoreFont = 'chakra' | 'cinzel' | 'marcellus' | 'teko' | 'oxanium'
/** Pass 4: how the next-unlock bar is coloured. */
type UnlockBar = 'duo' | 'blue' | 'gold' | 'shift' | 'sweep'
/** Pass 5: crest frame colours in the light theme. */
type LightFrame = 'silver' | 'navy' | 'gold' | 'line'
/** Pass 5: button colours in the light theme. */
type BtnSet = 'current' | 'navy' | 'silver' | 'blue' | 'ink'

const LIGHT_FRAMES: { value: LightFrame; label: string; detail: string }[] = [
  { value: 'silver', label: 'Silver', detail: 'What it uses now: silver rim, pale fill' },
  { value: 'navy', label: 'Navy enamel · Picked', detail: 'Dark navy fill and a bright gold icon, like an enamel badge' },
  { value: 'gold', label: 'Gold rim', detail: 'A gold rim on a cream fill' },
  { value: 'line', label: 'Flat line', detail: 'No fill, a thin navy outline and a navy icon' },
]

const BTN_SETS: { value: BtnSet; label: string; detail: string }[] = [
  { value: 'current', label: 'Gold and red', detail: 'What it uses now' },
  { value: 'navy', label: 'Navy and gold', detail: 'Navy main buttons, gold for your match' },
  { value: 'silver', label: '012 silver · Picked', detail: 'Silver bevel buttons, selection blue for your match' },
  { value: 'blue', label: 'Selection blue', detail: 'Blue main buttons, dark navy and gold for your match' },
  { value: 'ink', label: 'Ink and gold', detail: 'Near-black buttons with gold text, blue for your match' },
]

const SCORE_FONTS: { value: ScoreFont; label: string; detail: string }[] = [
  { value: 'chakra', label: 'Chakra Petch', detail: 'What it uses now (the font set C heading font)' },
  { value: 'cinzel', label: 'Cinzel', detail: 'Roman, carved-stone numerals' },
  { value: 'marcellus', label: 'Marcellus SC · Picked', detail: 'The title font, so the score matches the headings' },
  { value: 'teko', label: 'Teko', detail: 'Tall and condensed, like a sports scoreboard' },
  { value: 'oxanium', label: 'Oxanium', detail: 'Squared and angular, a crystal-cut look' },
]

const UNLOCK_BARS: { value: UnlockBar; label: string; detail: string }[] = [
  { value: 'duo', label: 'Blue to gold', detail: 'What it uses now' },
  { value: 'blue', label: 'Blue · Picked', detail: 'One colour, Cosmos blue' },
  { value: 'gold', label: 'Gold', detail: 'One colour, gold' },
  { value: 'shift', label: 'Blue turns red', detail: 'One colour that moves from blue to red as you near the unlock' },
  { value: 'sweep', label: 'Blue to red track', detail: 'A blue-to-red track that the bar reveals as it fills' },
]

const FONT_SETS: { value: FontSet; label: string; detail: string }[] = [
  { value: 'c', label: 'C · Picked', detail: 'Marcellus SC · Chakra Petch · Barlow' },
  { value: 'a', label: 'A', detail: 'Marcellus SC · Saira Condensed · Barlow' },
  { value: 'b', label: 'B', detail: 'Cormorant SC bold · Barlow Condensed · Barlow' },
]

const DEFAULT_HINT = 'Point at or focus an item to see what it does.'
const ACCEPT_SECONDS = 60

/* ---------- small pieces ---------- */

const gameInfo = (game: LabGame) => GAMES.find((g) => g.id === game)!

/** Which nav entry a lab page lights up in the sidebar and the bottom bar. */
const NAV_KEY: Record<Page, string> = { home: '', hub: 'hub', match: 'queue', menus: 'more', crests: '', light: '' }

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; title?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="lab-choice" role="group" aria-label={label}>
      <span className="lab-choice__label">{label}</span>
      <div className="lab-choice__opts">
        {options.map((o) => (
          <button key={o.value} type="button" title={o.title} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  className,
}: {
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'chaos' | 'match'
  size?: 'md' | 'lg'
  onClick?: () => void
  className?: string
}) {
  return (
    <button type="button" className={cx('lab-btn', `lab-btn--${variant}`, size === 'lg' && 'lab-btn--lg', className)} onClick={onClick}>
      <span>{children}</span>
    </button>
  )
}

/** Seconds since mount, ticking once a second. Key the caller on the status to restart it. */
function useElapsed() {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return secs
}

function formatMinSec(secs: number) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}

/* ---------- match status (sidebar block or floating card) ---------- */

function StatusContent({
  status,
  game,
  onCancel,
  onAccept,
}: {
  status: Exclude<Status, 'none'>
  game: LabGame
  onCancel: () => void
  onAccept: () => void
}) {
  const secs = useElapsed()
  if (status === 'searching')
    return (
      <>
        <div className="lab-status__head">
          <span className="lab-status__dot" aria-hidden />
          <span className="lab-status__title">Searching</span>
          <span className="lab-status__time">{formatMinSec(secs)}</span>
        </div>
        <p className="lab-status__text">
          {game} · 1v1 Bo3 · {PLAYER.region}
        </p>
        <div className="lab-status__actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </>
    )
  const left = Math.max(0, ACCEPT_SECONDS - secs)
  return (
    <>
      <div className="lab-status__head">
        <FramedIcon frame="diamond" size={34} icon={(s) => <GiCrossedSwords size={s} />} />
        <span className="lab-status__title">Match found</span>
        <span className="lab-status__time">{formatMinSec(left)}</span>
      </div>
      <p className="lab-status__vs">vs {OPPONENT.name}</p>
      <p className="lab-status__text">
        {game} · 1v1 Bo3 · {PLAYER.region}
      </p>
      <div
        className="lab-status__drain"
        role="progressbar"
        aria-label="Time left to accept"
        aria-valuemin={0}
        aria-valuemax={ACCEPT_SECONDS}
        aria-valuenow={left}
      >
        <span style={{ width: `${(left / ACCEPT_SECONDS) * 100}%` }} />
      </div>
      <div className="lab-status__actions">
        <Button size="lg" onClick={onAccept}>
          Accept
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Decline
        </Button>
      </div>
    </>
  )
}

/* ---------- sidebar ---------- */

type Glyph = (size: number) => ReactNode

/** An icon in the chosen crest frame (the bevelled diamond), or plain. */
function crest(frame: Frame, framedSize: number, plainSize: number, glyph: Glyph) {
  return frame === 'none' ? glyph(plainSize) : <FramedIcon frame={frame} size={framedSize} icon={glyph} />
}

type NavEntry = { key: string; label: string; glyph: Glyph; page?: Page; hint: string }

const NAV: NavEntry[] = [
  { key: 'hub', label: 'Hub', glyph: (s) => <GiStoneTower size={s} />, page: 'hub', hint: 'Your game at a glance: the queue, your open match and the Season.' },
  { key: 'queue', label: 'Queue', glyph: (s) => <GiCrossedSwords size={s} />, page: 'match', hint: 'Find a ranked 1v1 Bo3 opponent.' },
  { key: 'ladder', label: 'Ladder', glyph: (s) => <GiLaurels size={s} />, hint: 'Where every player stands this Season.' },
  { key: 'profile', label: 'Profile', glyph: (s) => <GiVisoredHelm size={s} />, hint: 'Your matches, your record and your card.' },
  { key: 'rewards', label: 'Rewards', glyph: (s) => <GiTrophy size={s} />, hint: 'The unlocks your ranked wins earn.' },
]

const ADMIN_NAV: MenuItem = {
  key: 'admin',
  label: 'Admin',
  hint: 'Cases, the Admin log and Admins. Only Admins see this.',
  badge: '3',
  children: [
    { key: 'cases', label: 'Cases', hint: 'Disputed matches and Help requests waiting for an Admin.' },
    { key: 'log', label: 'Admin log', hint: 'Every Admin action, newest first.' },
    { key: 'admins', label: 'Admins', hint: 'Appoint and remove Admins. Only the Master sees this.' },
  ],
}

/** The next-unlock bar. `--p` (0 to 100) drives the colour shift and the sweep. */
function UnlockMeter({ pct, style, label }: { pct: number; style: UnlockBar; label: string }) {
  return (
    <div
      className={cx('lab-bar', `lab-bar--${style}`)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <span style={{ width: `${pct}%`, '--p': Math.max(pct, 1) } as CSSProperties} />
    </div>
  )
}

function PlayerCard({ unlockBar }: { unlockBar: UnlockBar }) {
  const next = nextUnlock(PLAYER.rankedWins)
  const pct = next ? Math.round(((PLAYER.rankedWins - next.from) / (next.goal - next.from)) * 100) : 100
  return (
    <div className="lab-player">
      <div className="lab-player__top">
        <Avatar name={PLAYER.name} ring="you" size={40} />
        <div className="min-w-0">
          <div className="lab-player__name">{PLAYER.name}</div>
          <div className="lab-player__wins">
            <strong>{PLAYER.rankedWins}</strong> ranked wins
          </div>
        </div>
      </div>
      <div className="lab-player__unlock">
        <span>{next ? `Next: ${next.name}` : 'Every reward unlocked'}</span>
        {next && (
          <span className="lab-player__count">
            {PLAYER.rankedWins}/{next.goal}
          </span>
        )}
      </div>
      <UnlockMeter pct={pct} style={unlockBar} label={next ? `Progress to ${next.name}` : 'Every reward unlocked'} />
    </div>
  )
}

function Sidebar({
  page,
  setPage,
  game,
  setGame,
  mode,
  setMode,
  muted,
  setMuted,
  admin,
  frame,
  unlockBar,
  statusSlot,
}: {
  page: Page
  setPage: (p: Page) => void
  game: LabGame
  setGame: (g: LabGame) => void
  mode: Mode
  setMode: (m: Mode) => void
  muted: boolean
  setMuted: (m: boolean) => void
  admin: boolean
  frame: Frame
  unlockBar: UnlockBar
  statusSlot: ReactNode
}) {
  const items: MenuItem[] = NAV.map((n) => ({ key: n.key, label: n.label, hint: n.hint, icon: crest(frame, 30, 20, n.glyph) }))
  if (admin) items.push({ ...ADMIN_NAV, icon: crest(frame, 30, 20, (s) => <GiCrenulatedShield size={s} />) })
  const pick = (key: string) => {
    const target = NAV.find((n) => n.key === key)?.page
    if (target) setPage(target)
  }
  return (
    <aside className="lab-sidebar" aria-label="Sidebar">
      <button type="button" className="lab-brand" onClick={() => setPage('home')}>
        Dissidia Arena
      </button>

      <div className="lab-switch" role="group" aria-label="Game">
        {GAMES.map((g) => (
          <button key={g.id} type="button" aria-pressed={game === g.id} title={g.name} onClick={() => setGame(g.id)}>
            {crest(frame, 30, 22, (s) => <GameEmblem game={g.id} size={s} />)}
            <span>{g.id}</span>
          </button>
        ))}
      </div>

      <PlayerCard unlockBar={unlockBar} />

      <MenuBars label="Main" items={items} current={NAV_KEY[page] || undefined} onPick={pick} compact />

      {statusSlot}

      <div className="lab-sidebar__foot">
        <button type="button" className="lab-foot-btn" aria-current={page === 'menus' ? 'page' : undefined} onClick={() => setPage('menus')}>
          <GiGears size={18} />
          <span>Settings</span>
        </button>
        <button
          type="button"
          className="lab-foot-btn"
          aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        >
          {mode === 'dark' ? <SunGlyph /> : <MoonGlyph />}
          <span>{mode === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button type="button" className="lab-foot-btn" aria-pressed={!muted} onClick={() => setMuted(!muted)}>
          <SoundGlyph muted={muted} />
          <span>{muted ? 'Sound off' : 'Sound on'}</span>
        </button>
        <a className="lab-foot-btn" href="#feedback" onClick={(e) => e.preventDefault()}>
          <GiQuillInk size={18} />
          <span>Feedback on Discord</span>
        </a>
        <p className="lab-sidebar__fan">Dissidia Arena — a fan project</p>
        <Credits />
      </div>
    </aside>
  )
}

/** CC BY 3.0 needs a credit. The build stage turns this into a /credits page and a CREDITS.md. */
function Credits() {
  return (
    <p className="lab-credits">
      Icons by Lorc and Delapouite from{' '}
      <a href="https://game-icons.net" target="_blank" rel="noreferrer">
        game-icons.net
      </a>
      ,{' '}
      <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
        CC BY 3.0
      </a>
      .
    </p>
  )
}

/* ---------- phone bottom bar: five equal tiles ---------- */

function BottomBar({ page, setPage, frame, inert }: { page: Page; setPage: (p: Page) => void; frame: Frame; inert?: boolean }) {
  const tiles: { key: string; label: string; glyph: Glyph; page?: Page }[] = [
    { key: 'hub', label: 'Hub', glyph: (s) => <GiStoneTower size={s} />, page: 'hub' },
    { key: 'ladder', label: 'Ladder', glyph: (s) => <GiLaurels size={s} /> },
    { key: 'queue', label: 'Queue', glyph: (s) => <GiCrossedSwords size={s} />, page: 'match' },
    { key: 'profile', label: 'Profile', glyph: (s) => <GiVisoredHelm size={s} /> },
    { key: 'more', label: 'More', glyph: (s) => <GiHamburgerMenu size={s} />, page: 'menus' },
  ]
  const active = NAV_KEY[page]
  return (
    <nav className="lab-bottombar" aria-label="Phone navigation" inert={inert}>
      {tiles.map((t) => (
        <button
          key={t.key}
          type="button"
          className="lab-tile"
          aria-current={active === t.key ? 'page' : undefined}
          onClick={() => t.page && setPage(t.page)}
        >
          <span className="lab-tile__emblem">{crest(frame, 36, 24, t.glyph)}</span>
          <span className="lab-tile__label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

/* ---------- Hub banner cards ---------- */

type BannerProps = {
  style: BannerStyle
  tone: 'queue' | 'match' | 'season'
  kicker: string
  big?: string
  text: string
  action?: string
  onAction?: () => void
}

function Banner({ style, tone, kicker, big, text, action, onAction }: BannerProps) {
  return (
    <article className={cx('lab-banner', `lab-banner--${style}`, `lab-banner--${tone}`)}>
      <div className="lab-banner__inner">
        <div className="lab-banner__body">
          <span className="lab-banner__kicker">{kicker}</span>
          <div className="lab-banner__main">
            {big && <strong className="lab-banner__big">{big}</strong>}
            <span className="lab-banner__text">{text}</span>
          </div>
        </div>
        {action && (
          <Button variant={tone === 'match' ? 'match' : 'primary'} onClick={onAction}>
            {action}
          </Button>
        )}
      </div>
    </article>
  )
}

/** The three Hub banners, from sample data. */
function hubBanners(game: LabGame, onQueue: () => void, onMatch: () => void): Omit<BannerProps, 'style'>[] {
  return [
    {
      tone: 'queue',
      kicker: `${game} · 1v1 Bo3 · ${PLAYER.region}`,
      big: String(gameInfo(game).searching),
      text: 'players searching now',
      action: 'Queue',
      onAction: onQueue,
    },
    {
      tone: 'match',
      kicker: `Open match #${MATCH.id}`,
      big: '1–1',
      text: `vs ${OPPONENT.name} · Game 3 next`,
      action: 'Go to match',
      onAction: onMatch,
    },
    { tone: 'season', kicker: 'Season status', text: 'Pre-season: wins still count before Season 1' },
  ]
}

/* ---------- pages ---------- */

function Home({ game, hero, onQueue, onMatch }: { game: LabGame; hero: ReactNode; onQueue: () => void; onMatch: () => void }) {
  return (
    <div className="lab-home">
      <section className="lab-hero" aria-label="Hero">
        {hero}
        <div className="lab-hero__copy">
          <p className="lab-kicker">The Rift is open</p>
          <h1 className="lab-display">Dissidia Arena</h1>
          <p className="lab-hero__lede">Ranked 1v1 for Dissidia 012 and NT. Queue, fight a Bo3, climb.</p>
          <div className="lab-hero__actions">
            <Button onClick={onQueue}>Queue</Button>
            <Button variant="ghost">Read the rules</Button>
          </div>
        </div>
      </section>

      <div className="lab-glass-row">
        <div className="lab-glass">
          <span className="lab-glass__label">Searching now · {game}</span>
          <strong className="lab-stat">{gameInfo(game).searching}</strong>
          <Button onClick={onQueue}>Queue</Button>
        </div>
        <div className="lab-glass lab-glass--chaos">
          <span className="lab-glass__label">Your match</span>
          <strong className="lab-stat">1–1</strong>
          <span className="lab-glass__text">vs {OPPONENT.name}</span>
          <Button variant="match" onClick={onMatch}>
            Go to match
          </Button>
        </div>
        <div className="lab-glass lab-glass--cosmos">
          <span className="lab-glass__label">Pre-season</span>
          <span className="lab-glass__text lab-glass__text--lg">Wins still count before Season 1.</span>
        </div>
      </div>

      <section className="lab-section">
        <TabTitle>Recent battles</TabTitle>
        <div className="lab-glass lab-empty">
          <p className="lab-empty__title">No battles fought yet. The Rift is waiting.</p>
          <Button onClick={onQueue}>Queue</Button>
        </div>
      </section>

      <section className="lab-section">
        <TabTitle>Type specimen</TabTitle>
        <div className="lab-glass lab-specimen">
          <p className="lab-display lab-specimen__display">Cosmos &amp; Chaos</p>
          <p className="lab-h2">Ranked wins 23 · Bo3 · 2–1</p>
          <p>
            Body text sits in the body face. Report each game you played, then confirm your opponent's report. A
            dispute goes to an Admin with your statement and Screenshots.
          </p>
          <p className="lab-nums">0123456789 · 12 min ago · Match 1042</p>
        </div>
      </section>
    </div>
  )
}

function Hub({
  style,
  unlockBar,
  game,
  onQueue,
  onMatch,
}: {
  style: BannerStyle
  unlockBar: UnlockBar
  game: LabGame
  onQueue: () => void
  onMatch: () => void
}) {
  const banners = hubBanners(game, onQueue, onMatch)
  return (
    <div className="lab-page">
      <p className="lab-kicker">{gameInfo(game).name}</p>
      <h1 className="lab-h1">Hub</h1>
      <div className="lab-banners">
        {banners.map((b) => (
          <Banner key={b.tone} style={style} {...b} />
        ))}
      </div>

      <h2 className="lab-h2 lab-compare-head">Blade and Blade v2 side by side</h2>
      <p className="lab-note">Blade v2 adds a silver bevelled edge, a slanted title tab, and selection blue on hover and focus.</p>
      <div className="lab-compare lab-compare--two">
        {(['blade', 'blade2'] as const).map((s) => (
          <div key={s}>
            <p className="lab-compare__label">{s === 'blade' ? 'Blade (round 1)' : 'Blade v2 (picked)'}</p>
            <div className="lab-banners">
              {banners.map((b) => (
                <Banner key={b.tone} style={s} {...b} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="lab-h2 lab-compare-head">Next-unlock bar</h2>
      <p className="lab-note">Each style at 10%, 40%, 70% and 95% of the way to an unlock. The toolbar sets the one in the sidebar.</p>
      <div className="lab-unlocks">
        {UNLOCK_BARS.map((u) => (
          <div key={u.value} className={cx('lab-unlocks__row', unlockBar === u.value && 'is-picked')}>
            <div>
              <p className="lab-unlocks__name">{u.label}</p>
              <p className="lab-unlocks__detail">{u.detail}</p>
            </div>
            {[10, 40, 70, 95].map((pct) => (
              <UnlockMeter key={pct} pct={pct} style={u.value} label={`${u.label}, ${pct}%`} />
            ))}
          </div>
        ))}
      </div>

      <h2 className="lab-h2 lab-compare-head">The other styles</h2>
      <div className="lab-compare">
        {(['ribbon', 'shard'] as const).map((s) => (
          <div key={s}>
            <p className="lab-compare__label">{s === 'ribbon' ? 'Ribbon (more variants later)' : 'Shard (rejected in round 1)'}</p>
            <Banner style={s} {...banners[0]} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** A Bo3 score, Cosmos side first. */
function Score({ font, you, them }: { font: ScoreFont; you: number; them: number }) {
  return (
    <div className={cx('lab-versus__score', `lab-score--${font}`)} role="img" aria-label={`Score ${you} to ${them}`}>
      <span className="lab-score__you">{you}</span>
      <span className="lab-versus__dash" aria-hidden>
        –
      </span>
      <span className="lab-score__them">{them}</span>
    </div>
  )
}

function MatchRoom({ game, scoreFont, onFound }: { game: LabGame; scoreFont: ScoreFont; onFound: () => void }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="lab-page lab-match">
      <p className="lab-kicker">
        Match #{MATCH.id} · {game} · Bo{MATCH.bestOf}
      </p>
      <h1 className="lab-h1">Match room</h1>

      <section className="lab-versus" aria-label="Score">
        <div className="lab-versus__side lab-versus__side--cosmos">
          <Avatar name={PLAYER.name} ring="you" size={48} />
          <div>
            <div className="lab-versus__name">{PLAYER.name}</div>
            <div className="lab-versus__tag">You · Cosmos</div>
          </div>
        </div>
        <Score font={scoreFont} you={1} them={1} />
        <div className="lab-versus__side lab-versus__side--chaos">
          <div className="text-right">
            <div className="lab-versus__name">{OPPONENT.name}</div>
            <div className="lab-versus__tag">Opponent · Chaos</div>
          </div>
          <Avatar name={OPPONENT.name} ring="chaos" size={48} />
        </div>
      </section>

      <div className="lab-match__grid">
        <section className="lab-panel lab-panel--tabbed" aria-label="Games">
          <TabTitle>Games</TabTitle>
          <ol className="lab-games">
            {MATCH.games.map((g) => (
              <li key={g.n}>
                <span className="lab-games__n">Game {g.n}</span>
                <span className="lab-games__chars">
                  {g.you} vs {g.them}
                </span>
                <span className={cx('lab-games__result', g.winner === 'you' ? 'is-win' : 'is-loss')}>
                  {g.winner === 'you' ? 'Win' : 'Loss'}
                </span>
              </li>
            ))}
            <li className="lab-games__pending">
              <span className="lab-games__n">Game 3</span>
              <span className="lab-games__chars">Not played yet</span>
            </li>
          </ol>
          <div className="lab-actions">
            <Button>Report result</Button>
            <Button variant="chaos">Dispute</Button>
            <Button variant="ghost">Ask an Admin</Button>
          </div>
        </section>

        <section className="lab-panel lab-panel--tabbed" aria-label="Match chat">
          <TabTitle>Match chat</TabTitle>
          <ul className="lab-chat">
            {MATCH.chat.map((m, i) => (
              <li key={i} className={m.from === 'you' ? 'is-you' : 'is-them'}>
                <span className="lab-chat__who">{m.from === 'you' ? PLAYER.name : OPPONENT.name}</span>
                {m.text}
              </li>
            ))}
          </ul>
          <form
            className="lab-chat__form"
            onSubmit={(e) => {
              e.preventDefault()
              setDraft('')
            }}
          >
            <input aria-label="Message" placeholder="Message" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" className="lab-btn lab-btn--primary">
              <span>Send</span>
            </button>
          </form>
        </section>
      </div>

      <h2 className="lab-h2 lab-compare-head">Score fonts</h2>
      <p className="lab-note">The same score in each font. The toolbar sets the one at the top.</p>
      <div className="lab-scorefonts">
        {SCORE_FONTS.map((f) => (
          <div key={f.value} className={cx('lab-scorefonts__item', scoreFont === f.value && 'is-picked')}>
            <Score font={f.value} you={2} them={1} />
            <p className="lab-unlocks__name">{f.label}</p>
            <p className="lab-unlocks__detail">{f.detail}</p>
          </div>
        ))}
      </div>

      <p className="lab-hint">
        <button type="button" className="lab-link" onClick={onFound}>
          Replay the match-found animation
        </button>
      </p>
    </div>
  )
}

const MORE_MENU: MenuItem[] = [
  { key: 'rewards', label: 'Rewards', icon: <GiTrophy size={20} />, hint: 'The unlocks your ranked wins earn.' },
  { key: 'profile', label: 'Profile', icon: <GiVisoredHelm size={20} />, hint: 'Your matches, your record and your card.' },
  {
    key: 'settings',
    label: 'Settings',
    icon: <GiGears size={20} />,
    hint: 'Appearance, sound and your region.',
    children: [
      { key: 'appearance', label: 'Appearance', hint: 'Dark or light, and Classic if you have unlocked it.' },
      { key: 'sound', label: 'Sound', hint: 'Turn the match-found sound on or off.' },
      { key: 'region', label: 'Region', hint: 'Where you queue. It decides who you meet.' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: <GiCrenulatedShield size={20} />,
    hint: 'Only Admins see this.',
    children: [
      { key: 'cases', label: 'Cases', hint: 'Disputed matches and Help requests waiting for an Admin.' },
      { key: 'log', label: 'Admin log', hint: 'Every Admin action, newest first.' },
      { key: 'admins', label: 'Admins', hint: 'Appoint and remove Admins. Only the Master sees this.' },
    ],
  },
  { key: 'feedback', label: 'Feedback', icon: <GiQuillInk size={20} />, hint: 'Tell us what to fix, on Discord.' },
]

const PICKERS: PickerSpec[] = [
  { key: 'version', label: 'Version', options: ['Dissidia 012', 'Dissidia NT'], hint: 'The game you queue for.' },
  { key: 'season', label: 'Season', options: ['Pre-season', 'Season 1'], hint: 'Which Season the Ladder shows.' },
  { key: 'region', label: 'Region', options: ['EU', 'NA East', 'NA West', 'Asia', 'Oceania'], hint: 'Where you queue.' },
  { key: 'filter', label: 'Cases', options: ['All', 'Disputes', 'Help', 'Unclaimed', 'Mine'], hint: 'Which cases the Admin list shows.' },
  { key: 'sound', label: 'Sound', options: ['On', 'Off'], hint: 'The sound when a match is found.' },
]

function Menus({ muted, setMuted }: { muted: boolean; setMuted: (m: boolean) => void }) {
  const [values, setValues] = useState<Record<string, number>>({})
  const merged = { ...values, sound: muted ? 1 : 0 }
  return (
    <div className="lab-page">
      <p className="lab-kicker">Dissidia 012 patterns, dark theme</p>
      <h1 className="lab-h1">More</h1>
      <p className="lab-note">
        Selection blue and the crystal-shard cursor are a prototype, shown on the bars and pickers only. The help strip
        at the bottom is desktop only.
      </p>
      <div className="lab-menus__grid">
        <section className="lab-panel lab-panel--tabbed" aria-label="More menu">
          <TabTitle>Menu</TabTitle>
          <MenuBars label="More" items={MORE_MENU} />
        </section>
        <section className="lab-panel lab-panel--tabbed" aria-label="Settings">
          <TabTitle>Settings</TabTitle>
          <PickerList
            specs={PICKERS}
            values={merged}
            onChange={(key, i) => (key === 'sound' ? setMuted(i === 1) : setValues((v) => ({ ...v, [key]: i })))}
          />
        </section>
      </div>
    </div>
  )
}

const FRAMES: { frame: Frame; label: string }[] = [
  { frame: 'none', label: 'No frame' },
  { frame: 'diamond', label: 'Bevelled diamond' },
  { frame: 'hexagon', label: 'Hexagon' },
  { frame: 'shield', label: 'Heraldic shield' },
]

const GLYPHS: { label: string; icon: (size: number) => ReactNode }[] = [
  { label: 'Hub · stone-tower', icon: (s) => <GiStoneTower size={s} /> },
  { label: 'Ladder · laurels', icon: (s) => <GiLaurels size={s} /> },
  { label: 'Queue · crossed-swords', icon: (s) => <GiCrossedSwords size={s} /> },
  { label: 'Profile · visored-helm', icon: (s) => <GiVisoredHelm size={s} /> },
  { label: 'More · hamburger-menu', icon: (s) => <GiHamburgerMenu size={s} /> },
  { label: 'Rewards · trophy', icon: (s) => <GiTrophy size={s} /> },
  { label: 'Admin · crenulated-shield', icon: (s) => <GiCrenulatedShield size={s} /> },
  { label: 'Settings · gears', icon: (s) => <GiGears size={s} /> },
  { label: 'Settings · Phosphor gear-fill', icon: (s) => <PhGearFill size={s} /> },
  { label: 'Feedback · quill-ink', icon: (s) => <GiQuillInk size={s} /> },
  { label: '012 · floating-crystal', icon: (s) => <GiFloatingCrystal size={s} /> },
  { label: 'NT · winged-sword', icon: (s) => <GiWingedSword size={s} /> },
]

function LightTests({ lightFrame, btnSet }: { lightFrame: LightFrame; btnSet: BtnSet }) {
  const items: MenuItem[] = [
    { key: 'hub', label: 'Hub', hint: 'Hub', icon: <FramedIcon frame="diamond" size={30} icon={(s) => <GiStoneTower size={s} />} /> },
    { key: 'queue', label: 'Queue', hint: 'Queue', icon: <FramedIcon frame="diamond" size={30} icon={(s) => <GiCrossedSwords size={s} />} /> },
    { key: 'ladder', label: 'Ladder', hint: 'Ladder', icon: <FramedIcon frame="diamond" size={30} icon={(s) => <GiLaurels size={s} />} /> },
  ]
  return (
    <div className="lab-page">
      <p className="lab-kicker">Light theme</p>
      <h1 className="lab-h1">Light tests</h1>
      <p className="lab-note">This page switches the lab to light. The toolbar choices apply to the whole lab in light mode.</p>

      <h2 className="lab-h2 lab-compare-head">Crest frames</h2>
      <div className="lab-lighttests">
        {LIGHT_FRAMES.map((f) => (
          <div key={f.value} data-lightframe={f.value} className={cx('lab-lighttests__item', lightFrame === f.value && 'is-picked')}>
            <MenuBars label={`Frames ${f.label}`} items={items} compact />
            <div className="lab-crest-pair">
              <FramedCrest frame="diamond" game="012" size={56} />
              <FramedCrest frame="diamond" game="NT" size={56} />
            </div>
            <p className="lab-unlocks__name">{f.label}</p>
            <p className="lab-unlocks__detail">{f.detail}</p>
          </div>
        ))}
      </div>

      <h2 className="lab-h2 lab-compare-head">Button colours</h2>
      <p className="lab-note">Dispute stays a warning colour in every set, but quieter than now. Go to match no longer uses it.</p>
      <div className="lab-unlocks">
        {BTN_SETS.map((b) => (
          <div key={b.value} data-btnset={b.value} className={cx('lab-btnrow', btnSet === b.value && 'is-picked')}>
            <div>
              <p className="lab-unlocks__name">{b.label}</p>
              <p className="lab-unlocks__detail">{b.detail}</p>
            </div>
            <div className="lab-btnrow__btns">
              <Button>Queue</Button>
              <Button variant="match">Go to match</Button>
              <Button variant="chaos">Dispute</Button>
              <Button variant="ghost">Read the rules</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Crests() {
  return (
    <div className="lab-page">
      <p className="lab-kicker">Icons and emblems</p>
      <h1 className="lab-h1">Crests</h1>

      <section className="lab-panel lab-panel--tabbed" aria-label="Framed crests">
        <TabTitle>Framed crests</TabTitle>
        <p className="lab-note">Pick one frame for the game emblems, or keep them unframed.</p>
        <div className="lab-crest-grid">
          {FRAMES.map((f) => (
            <figure key={f.frame} className="lab-crest-cell">
              <div className="lab-crest-row">
                {(['012', 'NT'] as const).map((g) => (
                  <span key={g} className="lab-crest-pair">
                    <FramedCrest frame={f.frame} game={g} size={96} />
                    <FramedCrest frame={f.frame} game={g} size={48} />
                  </span>
                ))}
              </div>
              <figcaption>{f.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="lab-panel lab-panel--tabbed mt-8" aria-label="Glyphs">
        <TabTitle>Glyphs at 20 and 28px</TabTitle>
        <ul className="lab-glyphs">
          {GLYPHS.map((g) => (
            <li key={g.label}>
              <span className="lab-glyphs__icons">
                {g.icon(20)}
                {g.icon(28)}
                {g.icon(48)}
              </span>
              <span className="lab-glyphs__label">{g.label}</span>
            </li>
          ))}
        </ul>
        <Credits />
        <p className="lab-note">Phosphor gear-fill is MIT licensed and needs no on-page credit.</p>
      </section>
    </div>
  )
}

/* ---------- match found ---------- */

/** Shards of the crystal: angle, distance, size and spin, fixed so every replay matches. */
const SHARDS = Array.from({ length: 14 }, (_, i) => ({
  a: i * (360 / 14) + (i % 2 ? 9 : -6),
  d: 180 + ((i * 47) % 130),
  s: 0.55 + ((i * 29) % 50) / 100,
  r: (i % 2 ? 1 : -1) * (90 + ((i * 61) % 180)),
}))

function MatchFound({
  anim,
  game,
  frame,
  onAccept,
  onDecline,
}: {
  anim: Anim
  game: LabGame
  frame: Frame
  onAccept: () => void
  onDecline: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const accepted = useRef(false)

  // Focus moves into the dialog on open. On close it goes back where it came from, or to the match room heading
  // after Accept.
  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement instanceof HTMLElement && !dialog?.contains(document.activeElement) ? document.activeElement : null
    dialog?.querySelector<HTMLElement>('.lab-found__card button')?.focus()
    return () => {
      requestAnimationFrame(() => {
        // Still on the page: a dev-mode effect re-run, not a real close.
        if (dialog?.isConnected) return
        const heading = document.querySelector<HTMLElement>('.lab-main :is(h1, h2)')
        const target = accepted.current || !opener?.isConnected ? heading : opener
        if (target === heading) heading?.setAttribute('tabindex', '-1')
        target?.focus()
      })
    }
  }, [])

  // Tab and Shift+Tab stay inside the dialog. Escape declines, the same as the Decline key.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onDecline()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const keys = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled])')]
    if (keys.length === 0) return
    const first = keys[0]
    const last = keys[keys.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div ref={ref} className={cx('lab-found', `lab-found--${anim}`)} role="dialog" aria-modal aria-label="Match found" onKeyDown={onKeyDown}>
      <div className="lab-found__fx" aria-hidden>
        {anim === 'shatter' && (
          <>
            <span className="lab-found__glow" />
            <span className="lab-found__crystal">
              <span className="lab-found__crack" />
            </span>
            <span className="lab-found__ring" />
            {SHARDS.map((s, i) => (
              <span
                key={i}
                className="lab-found__shard"
                style={
                  {
                    '--a': `${s.a}deg`,
                    '--d': `${s.d}px`,
                    '--s': s.s,
                    '--r': `${s.r}deg`,
                  } as CSSProperties
                }
              />
            ))}
          </>
        )}
        {anim === 'split' && (
          <>
            <span className="lab-found__half lab-found__half--cosmos" />
            <span className="lab-found__half lab-found__half--chaos" />
            <span className="lab-found__flash" />
          </>
        )}
        {anim === 'sigil' && (
          <>
            <span className="lab-found__sring" style={{ ['--i' as string]: 0 }} />
            <span className="lab-found__sring" style={{ ['--i' as string]: 1 }} />
            <span className="lab-found__sring" style={{ ['--i' as string]: 2 }} />
            <svg className="lab-found__sigil" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" />
              <path d="M100 20 L169 140 L31 140 Z M100 180 L31 60 L169 60 Z" />
            </svg>
          </>
        )}
      </div>
      <div className="lab-found__card">
        <span className="lab-found__crest">
          <FramedCrest frame={frame} game={game} size={72} />
        </span>
        <p className="lab-kicker">Match found</p>
        <p className="lab-found__title">
          <span className="lab-found__you">{PLAYER.name}</span>
          <span className="lab-found__vs">vs</span>
          <span className="lab-found__them">{OPPONENT.name}</span>
        </p>
        <p className="lab-found__meta">
          {game} · 1v1 Bo3 · {PLAYER.region}
        </p>
        <div className="lab-actions lab-actions--center">
          <Button
            size="lg"
            onClick={() => {
              accepted.current = true
              onAccept()
            }}
          >
            Accept
          </Button>
          <Button variant="ghost" onClick={onDecline}>
            Decline
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------- the lab ---------- */

export default function Lab() {
  const [fontSet, setFontSet] = useState<FontSet>('c')
  const [lightVariant, setLightVariant] = useState<LightVariant>(() => readLightVariant() ?? 'a')
  const [mode, setMode] = useState<Mode>(() => (readLightVariant() ? 'light' : 'dark'))
  const [statusSpot, setStatusSpot] = useState<StatusSpot>('floating')
  const [status, setStatus] = useState<Status>('searching')
  const [banner, setBanner] = useState<BannerStyle>('blade2')
  const [anim, setAnim] = useState<Anim>('shatter')
  const [page, setPage] = useState<Page>('home')
  const [screen, setScreen] = useState<Screen>('desktop')
  const [game, setGame] = useState<LabGame>('012')
  const [admin, setAdmin] = useState(true)
  const [still, setStill] = useState(false)
  const [frame, setFrame] = useState<Frame>('diamond')
  const [scoreFont, setScoreFont] = useState<ScoreFont>('marcellus')
  const [unlockBar, setUnlockBar] = useState<UnlockBar>('blue')
  const [lightFrame, setLightFrame] = useState<LightFrame>('navy')
  const [btnSet, setBtnSet] = useState<BtnSet>('silver')
  const [muted, setMutedState] = useState(loadMuted)
  /** Bumped to replay the match-found overlay; 0 means it is closed. */
  const [foundRun, setFoundRun] = useState(0)
  const [hint, setHint] = useState(DEFAULT_HINT)
  /** Hides the lab toolbar and the variant bar so the design can be seen on its own. H toggles it. */
  const [clean, setClean] = useState(() => localStorage.getItem('lab-clean') === '1')
  useEffect(() => {
    localStorage.setItem('lab-clean', clean ? '1' : '0')
  }, [clean])
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'h' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.matches('input, textarea, select, [contenteditable]') || el.isContentEditable)) return
      setClean((c) => !c)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const prev = document.title
    document.title = 'Lab · Dissidia Arena'
    return () => {
      document.title = prev
    }
  }, [])

  const setMuted = (m: boolean) => {
    setMutedState(m)
    saveMuted(m)
    if (!m) unlockAudio()
  }

  /** A match is found: the overlay plays, the status turns to Match found, and the sound plays. */
  const findMatch = () => {
    setFoundRun((n) => n + 1)
    setStatus('ready')
    playMatchFound(muted)
  }
  const queue = () => {
    unlockAudio()
    setStatus('searching')
  }
  const accept = () => {
    setFoundRun(0)
    setStatus('none')
    setPage('match')
  }
  const decline = () => {
    setFoundRun(0)
    setStatus('none')
  }
  const changeStatus = (s: Status) => {
    setStatus(s)
    if (s === 'ready') playMatchFound(muted)
  }

  const readHint = (e: SyntheticEvent) => {
    const el = (e.target as HTMLElement).closest?.('[data-hint]')
    if (el) setHint(el.getAttribute('data-hint') ?? DEFAULT_HINT)
  }

  const statusProps =
    status === 'none' ? null : { status, game, onCancel: () => setStatus('none'), onAccept: accept }

  const content = {
    home: <Home game={game} hero={<LightHero variant={mode === 'light' ? lightVariant : 'p5'} />} onQueue={queue} onMatch={() => setPage('match')} />,
    hub: <Hub style={banner} unlockBar={unlockBar} game={game} onQueue={queue} onMatch={() => setPage('match')} />,
    match: <MatchRoom game={game} scoreFont={scoreFont} onFound={findMatch} />,
    menus: <Menus muted={muted} setMuted={setMuted} />,
    crests: <Crests />,
    light: <LightTests lightFrame={lightFrame} btnSet={btnSet} />,
  }[page]
  const backdrop = page !== 'match'

  return (
    <div className={cx('lab', still && 'lab--still', clean && 'lab--clean')} data-fontset={fontSet} data-mode={mode} data-screen={screen} data-lightframe={lightFrame} data-btnset={btnSet} data-light={mode === 'light' && lightVariant !== 'p5' ? lightVariant : undefined}>
      <header className="lab-toolbar" aria-label="Lab controls">
        <strong className="lab-toolbar__title">Lab · light variants (#55)</strong>
        <button type="button" className="lab-toolbar__hide" onClick={() => setClean(true)} title="Hide the lab controls (H)">
          Hide controls · H
        </button>
        <Choice
          label="Page"
          value={page}
          onChange={(p) => {
            setPage(p)
            if (p === 'light') setMode('light')
          }}
          options={[
            { value: 'home', label: 'Home' },
            { value: 'hub', label: 'Hub' },
            { value: 'match', label: 'Match room' },
            { value: 'menus', label: 'More menu' },
            { value: 'crests', label: 'Crests' },
            { value: 'light', label: 'Light tests' },
          ]}
        />
        <Choice
          label="Screen"
          value={screen}
          onChange={setScreen}
          options={[
            { value: 'desktop', label: 'Desktop' },
            { value: 'phone', label: 'Phone' },
          ]}
        />
        <Choice
          label="Fonts"
          value={fontSet}
          onChange={setFontSet}
          options={FONT_SETS.map((f) => ({ value: f.value, label: f.label, title: f.detail }))}
        />
        <Choice
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
        />
        <Choice
          label="Status"
          value={status}
          onChange={changeStatus}
          options={[
            { value: 'none', label: 'None' },
            { value: 'searching', label: 'Searching' },
            { value: 'ready', label: 'Match found' },
          ]}
        />
        <Choice
          label="Status in"
          value={statusSpot}
          onChange={setStatusSpot}
          options={[
            { value: 'floating', label: 'Floating card · Picked' },
            { value: 'sidebar', label: 'Sidebar' },
          ]}
        />
        <Choice
          label="Crests"
          value={frame}
          onChange={setFrame}
          options={[
            { value: 'diamond', label: 'Bevelled diamond' },
            { value: 'none', label: 'Plain' },
          ]}
        />
        <Choice
          label="Banners"
          value={banner}
          onChange={setBanner}
          options={[
            { value: 'blade2', label: 'Blade v2 · Picked' },
            { value: 'blade', label: 'Blade' },
            { value: 'ribbon', label: 'Ribbon' },
            { value: 'shard', label: 'Shard' },
          ]}
        />
        <Choice
          label="Score font"
          value={scoreFont}
          onChange={(f) => {
            setScoreFont(f)
            setPage('match')
          }}
          options={SCORE_FONTS.map((f) => ({ value: f.value, label: f.label, title: f.detail }))}
        />
        <Choice
          label="Unlock bar"
          value={unlockBar}
          onChange={setUnlockBar}
          options={UNLOCK_BARS.map((u) => ({ value: u.value, label: u.label, title: u.detail }))}
        />
        <Choice
          label="Light variant"
          value={lightVariant}
          onChange={(v) => {
            setLightVariant(v)
            setMode('light')
            const url = new URL(window.location.href)
            url.searchParams.set('light', v)
            window.history.replaceState(null, '', url)
          }}
          options={LIGHT_VARIANTS.map((v) => ({ value: v.key, label: v.key === 'p5' ? '0 · Pass 5' : `${v.key.toUpperCase()} · ${v.name}`, title: v.idea }))}
        />
        <Choice
          label="Light frames (0 only)"
          value={lightFrame}
          onChange={(f) => {
            setLightFrame(f)
            setMode('light')
          }}
          options={LIGHT_FRAMES.map((f) => ({ value: f.value, label: f.label, title: f.detail }))}
        />
        <Choice
          label="Light buttons (0 only)"
          value={btnSet}
          onChange={(b) => {
            setBtnSet(b)
            setMode('light')
          }}
          options={BTN_SETS.map((b) => ({ value: b.value, label: b.label, title: b.detail }))}
        />
        <Choice
          label="Match found"
          value={anim}
          onChange={(a) => {
            setAnim(a)
            findMatch()
          }}
          options={[
            { value: 'shatter', label: 'Crystal shatter · Picked' },
            { value: 'split', label: 'Cosmos/Chaos split' },
            { value: 'sigil', label: 'Sigil rings' },
          ]}
        />
        <div className="lab-choice">
          <span className="lab-choice__label">Other</span>
          <div className="lab-choice__opts">
            <button type="button" onClick={findMatch}>
              ▶ Find a match
            </button>
            <button type="button" aria-pressed={!muted} onClick={() => setMuted(!muted)}>
              Sound
            </button>
            <button type="button" aria-pressed={admin} onClick={() => setAdmin(!admin)}>
              Admin
            </button>
            <button type="button" aria-pressed={still} onClick={() => setStill(!still)} title="Simulates prefers-reduced-motion">
              Reduced motion
            </button>
          </div>
        </div>
        <p className="lab-toolbar__fonts">{FONT_SETS.find((f) => f.value === fontSet)!.detail}</p>
      </header>

      {clean && (
        <button type="button" className="lab-showcontrols" onClick={() => setClean(false)} title="Show the lab controls (H)">
          Lab · H
        </button>
      )}

      <div className="lab-stage-wrap">
        <div className="lab-stage">
          {backdrop && (mode === 'light' ? <LightBackdrop variant={lightVariant} /> : <FacetBackdrop />)}
          <div className="lab-shell" onMouseOver={readHint} onFocus={readHint} inert={foundRun > 0}>
            <Sidebar
              page={page}
              setPage={setPage}
              game={game}
              setGame={setGame}
              mode={mode}
              setMode={setMode}
              muted={muted}
              setMuted={setMuted}
              admin={admin}
              frame={frame}
              unlockBar={unlockBar}
              statusSlot={
                statusSpot === 'sidebar' && statusProps ? (
                  <div className={cx('lab-status lab-status--sidebar', status === 'ready' && 'lab-status--alert')} role="status">
                    <StatusContent key={status} {...statusProps} />
                  </div>
                ) : null
              }
            />
            <div className="lab-column">
              <main className={cx('lab-main', backdrop ? 'lab-main--backdrop' : 'lab-main--plain')}>{content}</main>
              <HelpStrip text={hint} />
            </div>
          </div>

          {statusProps && (
            <div
              className={cx(
                'lab-status lab-status--float',
                status === 'ready' && 'lab-status--alert',
                statusSpot === 'sidebar' && 'lab-status--phone-only',
              )}
              role="status"
              inert={foundRun > 0}
            >
              <StatusContent key={status} {...statusProps} />
            </div>
          )}

          <BottomBar page={page} setPage={setPage} frame={frame} inert={foundRun > 0} />

          {foundRun > 0 && <MatchFound key={foundRun} anim={anim} game={game} frame={frame} onAccept={accept} onDecline={decline} />}
        </div>
      </div>

      {mode === 'light' && (
        <LightSwitcher
          value={lightVariant}
          onChange={(v) => {
            setLightVariant(v)
          }}
        />
      )}
    </div>
  )
}
