import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAMES, REGIONS, type GameId, type Region } from '../data/mock'
import { useApp } from '../state/AppState'
import { Avatar, Btn, Card, Pill, Sub } from '../components/ui'

/** 1b — first-time setup after Discord returns. */
export default function Welcome() {
  const app = useApp()
  const navigate = useNavigate()
  const [games, setGames] = useState<GameId[]>(app.myGames)
  const [region, setRegion] = useState<Region>(app.region)
  const [ids, setIds] = useState<Partial<Record<GameId, string>>>(app.ids)

  const toggle = (g: GameId) => setGames((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]))
  const done = () => {
    app.finishOnboarding({ games: games.length ? games : ['nt'], region, ids })
    navigate(`/${games.length === 1 ? games[0] : app.game}`)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name="discorduser" size={44} ring="you" />
        <div className="flex flex-col">
          <span className="text-xl font-semibold">Welcome, discorduser</span>
          <Sub>2 quick things before you play</Sub>
        </div>
      </div>

      <Card>
        <Sub>Which games do you play?</Sub>
        <div className="flex flex-wrap gap-2">
          {(['012', 'nt'] as GameId[]).map((g) => (
            <Pill key={g} active={games.includes(g)} onClick={() => toggle(g)}>
              {g === '012' ? 'Dissidia 012' : 'Dissidia NT'}
            </Pill>
          ))}
        </div>
      </Card>

      <Card>
        <Sub>Region (sets queue + ladder)</Sub>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <Pill key={r} active={region === r} onClick={() => setRegion(r)}>
              {r}
            </Pill>
          ))}
        </div>
      </Card>

      <Card>
        <Sub>In-game IDs</Sub>
        {(['nt', '012'] as GameId[])
          .filter((g) => games.includes(g))
          .map((g) => (
            <label key={g} className="flex items-center gap-3">
              <span className="w-12 text-xs text-muted">{GAMES[g].short}</span>
              <input
                value={ids[g] ?? ''}
                onChange={(e) => setIds((x) => ({ ...x, [g]: e.target.value }))}
                placeholder={GAMES[g].idLabel}
                className="flex-1 rounded-md border-[1.5px] border-line-strong bg-panel px-2 py-1.5 text-sm placeholder:text-muted focus:border-crystal focus:outline-none"
              />
            </label>
          ))}
      </Card>

      <div className="flex items-center">
        <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => navigate('/')}>
          Skip for now
        </button>
        <span className="flex-1" />
        <Btn onClick={done}>Done</Btn>
      </div>
    </div>
  )
}
