import { useId, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GAMES, MATCHES, ladder, playerById, type GameId } from '../data/mock'
import { OPEN_STATUSES } from '../lib/api'
import { cx } from '../lib/format'
import { useApp } from '../state/AppState'
import { useAppearance } from '../state/Appearance'
import { useGameParam } from '../useGameParam'
import { Art, Avatar, Btn, Card, Stat, Sub, TextLink } from '../components/ui'
import { FacetBackdrop } from '../components/rift/FacetBackdrop'
import { Panel } from '../components/rift/menus'
import '../theme/css/rift-hub.css'

const RULES: Record<GameId, string> = {
  nt: "Latest patch · stage list: Kefka's Tower, Pandaemonium, Orphan's Cradle, Midgar · disconnect = replay the game once, then forfeit",
  '012': 'PPSSPP 1.17+ · banned stages: none · no EX mode restrictions · disconnect = replay the game once, then forfeit',
}

export default function Hub() {
  const { ui } = useAppearance()
  return ui === 'classic' ? <ClassicHub /> : <RiftHub />
}

/* ------------------------------------------------------------------ Rift */

/** A Blade v2 banner card. Its slanted title tab is the heading that names it. */
function Banner({ tone, kicker, children, action }: { tone: 'queue' | 'match' | 'season'; kicker: string; children: ReactNode; action?: ReactNode }) {
  const id = useId()
  return (
    <section className={cx('rift-banner', `rift-banner--${tone}`)} aria-labelledby={id}>
      <div className="rift-banner__inner">
        <div className="rift-banner__body">
          <h2 id={id} className="rift-banner__kicker">{kicker}</h2>
          <div className="rift-banner__main">{children}</div>
        </div>
        {action && <div>{action}</div>}
      </div>
    </section>
  )
}

/** Hub: the game's banner cards, built only from real data (the queue poll, your open match, the season). */
function RiftHub() {
  const game = useGameParam()
  const info = GAMES[game]
  const { signedIn, startQueue, setQueue, region, searching, live } = useApp()
  const navigate = useNavigate()
  const open = live && OPEN_STATUSES.includes(live.status) ? live : null
  const count = searching[game]

  const queue = () => {
    setQueue({ game })
    if (signedIn) navigate('/queue')
    else startQueue()
  }

  return (
    <div className="rift-hub">
      <div className="rift-hub__backdrop" aria-hidden>
        <FacetBackdrop />
      </div>
      <header className="rift-hub__head">
        <p className="rift-hub__kicker">{info.name}</p>
        <h1 className="text-4xl">{info.short} Hub</h1>
      </header>

      <div className="rift-banners">
        <Banner
          tone="queue"
          kicker={signedIn ? `Ranked · ${info.short} · ${region}` : `Ranked · ${info.short}`}
          action={<Btn main size="lg" onClick={queue}>Queue</Btn>}
        >
          {signedIn ? (
            <>
              <strong className="rift-banner__big">{count}</strong>
              <span className="rift-banner__text">{count === 1 ? 'player' : 'players'} searching now</span>
            </>
          ) : (
            <span className="rift-banner__text">Sign in to queue and see who is searching</span>
          )}
        </Banner>

        {open && (
          <Banner
            tone="match"
            kicker={`Open match #${open.id} · ${GAMES[open.game].short}`}
            action={<Link to="/match/live" className="da-btn da-btn--main min-h-11 px-6 py-3 text-sm">Go to match</Link>}
          >
            <strong className="rift-banner__big">{open.score.you}–{open.score.opponent}</strong>
            <span className="rift-banner__text">
              vs {open.opponent.displayName}{'\u00a0·'} <span className="whitespace-nowrap">{open.status === 'reported' ? 'Result reported' : `Game ${open.games.length + 1} next`}</span>
            </span>
          </Banner>
        )}

        <Banner tone="season" kicker="Season status">
          <span className="rift-banner__text">Pre-season: wins still count before Season 1</span>
        </Banner>
      </div>

      <Panel title="Rules">
        <p className="m-0 text-muted">{RULES[game]}</p>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------ Classic */

/** 1d — per-game hub. On mobile the Find match button sticks to the bottom (1f). */
function ClassicHub() {
  const game = useGameParam()
  const info = GAMES[game]
  const { signedIn, startQueue, setQueue, region } = useApp()
  const navigate = useNavigate()
  const top = ladder(game).slice(0, 5)
  const me = playerById('me')!
  const recent = MATCHES.filter((m) => m.game === game)

  const findMatch = () => {
    setQueue({ game })
    if (signedIn) navigate('/queue')
    else startQueue()
  }

  return (
    <div className="flex flex-col gap-4">
      <Art label={`${info.name} banner`} className="h-28" />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <h1 className="text-xl font-semibold">{info.name}</h1>
          <Sub>
            Season {info.season} · {info.seasonDaysLeft} days left · {info.online} online
          </Sub>
        </div>
        <span className="flex-1" />
        <Btn className="hidden md:inline-block" onClick={findMatch}>
          Find match
        </Btn>
      </div>

      <div className="flex gap-3">
        <Stat label="online" value={info.online} />
        <Stat label="searching" value={info.searching} />
        <Stat label={`Season ${info.season} ends`} value={`${info.seasonDaysLeft} days`} />
      </div>

      {signedIn && (
        <Card tone="cosmos">
          <div className="flex items-center gap-2">
            <b>You</b>
            <span className="flex-1" />
            <span className="text-crystal-soft">
              #{me.stats[game].rank} {region} · {me.stats[game].rating}
            </span>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center">
            <b>Ladder · {region}</b>
            <span className="flex-1" />
            <TextLink to={`/${game}/ladder`}>full →</TextLink>
          </div>
          {top.map((p) => (
            <Link key={p.id} to={`/players/${p.id}`} className="flex items-center gap-2 text-sm hover:text-crystal-soft">
              <b className="w-5 text-muted">{p.stats[game].rank}</b>
              <Avatar name={p.name} ring={p.id === 'me' ? 'you' : 'default'} />
              <span>{p.name}</span>
              <span className="flex-1" />
              <span>{p.stats[game].rating}</span>
            </Link>
          ))}
        </Card>
        <Card>
          <b>Recent matches</b>
          {recent.map((m) => {
            const aw = m.games.filter((g) => g.winner === 'A').length
            return (
              <Link key={m.id} to={`/matches/${m.id}`} className="flex items-center gap-2 text-sm hover:text-crystal-soft">
                <Sub className="w-16">
                  {m.mode} Bo{m.bestOf}
                </Sub>
                <span>
                  {m.a.name} {aw}–{m.games.length - aw} {m.b.name}
                </span>
              </Link>
            )
          })}
          {recent.length === 0 && <Sub>No matches yet this season</Sub>}
        </Card>
      </div>

      <Card>
        <b>Rules &amp; ruleset</b>
        <Sub>{RULES[game]}</Sub>
      </Card>

      <div className="fixed inset-x-3 bottom-[max(4rem,calc(var(--rift-phone-bar)+1rem))] z-20 md:hidden">
        <Btn size="lg" className="w-full bg-ink" onClick={findMatch}>
          Find match
        </Btn>
      </div>
    </div>
  )
}
