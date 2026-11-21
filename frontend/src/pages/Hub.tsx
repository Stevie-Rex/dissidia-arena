import { Link, useNavigate } from 'react-router-dom'
import { GAMES, MATCHES, ladder, playerById } from '../data/mock'
import { useApp } from '../state/AppState'
import { useGameParam } from '../useGameParam'
import { Art, Avatar, Btn, Card, Stat, Sub, TextLink } from '../components/ui'

/** 1d — per-game hub. On mobile the Find match button sticks to the bottom (1f). */
export default function Hub() {
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
        <Sub>
          {game === 'nt'
            ? 'Latest patch · stage list: Kefka\'s Tower, Pandaemonium, Orphan\'s Cradle, Midgar · disconnect = replay the game once, then forfeit'
            : 'PPSSPP 1.17+ · banned stages: none · no EX mode restrictions · disconnect = replay the game once, then forfeit'}
        </Sub>
      </Card>

      <div className="fixed inset-x-3 bottom-16 z-20 md:hidden">
        <Btn size="lg" className="w-full bg-ink" onClick={findMatch}>
          Find match
        </Btn>
      </div>
    </div>
  )
}
