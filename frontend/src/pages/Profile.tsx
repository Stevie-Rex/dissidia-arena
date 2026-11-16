import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GAMES, MATCHES, playerById, type GameId } from '../data/mock'
import { useApp } from '../state/AppState'
import { Art, Avatar, Btn, Card, CharIcon, Pill, Stat, Sub } from '../components/ui'
import { cx } from '../lib/format'
import { ACCENTS, BANNERS, loadCustom, type BlockId } from './profileCustom'

/** 1s — banner profile with per-game stats. Your own profile uses your saved customisation. */
export default function Profile() {
  const { id = '' } = useParams()
  const { game: currentGame, signedIn, requireSignIn } = useApp()
  const navigate = useNavigate()
  const [game, setGame] = useState<GameId>(currentGame)
  const p = playerById(id)
  if (!p) return <Sub>Player not found.</Sub>
  const isMe = p.id === 'me'
  if (isMe && !signedIn)
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Sub>Sign in to see and customise your profile.</Sub>
        <Btn onClick={() => requireSignIn('Sign in')}>Sign in</Btn>
      </div>
    )
  const custom = isMe
    ? loadCustom()
    : { accent: ACCENTS[0], title: p.title ?? '', bio: p.bio, blocks: ['rank', 'mains', 'history'] as BlockId[], banner: p.id === 'player-b' ? 1 : 0 }
  const s = p.stats[game]
  const history = MATCHES.filter((m) => m.game === game && (m.a.playerId === p.id || m.b.playerId === p.id))

  const blocks: Record<BlockId, ReactNode> = {
    rank: (
      <div className="flex gap-3">
        <Stat label={`S${GAMES[game].season} rank`} value={`#${s.rank} · ${s.rating}`} />
        <Stat label="W–L" value={`${s.wins}–${s.losses}`} />
        <Stat label="best season" value={s.best ?? `#${s.rank} S${GAMES[game].season}`} />
      </div>
    ),
    mains: (
      <Card>
        <b>Featured mains</b>
        <div className="flex gap-2">
          {s.mains.map((c) => (
            <Link key={c} to={`/${game}/characters/${c.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} title={c}>
              <CharIcon name={c} size={40} />
            </Link>
          ))}
        </div>
      </Card>
    ),
    pinned: (
      <Card>
        <b>Pinned match</b>
        {history[0] ? (
          <Link to={`/matches/${history[0].id}`} className="text-sm hover:text-crystal-soft">
            {history[0].a.name} vs {history[0].b.name} · {history[0].date}
          </Link>
        ) : (
          <Sub>No match pinned yet</Sub>
        )}
      </Card>
    ),
    bio: (
      <Card>
        <b>Bio</b>
        <span className="text-sm">{custom.bio || '—'}</span>
      </Card>
    ),
    history: (
      <Card>
        <b>Match history</b>
        {history.length ? (
          history.map((m) => {
            const isA = m.a.playerId === p.id
            const won = m.games.filter((g) => g.winner === (isA ? 'A' : 'B')).length > m.games.length / 2
            return (
              <Link key={m.id} to={`/matches/${m.id}`} className="flex items-center gap-2 text-sm hover:text-crystal-soft">
                <b className={won ? 'text-crystal-soft' : 'text-chaos-soft'}>{won ? 'W' : 'L'}</b>
                vs {isA ? m.b.name : m.a.name}
                <span className="flex-1" />
                <Sub>{m.date}</Sub>
              </Link>
            )
          })
        ) : (
          <Sub>No ranked matches in {GAMES[game].short} yet</Sub>
        )}
      </Card>
    ),
  }

  return (
    <div className="flex flex-col gap-4">
      <Art label={BANNERS[custom.banner]} className="h-28" />
      <div className="-mt-12 flex items-end gap-3 pl-3">
        <span className="rounded-full border-[3px] bg-ink" style={{ borderColor: custom.accent }}>
          <Avatar name={p.name} size={64} className="border-0" />
        </span>
        <div className="flex flex-col">
          <span className="text-xl font-semibold">{p.name}</span>
          <Sub>
            {custom.title && <span className="text-gold-soft">{custom.title} · </span>}
            {p.region} · Discord: {p.discord}
            {custom.bio && ` · "${custom.bio}"`}
          </Sub>
        </div>
        <span className="flex-1" />
        {isMe && <Pill onClick={() => navigate('/players/me/edit')}>Edit profile</Pill>}
      </div>
      <div className="flex gap-2">
        {(['nt', '012'] as GameId[]).map((g) => (
          <Pill key={g} active={g === game} onClick={() => setGame(g)}>
            {GAMES[g].short}
          </Pill>
        ))}
      </div>
      <div className={cx('grid gap-3', 'md:grid-cols-2')}>
        {custom.blocks.map((b) => (
          <div key={b} className={b === 'rank' ? 'md:col-span-2' : ''}>
            {blocks[b]}
          </div>
        ))}
      </div>
    </div>
  )
}
