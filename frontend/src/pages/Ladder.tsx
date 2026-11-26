import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GAMES, REGIONS, ladder, type Region } from '../data/mock'
import { useApp } from '../state/AppState'
import { useGameParam } from '../useGameParam'
import { Avatar, Card, Note, PageTitle, Pill, Select, Sub } from '../components/ui'
import { Panel } from '../components/rift/menus'
import { useAppearance } from '../state/Appearance'
import { cx } from '../lib/format'

export default function Ladder() {
  const game = useGameParam()
  const { ui } = useAppearance()
  if (ui === 'classic') return <ClassicLadder />
  return (
    <div className="flex flex-col gap-5">
      <h1 className="m-0 text-4xl">{GAMES[game].short} Ladder</h1>
      <Panel title="Pre-season">
        <p className="m-0 text-muted">Ratings start with Season 1. Ranked wins already count towards unlocks.</p>
        <Link to="/rewards" className="da-btn da-btn--ghost self-start">View rewards</Link>
      </Panel>
    </div>
  )
}

function ClassicLadder() {
  const game = useGameParam()
  const info = GAMES[game]
  const { region: myRegion, signedIn } = useApp()
  const navigate = useNavigate()
  const [region, setRegion] = useState<Region | 'Global'>(myRegion)
  const [season, setSeason] = useState(info.season)
  const [mode, setMode] = useState<'1v1' | '3v3'>('1v1')
  const [q, setQ] = useState('')

  const rows = ladder(game)
  const filtered = rows.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
  const top3 = rows.slice(0, 3)
  const me = rows.find((p) => p.id === 'me')!
  const live = season === info.season

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        right={
          <Select
            label="Season"
            value={String(season)}
            onChange={(v) => setSeason(Number(v))}
            options={[info.season, info.season - 1, info.season - 2].map((s) => ({
              value: String(s),
              label: `Season ${s}${s === info.season ? ' · live' : ''}`,
            }))}
          />
        }
      >
        {info.short} Ladder
      </PageTitle>

      <div className="flex flex-wrap items-center gap-2 border-b-[1.5px] border-line pb-2">
        {(['Global', ...REGIONS] as const).map((r) => (
          <Pill key={r} active={region === r} onClick={() => setRegion(r)}>
            {r}
          </Pill>
        ))}
        <span className="flex-1" />
        {info.modes.length > 1 &&
          info.modes.map((m) => (
            <Pill key={m} active={mode === m} onClick={() => setMode(m)}>
              {m}
            </Pill>
          ))}
      </div>

      {!live && <Note>Season {season} is over. Final standings are frozen.</Note>}

      {/* podium */}
      <div className="flex items-end justify-center gap-3">
        {[top3[1], top3[0], top3[2]].map((p, i) => (
          <Link key={p.id} to={`/players/${p.id}`}>
            <Card tone={i === 1 ? 'gold' : 'default'} className={cx('w-28 items-center', i === 1 && 'pb-6')}>
              <Avatar name={p.name} size={i === 1 ? 36 : 26} ring={i === 1 ? 'you' : 'default'} />
              <b>#{p.stats[game].rank}</b>
              <Sub>
                {p.name} · {p.stats[game].rating}
              </Sub>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search player"
          className="w-48 rounded-full border-[1.5px] border-line-strong bg-card px-3 py-1 text-xs placeholder:text-muted focus:border-crystal focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="w-10 py-1 font-normal">#</th>
              <th className="py-1 font-normal">Player</th>
              <th className="hidden py-1 font-normal sm:table-cell">Main</th>
              <th className="py-1 text-right font-normal">Rating</th>
              <th className="py-1 text-right font-normal">W–L</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const s = p.stats[game]
              const isMe = p.id === 'me'
              return (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/players/${p.id}`)}
                  className={cx(
                    'cursor-pointer border-b border-line/50 hover:bg-white/[.03]',
                    isMe && 'text-crystal-soft',
                  )}
                >
                  <td className="py-1.5">{s.rank}</td>
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <Avatar name={p.name} ring={isMe ? 'you' : 'default'} />
                      {p.name}
                    </span>
                  </td>
                  <td className="hidden py-1.5 sm:table-cell">{s.main}</td>
                  <td className="py-1.5 text-right">{s.rating}</td>
                  <td className="py-1.5 text-right">
                    {s.wins}–{s.losses}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {signedIn && (
        <Link to="/players/me" className="sticky bottom-16 md:bottom-4">
          <Card tone="gold" className="flex-row items-center bg-panel text-crystal-soft">
            <b>#{me.stats[game].rank}</b>
            <span>You</span>
            <span className="hidden sm:inline">· {me.stats[game].main}</span>
            <span className="flex-1" />
            <span>{me.stats[game].rating}</span>
            <span className="text-muted">
              {me.stats[game].wins}–{me.stats[game].losses}
            </span>
          </Card>
        </Link>
      )}
    </div>
  )
}
