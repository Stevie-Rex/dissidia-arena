/*
 * Lab, round 1 (#40). A dev-only page for choosing the Rift redesign by eye. Fixed sample data, no API,
 * no sign-in. This branch never merges.
 */
import { useEffect, useState, type ReactNode } from 'react'

import { Avatar } from '../components/ui'
import { cx } from '../lib/format'
import {
  AdminCrest,
  FeedbackCrest,
  GameEmblem,
  HeroComposition,
  HubCrest,
  LadderCrest,
  MoonGlyph,
  MoreCrest,
  ProfileCrest,
  QueueCrest,
  SettingsCrest,
  SunGlyph,
} from './crests'
import { GAMES, MATCH, OPPONENT, PLAYER, nextUnlock, type LabGame } from './sample'
import './lab.css'

type FontSet = 'a' | 'b' | 'c'
type Mode = 'dark' | 'light'
/** Where match status shows. (Not "placement": that is a glossary term for a player's first matches.) */
type StatusSpot = 'sidebar' | 'floating'
type Status = 'none' | 'searching' | 'ready'
type BannerStyle = 'blade' | 'shard' | 'ribbon'
type Anim = 'shatter' | 'split' | 'sigil'
type Page = 'home' | 'hub' | 'match'
type Screen = 'desktop' | 'phone'

const FONT_SETS: { value: FontSet; label: string; detail: string }[] = [
  { value: 'a', label: 'A · Lead', detail: 'Marcellus SC · Saira Condensed · Barlow' },
  { value: 'b', label: 'B', detail: 'Cormorant SC bold · Barlow Condensed · Barlow' },
  { value: 'c', label: 'C', detail: 'Marcellus SC · Chakra Petch · Barlow' },
]

/* ---------- small pieces ---------- */

const gameInfo = (game: LabGame) => GAMES.find((g) => g.id === game)!

