import { Link, useNavigate } from 'react-router-dom'
import { GAMES, playerById, type GameId } from '../data/mock'
import { useApp } from '../state/AppState'
import { Art, Btn, Card, DiscordButton, Note, Pill, Sub } from '../components/ui'

/** 1e — two-game front door; 1c hero when signed out. */
export default function Home() {
  const { signedIn, signIn, setGame, startQueue, setQueue } = useApp()
  const navigate = useNavigate()
  const me = playerById('me')!

  const queueFor = (g: GameId) => {
    setQueue({ game: g })
    if (signedIn) navigate('/queue')
    else startQueue()
  }

  return (
    <div className="flex flex-col gap-6">
      {!signedIn && (
        <section className="grid items-center gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold leading-tight">Ranked Dissidia, matched for you</h1>
            <p className="text-soft">Queue up, get an opponent, play in-game, report the result. Seasons, regions, brackets and a Discord bot included.</p>
            <div className="flex flex-wrap items-center gap-3">
              <DiscordButton onClick={signIn} />
              <Link to="/nt/ladder" className="text-sm text-gold-note hover:text-crystal-soft">
                or browse ladders →
              </Link>
            </div>
          </div>
          <Art label="key art (012 + NT)" className="h-44" />
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {(['012', 'nt'] as GameId[]).map((g) => {
          const info = GAMES[g]
          return (
            <Card key={g}>
              <Link to={`/${g}`} onClick={() => setGame(g)}>
                <Art label={`${info.short} cover`} className="h-28 transition-colors hover:border-crystal" />
              </Link>
              <Link to={`/${g}`} onClick={() => setGame(g)} className="font-semibold hover:text-crystal-soft">
                {info.name}
              </Link>
              <Sub>
                {info.platform} · {info.online} online
              </Sub>
              <Sub>Formats: {info.formats}</Sub>
              <div className="flex items-center">
                <Link to={`/${g}/ladder`} onClick={() => setGame(g)}>
                  <Pill>Ladder</Pill>
                </Link>
                <span className="flex-1" />
                <Btn onClick={() => queueFor(g)}>Queue</Btn>
              </div>
            </Card>
          )
        })}
      </section>

      {signedIn && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <b>Your seasons</b>
            <span className="flex-1" />
            <Sub>
              012 #{me.stats['012'].rank} NA · NT #{me.stats.nt.rank} NA
            </Sub>
          </div>
        </Card>
      )}
      <Note>Clicking a cover opens that game's hub</Note>
    </div>
  )
}
