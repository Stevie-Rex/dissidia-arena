import { Link, useNavigate } from 'react-router-dom'
import ConfigWindow from '../components/appearance/ConfigWindow'
import { upcomingRewards } from '../components/appearance/copy'
import { RewardRows } from '../components/appearance/RewardCards'
import { FacetBackdrop } from '../components/rift/FacetBackdrop'
import HomeHeroArt from '../components/rift/HomeHeroArt'
import { Btn, SideGlyph } from '../components/ui'
import { GAMES, type GameId } from '../data/mock'
import { useApp } from '../state/AppState'
import { useAppearance } from '../state/Appearance'
import '../theme/css/rift-landing.css'

/** Ranked record as Cosmos (wins) vs Chaos (losses), until seasons give the gauge a real war to show. */
function useCycle() {
  const { appearance } = useAppearance()
  const { ranked_wins: w, ranked_losses: l } = appearance
  const total = w + l
  const cosmos = total ? Math.round((w / total) * 100) : 50
  return { cosmos, chaos: 100 - cosmos, total, wins: w, losses: l }
}

function useTrials() {
  const { signedIn, setGame, setQueue, startQueue } = useApp()
  const navigate = useNavigate()
  const queueFor = (g: GameId) => {
    setGame(g)
    setQueue({ game: g })
    if (signedIn) navigate('/queue')
    else startQueue()
  }
  return [
    { numeral: 'I', title: `${GAMES['012'].short} Ranked`, text: `1 v 1 · Bo3 · ${GAMES['012'].platform}`, onClick: () => queueFor('012') },
    { numeral: 'II', title: `${GAMES.nt.short} Ranked`, text: '1 v 1 · Bo3 · PS4 or PC', onClick: () => queueFor('nt') },
    { numeral: 'III', title: 'Tournaments', text: 'Brackets and check-ins', to: '/tournaments' },
    { numeral: 'IV', title: 'Party', text: 'Group up with friends', to: '/party' },
  ]
}

/* ------------------------------------------------------------------ Rift */

function RiftHome() {
  const { game, live, pending, phase, searching, signedIn, startQueue } = useApp()
  const navigate = useNavigate()
  const { total, wins, losses } = useCycle()
  const queue = () => (signedIn ? navigate('/queue') : startQueue())
  const match = phase === 'match' ? live : pending

  return (
    <div className="rift-home">
      <FacetBackdrop />
      <section className="rift-hero" aria-labelledby="rift-home-title">
        <div className="rift-hero__slot" aria-hidden>
          <HomeHeroArt />
        </div>
        <div className="rift-hero__copy rift-landing-glass">
          <p className="rift-landing-label">The Rift is open</p>
          <h1 id="rift-home-title">Dissidia Arena</h1>
          <p>Ranked 1v1 for Dissidia 012 and NT. Queue up and fight a best-of-three.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Btn main={!match} size="lg" onClick={queue}>Queue</Btn>
            <Link to={`/${game}`} className="underline underline-offset-4">Read the rules</Link>
          </div>
        </div>
      </section>

      <div className="rift-home__panels">
        <div className="rift-home__cards">
          <section className="rift-landing-glass" aria-labelledby="rift-search-title">
            <h2 id="rift-search-title" className="rift-landing-label">Searching now · {GAMES[game].short}</h2>
            <strong className="rift-home__stat">{searching[game]}</strong>
            <Btn main onClick={queue}>Queue</Btn>
          </section>
          {match && (
            <section className="rift-landing-glass" aria-labelledby="rift-match-title">
              <h2 id="rift-match-title" className="rift-landing-label">Your match</h2>
              <strong className="rift-home__stat">{match.score.you}–{match.score.opponent}</strong>
              <p>vs {match.opponent.displayName}</p>
              <Link to={phase === 'found' ? '/queue' : '/match/live'} className="da-btn da-btn--main px-3 py-1 text-xs">Go to match</Link>
            </section>
          )}
          <section className="rift-landing-glass" aria-labelledby="rift-season-title">
            <h2 id="rift-season-title" className="rift-landing-label">Pre-season</h2>
            <p>Wins still count before Season 1.</p>
          </section>
        </div>
        {signedIn && (
          <section className="rift-landing-glass" aria-labelledby="rift-battles-title">
            <h2 id="rift-battles-title" className="rift-landing-label">Recent battles</h2>
            {total ? (
              <>
                <p>{total} ranked {total === 1 ? 'battle' : 'battles'}: {wins} won, {losses} lost.</p>
                <Link to="/players/me" className="underline underline-offset-4">See your profile</Link>
              </>
            ) : (
              <>
                <p>No battles fought yet. The Rift is waiting.</p>
                <Btn onClick={queue}>Queue</Btn>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Classic */

function ClassicHome() {
  const trials = useTrials()
  const cycle = useCycle()
  const { appearance } = useAppearance()
  const tile = 'flex flex-col gap-1.5 rounded border border-[var(--win-inner)] px-4 py-4 text-left hover:bg-[var(--win-sel)]'
  return (
    <div className="grid grid-cols-1 gap-4">
      <h1 className="sr-only">Dissidia Arena</h1>
      <section aria-labelledby="cw-battle" className="da-window px-6 pb-6 pt-5">
        <h2 id="cw-battle" className="da-window__title">
          BATTLE
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          {trials.map((t) => {
            const body = (
              <>
                <span className="text-[length:var(--menu-big)]">{t.title}</span>
                <span className="text-[length:var(--menu-small)] text-[var(--win-muted)]">{t.text}</span>
              </>
            )
            return t.to ? (
              <Link key={t.numeral} to={t.to} className={tile}>
                {body}
              </Link>
            ) : (
              <button key={t.numeral} type="button" onClick={t.onClick} className={tile}>
                {body}
              </button>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="cw-war" className="da-window px-6 pb-6 pt-5">
        <h2 id="cw-war" className="da-window__title">
          CYCLE OF WAR
        </h2>
        <div className="mb-2 flex justify-between text-[length:var(--menu-body)]">
          <span data-side="cosmos" className="flex items-center gap-1.5 text-[var(--side)]">
            <SideGlyph side="cosmos" /> Cosmos {cycle.cosmos}%
          </span>
          <span data-side="chaos" className="flex items-center gap-1.5 text-[var(--side)]">
            {cycle.chaos}% Chaos <SideGlyph side="chaos" />
          </span>
        </div>
        <div role="img" aria-label={`Cosmos ${cycle.cosmos} percent, Chaos ${cycle.chaos} percent`} className="flex h-3 overflow-hidden rounded-sm bg-[var(--win-track)]">
          <div className="bg-[var(--win-cosmos)]" style={{ width: `${cycle.cosmos}%` }} />
          <div className="bg-[var(--win-chaos)]" style={{ width: `${cycle.chaos}%` }} />
        </div>
        <p className="m-0 mt-2 text-[length:var(--menu-small)] text-[var(--win-muted)]">
          {cycle.wins} won · {cycle.losses} lost in ranked
        </p>
      </section>

      <section aria-labelledby="cw-rewards" className="da-window px-6 pb-6 pt-5">
        <h2 id="cw-rewards" className="da-window__title">
          NEXT REWARDS
        </h2>
        <RewardRows rewards={upcomingRewards(appearance.rewards, 2)} wins={appearance.ranked_wins} />
      </section>

      <ConfigWindow />
    </div>
  )
}

export default function Home() {
  const { ui } = useAppearance()
  return ui === 'classic' ? <ClassicHome /> : <RiftHome />
}