/** Which nav entry a lab page lights up in the sidebar and the bottom bar. */
const navKey = (page: Page) => (page === 'hub' ? 'hub' : page === 'match' ? 'queue' : '')

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
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
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
  onClick,
  className,
}: {
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'chaos'
  onClick?: () => void
  className?: string
}) {
  return (
    <button type="button" className={cx('lab-btn', `lab-btn--${variant}`, className)} onClick={onClick}>
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

function clock(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/* ---------- match status (sidebar block or floating card) ---------- */

function StatusContent({
  status,
  game,
  onCancel,
  onOpen,
}: {
  status: Exclude<Status, 'none'>
  game: LabGame
  onCancel: () => void
  onOpen: () => void
}) {
  const secs = useElapsed()
  if (status === 'searching')
    return (
      <>
        <div className="lab-status__head">
          <span className="lab-status__pulse" aria-hidden />
          <span className="lab-status__title">Searching</span>
          <span className="lab-status__time">{clock(secs)}</span>
        </div>
        <p className="lab-status__text">
          {game} · 1v1 Bo3 · {PLAYER.region}
        </p>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </>
    )
  const left = Math.max(0, 60 - secs)
  return (
    <>
      <div className="lab-status__head">
        <span className="lab-status__pulse lab-status__pulse--ready" aria-hidden />
        <span className="lab-status__title">Match ready</span>
        <span className="lab-status__time">{clock(left)}</span>
      </div>
      <p className="lab-status__text">vs {OPPONENT.name}</p>
      <Button onClick={onOpen}>Accept</Button>
    </>
  )
}

/* ---------- sidebar ---------- */

const NAV: { key: string; label: string; icon: ReactNode; page?: Page }[] = [
  { key: 'hub', label: 'Hub', icon: <HubCrest size={20} />, page: 'hub' },
  { key: 'queue', label: 'Queue', icon: <QueueCrest size={20} />, page: 'match' },
  { key: 'ladder', label: 'Ladder', icon: <LadderCrest size={20} /> },
  { key: 'profile', label: 'Profile', icon: <ProfileCrest size={20} /> },
  { key: 'rewards', label: 'Rewards', icon: <MoreCrest size={20} /> },
]

function PlayerCard() {
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
      <div
        className="lab-bar"
        role="progressbar"
        aria-label={next ? `Progress to ${next.name}` : 'Every reward unlocked'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
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
  admin,
  statusSlot,
}: {
  page: Page
  setPage: (p: Page) => void
  game: LabGame
  setGame: (g: LabGame) => void
  mode: Mode
  setMode: (m: Mode) => void
  admin: boolean
  statusSlot: ReactNode
}) {
  const active = navKey(page)
  return (
    <aside className="lab-sidebar" aria-label="Sidebar">
      <button type="button" className="lab-brand" onClick={() => setPage('home')}>
        Dissidia Arena
      </button>

      <div className="lab-switch" role="group" aria-label="Game">
        {GAMES.map((g) => (
          <button key={g.id} type="button" aria-pressed={game === g.id} title={g.name} onClick={() => setGame(g.id)}>
            <GameEmblem game={g.id} size={22} />
            <span>{g.id}</span>
          </button>
        ))}
      </div>

      <PlayerCard />

      <nav className="lab-nav" aria-label="Main">
        {NAV.map((n) => (
          <button
            key={n.key}
            type="button"
            aria-current={active === n.key ? 'page' : undefined}
            onClick={() => n.page && setPage(n.page)}
          >
            {n.icon}
            <span>{n.label}</span>
          </button>
        ))}
        {admin && (
          <button type="button" className="lab-nav__admin">
            <AdminCrest size={20} />
            <span>Admin</span>
            <span className="lab-nav__badge">3</span>
          </button>
        )}
      </nav>

      {statusSlot}

      <div className="lab-sidebar__foot">
        <button type="button" className="lab-foot-btn">
          <SettingsCrest />
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
        <a className="lab-foot-btn" href="#feedback" onClick={(e) => e.preventDefault()}>
          <FeedbackCrest />
          <span>Feedback on Discord</span>
        </a>
        <p className="lab-sidebar__fan">Dissidia Arena — a fan project</p>
      </div>
    </aside>
  )
}

/* ---------- phone bottom bar ---------- */

function BottomBar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const tiles: { key: string; label: string; icon: ReactNode; page?: Page; big?: boolean }[] = [
    { key: 'hub', label: 'Hub', icon: <HubCrest size={24} />, page: 'hub' },
    { key: 'ladder', label: 'Ladder', icon: <LadderCrest size={24} /> },
    { key: 'queue', label: 'Queue', icon: <QueueCrest size={34} />, page: 'match', big: true },
    { key: 'profile', label: 'Profile', icon: <ProfileCrest size={24} /> },
    { key: 'more', label: 'More', icon: <MoreCrest size={24} /> },
  ]
  const active = navKey(page)
  return (
    <nav className="lab-bottombar" aria-label="Phone navigation">
      {tiles.map((t) => (
        <button
          key={t.key}
          type="button"
          className={cx('lab-tile', t.big && 'lab-tile--big')}
          aria-current={active === t.key ? 'page' : undefined}
          onClick={() => t.page && setPage(t.page)}
        >
          <span className="lab-tile__emblem">{t.icon}</span>
          <span className="lab-tile__label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

/* ---------- Hub banner cards ---------- */

function Banner({
  style,
  tone,
  kicker,
  big,
  text,
  action,
  onAction,
}: {
  style: BannerStyle
  tone: 'queue' | 'match' | 'season'
  kicker: string
  big?: string
  text: string
  action?: string
  onAction?: () => void
}) {
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
          <Button variant={tone === 'match' ? 'chaos' : 'primary'} onClick={onAction}>
            {action}
          </Button>
        )}
      </div>
    </article>
  )
}

function HubBanners({ style, game, onQueue, onMatch }: { style: BannerStyle; game: LabGame; onQueue: () => void; onMatch: () => void }) {
  const searching = gameInfo(game).searching
  return (
    <div className="lab-banners">
      <Banner
        style={style}
        tone="queue"
        kicker={`${game} · 1v1 Bo3 · ${PLAYER.region}`}
        big={String(searching)}
        text="players searching now"
        action="Queue"
        onAction={onQueue}
      />
      <Banner
        style={style}
        tone="match"
        kicker={`Open match #${MATCH.id}`}
        big="1–1"
        text={`vs ${OPPONENT.name} · Game 3 next`}
        action="Go to match"
        onAction={onMatch}
      />
      <Banner style={style} tone="season" kicker="Season status" text="Pre-season: wins still count before Season 1" />
    </div>
  )
}

/* ---------- pages ---------- */

function Home({ game, onQueue, onMatch }: { game: LabGame; onQueue: () => void; onMatch: () => void }) {
  const searching = gameInfo(game).searching
  return (
    <div className="lab-home">
      <section className="lab-hero" aria-label="Hero">
        <HeroComposition />
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
          <strong className="lab-stat">{searching}</strong>
          <Button onClick={onQueue}>Queue</Button>
        </div>
        <div className="lab-glass lab-glass--chaos">
          <span className="lab-glass__label">Your match</span>
          <strong className="lab-stat">1–1</strong>
          <span className="lab-glass__text">vs {OPPONENT.name}</span>
          <Button variant="chaos" onClick={onMatch}>
            Go to match
          </Button>
        </div>
        <div className="lab-glass lab-glass--cosmos">
          <span className="lab-glass__label">Pre-season</span>
          <span className="lab-glass__text lab-glass__text--lg">Wins still count before Season 1.</span>
        </div>
      </div>

      <section className="lab-section">
        <h2 className="lab-h2">Recent battles</h2>
        <div className="lab-glass lab-empty">
          <p className="lab-empty__title">No battles fought yet. The Rift is waiting.</p>
          <Button onClick={onQueue}>Queue</Button>
        </div>
      </section>

      <section className="lab-section">
        <h2 className="lab-h2">Type specimen</h2>
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

function Hub({ style, game, onQueue, onMatch }: { style: BannerStyle; game: LabGame; onQueue: () => void; onMatch: () => void }) {
  return (
    <div className="lab-page lab-page--glass">
      <p className="lab-kicker">{gameInfo(game).name}</p>
      <h1 className="lab-h1">Hub</h1>
      <HubBanners style={style} game={game} onQueue={onQueue} onMatch={onMatch} />

      <h2 className="lab-h2 lab-compare-head">All three styles side by side</h2>
      <div className="lab-compare">
        {(['blade', 'shard', 'ribbon'] as const).map((s) => (
          <div key={s}>
            <p className="lab-compare__label">{s}</p>
            <Banner
              style={s}
              tone="queue"
              kicker={`${game} · 1v1 Bo3 · ${PLAYER.region}`}
              big="14"
              text="players searching now"
              action="Queue"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchRoom({ game, onFound }: { game: LabGame; onFound: () => void }) {
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
        <div className="lab-versus__score">
          <span>1</span>
          <span className="lab-versus__dash">–</span>
          <span>1</span>
        </div>
        <div className="lab-versus__side lab-versus__side--chaos">
          <div className="text-right">
            <div className="lab-versus__name">{OPPONENT.name}</div>
            <div className="lab-versus__tag">Opponent · Chaos</div>
          </div>
          <Avatar name={OPPONENT.name} ring="chaos" size={48} />
        </div>
      </section>

      <div className="lab-match__grid">
        <section className="lab-panel" aria-label="Games">
          <h2 className="lab-h2">Games</h2>
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

        <section className="lab-panel" aria-label="Match chat">
          <h2 className="lab-h2">Match chat</h2>
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

      <p className="lab-hint">
        <button type="button" className="lab-link" onClick={onFound}>
          Replay the match-found animation
        </button>
      </p>
    </div>
  )
}

/* ---------- match found ---------- */

function MatchFound({ anim, game, onClose }: { anim: Anim; game: LabGame; onClose: () => void }) {
  const shards = Array.from({ length: 10 }, (_, i) => i)
  return (
    <div className={cx('lab-found', `lab-found--${anim}`)} role="dialog" aria-modal aria-label="Match found">
      <div className="lab-found__fx" aria-hidden>
        {anim === 'shatter' && (
          <>
            <span className="lab-found__crystal" />
            {shards.map((i) => (
              <span key={i} className="lab-found__shard" style={{ ['--i' as string]: i }} />
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
            <span className="lab-found__ring" style={{ ['--i' as string]: 0 }} />
            <span className="lab-found__ring" style={{ ['--i' as string]: 1 }} />
            <span className="lab-found__ring" style={{ ['--i' as string]: 2 }} />
            <svg className="lab-found__sigil" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" />
              <path d="M100 20 L169 140 L31 140 Z M100 180 L31 60 L169 60 Z" />
            </svg>
          </>
        )}
      </div>
      <div className="lab-found__card">
        <p className="lab-kicker">Match found</p>
        <p className="lab-found__title">
          <span className="lab-found__you">{PLAYER.name}</span>
          <span className="lab-found__vs">vs</span>
          <span className="lab-found__them">{OPPONENT.name}</span>
        </p>
        <p className="lab-found__meta">{game} · 1v1 Bo3 · {PLAYER.region}</p>
        <div className="lab-actions lab-actions--center">
          <Button onClick={onClose}>Accept</Button>
          <Button variant="ghost" onClick={onClose}>
            Decline
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------- the lab ---------- */

export default function Lab() {
  const [fontSet, setFontSet] = useState<FontSet>('a')
  const [mode, setMode] = useState<Mode>('dark')
  const [statusSpot, setStatusSpot] = useState<StatusSpot>('sidebar')
  const [status, setStatus] = useState<Status>('searching')
  const [banner, setBanner] = useState<BannerStyle>('blade')
  const [anim, setAnim] = useState<Anim>('shatter')
  const [page, setPage] = useState<Page>('home')
  const [screen, setScreen] = useState<Screen>('desktop')
  const [game, setGame] = useState<LabGame>('012')
  const [admin, setAdmin] = useState(true)
  const [still, setStill] = useState(false)
  const [found, setFound] = useState(0)

  useEffect(() => {
    const prev = document.title
    document.title = 'Lab · Dissidia Arena'
    return () => {
      document.title = prev
    }
  }, [])

  const playFound = () => setFound((n) => n + 1)
  const statusProps =
    status === 'none'
      ? null
      : {
          status,
          game,
          onCancel: () => setStatus('none'),
          onOpen: () => {
            setStatus('none')
            setPage('match')
          },
        }

  const content =
    page === 'home' ? (
      <Home game={game} onQueue={() => setStatus('searching')} onMatch={() => setPage('match')} />
    ) : page === 'hub' ? (
      <Hub style={banner} game={game} onQueue={() => setStatus('searching')} onMatch={() => setPage('match')} />
    ) : (
      <MatchRoom game={game} onFound={playFound} />
    )

  return (
    <div
      className={cx('lab', still && 'lab--still')}
      data-fontset={fontSet}
      data-mode={mode}
      data-screen={screen}
    >
      <header className="lab-toolbar" aria-label="Lab controls">
        <strong className="lab-toolbar__title">Lab · round 1</strong>
        <Choice
          label="Page"
          value={page}
          onChange={setPage}
          options={[
            { value: 'home', label: 'Home' },
            { value: 'hub', label: 'Hub' },
            { value: 'match', label: 'Match room' },
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
          onChange={setStatus}
          options={[
            { value: 'none', label: 'None' },
            { value: 'searching', label: 'Searching' },
            { value: 'ready', label: 'Match ready' },
          ]}
        />
        <Choice
          label="Status in"
          value={statusSpot}
          onChange={setStatusSpot}
          options={[
            { value: 'sidebar', label: 'Sidebar' },
            { value: 'floating', label: 'Floating card' },
          ]}
        />
        <Choice
          label="Banners"
          value={banner}
          onChange={setBanner}
          options={[
            { value: 'blade', label: 'Blade' },
            { value: 'shard', label: 'Shard' },
            { value: 'ribbon', label: 'Ribbon' },
          ]}
        />
        <Choice
          label="Match found"
          value={anim}
          onChange={(a) => {
            setAnim(a)
            playFound()
          }}
          options={[
            { value: 'shatter', label: 'Crystal shatter' },
            { value: 'split', label: 'Cosmos/Chaos split' },
            { value: 'sigil', label: 'Sigil rings' },
          ]}
        />
        <div className="lab-choice">
          <span className="lab-choice__label">Other</span>
          <div className="lab-choice__opts">
            <button type="button" onClick={playFound}>
              ▶ Play
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

      <div className="lab-stage-wrap">
        <div className="lab-stage" data-status-spot={statusSpot}>
          <div className="lab-shell">
            <Sidebar
              page={page}
              setPage={setPage}
              game={game}
              setGame={setGame}
              mode={mode}
              setMode={setMode}
              admin={admin}
              statusSlot={
                statusSpot === 'sidebar' && statusProps ? (
                  <div className="lab-status lab-status--sidebar" role="status">
                    <StatusContent key={status} {...statusProps} />
                  </div>
                ) : null
              }
            />
            <main className={cx('lab-main', page === 'match' ? 'lab-main--plain' : 'lab-main--backdrop')}>{content}</main>
          </div>

          {statusProps && (
            <div
              className={cx('lab-status lab-status--float', statusSpot === 'sidebar' && 'lab-status--phone-only')}
              role="status"
            >
              <StatusContent key={status} {...statusProps} />
            </div>
          )}

          <BottomBar page={page} setPage={setPage} />

          {found > 0 && <MatchFound key={found} anim={anim} game={game} onClose={() => setFound(0)} />}
        </div>
      </div>
    </div>
  )
}
