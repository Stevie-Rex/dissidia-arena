import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GAMES, matchById, type Match } from '../data/mock'
import { Avatar, Card, CharIcon, Note, Pill, Sub } from '../components/ui'
import { Panel } from '../components/rift/menus'
import { useAppearance } from '../state/Appearance'
import { cx } from '../lib/format'

/** 1m scoreboard + per-game table (1v1), 1n team view with game toggle (3v3). */
export default function MatchDetails() {
  const { ui } = useAppearance()
  const { id = '' } = useParams()
  const m = matchById(id)
  if (!m) return <Sub>Match not found.</Sub>
  const info = GAMES[m.game]
  const aw = m.games.filter((g) => g.winner === 'A').length
  const bw = m.games.length - aw

  return (
    <div className="flex flex-col gap-4">
      {ui === 'rift' && <h1 className="m-0 text-4xl">Match details</h1>}
      <Sub>
        {info.name} · Ranked {m.mode} · Bo{m.bestOf} · {m.date} · {m.region}
      </Sub>
      <Panel title="Result">
        <div className="rift-detail-scoreboard flex items-center gap-3">
          <Side side={m.a} align="left" />
          <span className="flex-1" />
          <span className="rift-detail-score text-3xl font-semibold">
            {aw} – {bw}
          </span>
          <span className="flex-1" />
          <Side side={m.b} align="right" />
        </div>
      </Panel>
      {ui === 'rift' ? (
        <Panel title="Games">{m.mode === '3v3' ? <TeamView m={m} /> : <GameTable m={m} />}</Panel>
      ) : m.mode === '3v3' ? <TeamView m={m} /> : <GameTable m={m} />}
      <button type="button" className="self-start text-xs text-muted hover:text-chaos-soft">
        Dispute result
      </button>
    </div>
  )
}

function Side({ side, align }: { side: Match['a']; align: 'left' | 'right' }) {
  const delta = side.after - side.before
  const name = side.playerId ? (
    <Link to={`/players/${side.playerId}`} className="font-semibold hover:text-crystal-soft">
      {side.name}
    </Link>
  ) : (
    <b>{side.name}</b>
  )
  return (
    <div className={cx('flex items-center gap-2', align === 'right' && 'flex-row-reverse text-right')}>
      <Avatar name={side.name} size={40} />
      <div className="flex flex-col">
        {name}
        <Sub>
          {side.before} → {side.after}{' '}
          <span className={delta >= 0 ? 'text-crystal-soft' : 'text-chaos-soft'}>
            ({delta >= 0 ? '+' : '−'}
            {Math.abs(delta)})
          </span>
        </Sub>
      </div>
    </div>
  )
}

function GameTable({ m }: { m: Match }) {
  const helper = GAMES[m.game].helperLabel.toLowerCase()
  return (
    <div className="overflow-x-auto">
      <table className="rift-detail-games w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="w-8 py-1 font-normal">Game</th>
            <th className="py-1 font-normal">A · Character / {helper}</th>
            <th className="py-1 font-normal">B · Character / {helper}</th>
            <th className="py-1 font-normal">Stage</th>
            <th className="w-10 py-1 font-normal">Winner</th>
          </tr>
        </thead>
        <tbody>
          {m.games.map((g) => (
            <tr key={g.n} className="border-b border-line/50">
              <td className="py-1.5">{g.n}</td>
              <td className={cx('py-1.5', g.winner === 'A' && 'text-crystal-soft')}>
                {g.a.char} / {g.a.helper}
              </td>
              <td className={cx('py-1.5', g.winner === 'B' && 'text-crystal-soft')}>
                {g.b.char} / {g.b.helper}
              </td>
              <td className="py-1.5">{g.stage}</td>
              <td className="py-1.5">{g.winner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamView({ m }: { m: Match }) {
  const [sel, setSel] = useState(0)
  const g = m.games[sel]
  const team = (side: 'a' | 'b') => {
    const chars = g[side].char.split('|')
    const players = m[side].team ?? []
    return (
      <Card tone={side === 'a' ? 'cosmos' : 'chaos'} className="flex-1">
        <b className={side === 'a' ? 'text-crystal-soft' : 'text-chaos-soft'}>{m[side].name}</b>
        {chars.map((c, i) => (
          <div key={c} className="flex items-center gap-2 text-sm">
            <CharIcon name={c} size={30} />
            {players[i]} · {c}
          </div>
        ))}
        <Sub>Summon: {g[side].helper}</Sub>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {m.games.map((x, i) => (
          <Pill key={x.n} active={i === sel} onClick={() => setSel(i)}>
            Game {x.n} · {x.winner}
          </Pill>
        ))}
        <span className="flex-1" />
        <Sub>Stage: {g.stage}</Sub>
      </div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row">
        {team('a')}
        <div className="flex flex-col items-center justify-center">
          <Sub>winner</Sub>
          <b>{g.winner}</b>
        </div>
        {team('b')}
      </div>
      <Note>NT has summons, not assists</Note>
    </div>
  )
}
