import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FacetBackdrop } from '../components/rift/FacetBackdrop'
import { useAppearance } from '../state/Appearance'
import { GAMES, REGIONS, type GameId, type Region } from '../data/mock'
import { useApp } from '../state/AppState'
import { Avatar, Btn, Card, Pill, Sub } from '../components/ui'
import '../theme/css/rift-landing.css'

/** 1b — first-time setup after Discord returns. */
export default function Welcome() {
  const app = useApp()
  const { ui } = useAppearance()
  const rift = ui === 'rift'
  const navigate = useNavigate()
  const [games, setGames] = useState<GameId[]>(app.myGames)
  const [region, setRegion] = useState<Region>(app.region)
  const [ids, setIds] = useState<Partial<Record<GameId, string>>>(app.ids)

  const toggle = (g: GameId) => setGames((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (app.user === undefined) return null
  if (app.user === null) return <Navigate to="/" replace />

  const done = async () => {
    setSaving(true)
    setError(null)
    try {
      await app.finishOnboarding({ games: games.length ? games : ['nt'], region, ids })
      navigate(`/${games.length === 1 ? games[0] : app.game}`)
    } catch {
      setError("Couldn't save. Check your IDs and try again.")
      setSaving(false)
    }
  }

  return (
    <div className={rift ? 'rift-welcome' : 'mx-auto flex max-w-lg flex-col gap-4'}>
      {rift && <FacetBackdrop />}
      <div className={rift ? 'rift-landing-glass rift-welcome__intro' : 'flex items-center gap-3'}>
        <Avatar name={app.user.displayName} src={app.user.avatarUrl} size={44} ring="you" />
        <div className="flex flex-col">
          {rift ? (
            <>
              <h1>Welcome, {app.user.displayName}</h1>
              <p>Set up your games, region and in-game IDs before you queue.</p>
            </>
          ) : (
            <>
              <span className="text-xl font-semibold">Welcome, {app.user.displayName}</span>
              <Sub>2 quick things before you play</Sub>
            </>
          )}
        </div>
      </div>

      <Card className={rift ? 'rift-landing-glass' : undefined}>
        <Sub>Which games do you play?</Sub>
        <div className="flex flex-wrap gap-2">
          {(['012', 'nt'] as GameId[]).map((g) => (
            <Pill key={g} active={games.includes(g)} onClick={() => toggle(g)}>
              {g === '012' ? 'Dissidia 012' : 'Dissidia NT'}
            </Pill>
          ))}
        </div>
      </Card>

      <Card className={rift ? 'rift-landing-glass' : undefined}>
        <Sub>{rift ? 'Region' : 'Region (sets queue + ladder)'}</Sub>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <Pill key={r} active={region === r} onClick={() => setRegion(r)}>
              {r}
            </Pill>
          ))}
        </div>
      </Card>

      <Card className={rift ? 'rift-landing-glass' : undefined}>
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
                maxLength={64}
                className="min-w-0 flex-1 rounded-md border-[1.5px] border-line-strong bg-panel px-2 py-1.5 text-sm placeholder:text-muted focus:border-crystal focus:outline-none"
              />
            </label>
          ))}
      </Card>

      <div className="flex flex-wrap items-center gap-y-2">
        <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => navigate('/')}>
          Skip for now
        </button>
        <span className="flex-1" />
        {error && <span role="alert" className="mr-3 text-xs text-chaos-soft">{error}</span>}
        <Btn disabled={saving} onClick={done}>
          {saving ? 'Saving…' : 'Done'}
        </Btn>
      </div>
    </div>
  )
}
