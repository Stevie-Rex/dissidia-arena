import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BRACKET, GAMES, REGIONS, TOURNAMENTS, type BracketSet, type GameId, type Region } from '../data/mock'
import { useApp } from '../state/AppState'
import { Avatar, Btn, Card, Gem, Note, PageTitle, Pill, Select, Sub } from '../components/ui'
import { cx, fmtTime } from '../lib/format'

/** 2d — tournament list, weeklies + majors. */
export function Tournaments() {
  const { requireSignIn, region: myRegion } = useApp()
  const [filter, setFilter] = useState<'all' | GameId>('all')
  const [region, setRegion] = useState<Region>(myRegion)
  const [joined, setJoined] = useState<string[]>([])
  const [checkInLeft, setCheckInLeft] = useState(14 * 60)
  useEffect(() => {
    const t = setInterval(() => setCheckInLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const join = (id: string) => {
    if (requireSignIn('Sign in to register')) setJoined((j) => [...j, id])
  }
  const list = TOURNAMENTS.filter((t) => t.status !== 'done' && (filter === 'all' || t.game === filter))
  const past = TOURNAMENTS.filter((t) => t.status === 'done')

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill active={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </Pill>
            {(['012', 'nt'] as GameId[]).map((g) => (
              <Pill key={g} active={filter === g} onClick={() => setFilter(g)}>
                {GAMES[g].short}
              </Pill>
            ))}
            <Select label="Region" value={region} onChange={(v) => setRegion(v as Region)} options={REGIONS.map((r) => ({ value: r, label: r }))} />
          </div>
        }
      >
        Tournaments
      </PageTitle>

      {list.map((t) => {
        const isJoined = joined.includes(t.id)
        const checkIn = t.status === 'check-in'
        return (
          <Card key={t.id} tone={checkIn ? 'cosmos' : 'default'}>
            <div className="flex flex-wrap items-center gap-2">
              {checkIn && <span className="h-2 w-2 rounded-full bg-violet" />}
              <Link to={`/tournaments/${t.id}`} className="font-semibold hover:text-crystal-soft">
                {t.name} · {GAMES[t.game].short} {t.mode}
              </Link>
              <span className="flex-1" />
              {checkIn ? <span className="text-gold-soft">check-in open</span> : <Sub>{t.when}</Sub>}
            </div>
            <Sub>
              {checkIn && `${t.when} · `}
              {t.format} · {t.registered + (isJoined ? 1 : 0)}
              {t.cap ? ` / ${t.cap}` : t.mode === '3v3' ? ' teams' : ' registered'}
            </Sub>
            <div className="flex items-center gap-2">
              {checkIn ? (
                <>
                  <Btn disabled={isJoined} onClick={() => join(t.id)}>
                    {isJoined ? 'Checked in ✓' : 'Check in'}
                  </Btn>
                  <Sub>closes in {fmtTime(checkInLeft)}</Sub>
                </>
              ) : (
                <Pill active={isJoined} onClick={() => !isJoined && join(t.id)}>
                  {isJoined ? 'Registered ✓' : t.mode === '3v3' ? 'Register team' : 'Register'}
                </Pill>
              )}
              <span className="flex-1" />
              <Link to={`/tournaments/${t.id}`} className="text-xs text-gold-note hover:text-crystal-soft">
                bracket →
              </Link>
            </div>
          </Card>
        )
      })}

      <Card>
        <b>Past results</b>
        {past.map((t) => (
          <Link key={t.id} to={`/tournaments/${t.id}`} className="flex text-sm hover:text-crystal-soft">
            {t.name}
            <span className="flex-1" />
            <Sub>{t.when} · winner Player A</Sub>
          </Link>
        ))}
      </Card>
    </div>
  )
}

/** 2e bracket view with your path highlighted; 2f "your next set" card leads on mobile. */
export function Bracket() {
  const { id = '' } = useParams()
  const t = TOURNAMENTS.find((x) => x.id === id) ?? TOURNAMENTS[0]
  const [side, setSide] = useState<'winners' | 'losers' | 'standings'>('winners')
  const [ready, setReady] = useState(false)
  const [forfeit, setForfeit] = useState(9 * 60 + 30)
  useEffect(() => {
    if (ready) return
    const tm = setInterval(() => setForfeit((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(tm)
  }, [ready])

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        right={
          <div className="flex gap-1.5">
            <Pill active={side === 'winners'} onClick={() => setSide('winners')}>
              Winners
            </Pill>
            <Pill active={side === 'losers'} onClick={() => setSide('losers')}>
              Losers
            </Pill>
            <Pill active={side === 'standings'} onClick={() => setSide('standings')}>
              Standings
            </Pill>
          </div>
        }
      >
        {t.name}
      </PageTitle>
      <Sub>
        {GAMES[t.game].name} {t.mode} · {t.format}
      </Sub>

      <Card tone="cosmos" className="items-center text-center md:flex-row md:text-left">
        <div className="flex flex-col">
          <Sub>your next set · winners R2</Sub>
          <span>
            <span className="text-crystal-soft">You</span> vs <span className="text-chaos-soft">Player I</span>
          </span>
        </div>
        <div className="flex items-center gap-2 md:ml-4">
          <Avatar name="You" ring="crystal" />
          <Gem />
          <Avatar name="Player I" ring="chaos" />
        </div>
        <span className="hidden flex-1 md:block" />
        <Btn className="w-full md:w-auto" disabled={ready} onClick={() => setReady(true)}>
          {ready ? 'Ready ✓ waiting for Player I' : "I'm ready"}
        </Btn>
        {!ready && <Sub>auto-forfeit in {fmtTime(forfeit)}</Sub>}
      </Card>

      {side === 'standings' ? (
        <Card>
          {['You', 'Player I', 'Player K', 'Player N', 'Player H', 'Player J', 'Player L', 'Player M'].map((n, i) => (
            <div key={n} className={cx('flex gap-3 text-sm', n === 'You' && 'text-crystal-soft')}>
              <b className="w-6 text-muted">{i < 4 ? '—' : `${5 + Math.floor((i - 4) / 2) * 2}`}</b>
              {n}
              <span className="flex-1" />
              <Sub>{i < 4 ? 'still in' : 'out'}</Sub>
            </div>
          ))}
        </Card>
      ) : side === 'losers' ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          <Round title="Losers R1" sets={[{ a: 'Player H', b: 'Player J' }, { a: 'Player L', b: 'Player M' }]} />
          <Round title="Losers R2" sets={[{ a: 'TBD', b: 'TBD' }]} />
        </div>
      ) : (
        <div className="flex items-center gap-6 overflow-x-auto pb-2">
          {BRACKET.map((r) => (
            <Round key={r.round} title={r.round} sets={r.sets} />
          ))}
          <div className="flex flex-col items-center gap-2">
            <Sub>Champion</Sub>
            <Gem size={18} gold />
          </div>
        </div>
      )}
      <Note>Click any finished set to open its match details</Note>
    </div>
  )
}

function Round({ title, sets }: { title: string; sets: BracketSet[] }) {
  return (
    <div className="flex w-36 flex-none flex-col justify-around gap-3 self-stretch">
      <Sub>{title}</Sub>
      {sets.map((s, i) => {
        const mine = s.a === 'You' || s.b === 'You'
        const tbd = s.a === 'TBD'
        const done = s.sa !== undefined
        const row = (name: string, score?: number, other?: number) => (
          <span
            className={cx(
              'flex text-sm',
              name === 'You' ? 'text-crystal-soft' : s.next ? 'text-chaos-soft' : done && score! < other! ? 'text-muted' : '',
            )}
          >
            {name}
            <span className="flex-1" />
            {score}
          </span>
        )
        const body = (
          <Card tone={mine ? 'cosmos' : tbd ? 'dashed' : 'default'} className="gap-0.5 p-1.5">
            {row(s.a, s.sa, s.sb)}
            {row(s.b, s.sb, s.sa)}
            {s.next && <span className="text-[10px] text-gold-soft">● next · on stream?</span>}
          </Card>
        )
        return done ? (
          <Link key={i} to="/matches/m-1003" className="hover:opacity-80">
            {body}
          </Link>
        ) : (
          <div key={i}>{body}</div>
        )
      })}
    </div>
  )
}
