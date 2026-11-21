import { Link, useNavigate } from 'react-router-dom'
import ConfigWindow from '../components/appearance/ConfigWindow'
import { upcomingRewards } from '../components/appearance/copy'
import RewardCards, { RewardRows } from '../components/appearance/RewardCards'
import WorldsPicker from '../components/appearance/WorldsPicker'
import { SideGlyph } from '../components/ui'
import { GAMES, type GameId } from '../data/mock'
import { useApp } from '../state/AppState'
import { useAppearance } from '../state/Appearance'

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

function Hero() {
  const { signedIn, startQueue } = useApp()
  const navigate = useNavigate()
  const fight = () => (signedIn ? navigate('/queue') : startQueue())
  return (
    <section aria-label="Choose your side" className="relative overflow-hidden bg-[var(--rift-cosmos-bg)]">
      <div aria-hidden className="da-rift-chaos absolute inset-0 bg-[var(--rift-chaos-bg)]" />
      <svg aria-hidden viewBox="0 0 400 260" fill="none" className="absolute left-[4%] top-[72px] h-[44%] w-[34%] opacity-85">
        <g style={{ stroke: 'var(--rift-cosmos-line)', fill: 'var(--rift-cosmos-line)' }}>
          <path d="M30 200 L95 140 L160 168 L230 92 L300 120 L360 40 M95 140 L120 60 L230 92 M160 168 L190 230 M230 78 V106 M216 92 H244" fill="none" strokeWidth="1" />
          {[[30, 200, 3], [95, 140, 4], [160, 168, 3], [230, 92, 5], [300, 120, 3], [360, 40, 4], [120, 60, 3], [190, 230, 2.5]].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} stroke="none" />
          ))}
        </g>
      </svg>
      <svg aria-hidden viewBox="0 0 400 260" fill="none" className="absolute right-[4%] top-[72px] h-[44%] w-[34%] opacity-70">
        <g style={{ stroke: 'var(--rift-chaos-line)', fill: 'var(--rift-chaos-line)' }}>
          <path d="M380 20 L320 70 L340 110 L270 150 L290 190 L210 240 M320 70 L260 50 L230 90 M340 110 L390 150 M270 150 L220 140" fill="none" strokeWidth="1.2" />
          {[[240, 200, 2], [360, 200, 1.5], [200, 60, 1.5], [300, 230, 2.5], [380, 90, 2]].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} stroke="none" />
          ))}
        </g>
      </svg>
      <p className="absolute left-1/2 top-7 z-10 m-0 -translate-x-1/2 whitespace-nowrap border border-line bg-ink px-4 py-2 font-heading text-[13px] font-semibold tracking-[0.18em]">
        THE XIII CYCLE OF WAR
      </p>
      <div className="da-rift-halves relative min-h-[640px]">
        <div data-hero="cosmos" className="da-rift-half flex min-h-80 flex-col justify-end gap-4 px-[clamp(24px,5vw,72px)] pb-16 pt-32 text-[var(--rift-cosmos-ink)]">
          <p data-side="cosmos" className="m-0 flex items-center gap-2.5 font-heading text-[13px] font-semibold tracking-[0.18em]">
            <SideGlyph side="cosmos" /> CHAMPIONS OF COSMOS
          </p>
          <h1 className="m-0 max-w-[460px] text-[clamp(42px,5vw,72px)] font-semibold leading-[1.04]">Light shall endure.</h1>
          <p className="da-lore m-0 max-w-[400px] text-[22px] leading-[1.4] text-[var(--rift-cosmos-muted)]">
            Stand with the goddess of harmony. Guard the crystals and end the war in her name.
          </p>
          <button type="button" onClick={fight} className="da-btn min-h-12 self-start px-6 py-4 text-sm">
            Fight for Cosmos <span aria-hidden>◆</span>
          </button>
        </div>
        <div className="da-rift-half flex min-h-80 flex-col items-end justify-end gap-4 px-[clamp(24px,5vw,72px)] pb-16 pt-32 text-right text-[var(--rift-chaos-ink)] max-[760px]:pt-16">
          <p data-side="chaos" className="m-0 flex items-center gap-2.5 font-heading text-[13px] font-semibold tracking-[0.18em]">
            CHAMPIONS OF CHAOS <SideGlyph side="chaos" />
          </p>
          {/* Same style as the Cosmos h1; the page keeps a single h1. */}
          <h2 className="m-0 max-w-[460px] text-[clamp(42px,5vw,72px)] font-semibold leading-[1.04]">Discord reigns.</h2>
          <p className="da-lore m-0 max-w-[400px] text-[22px] leading-[1.4] text-[var(--rift-chaos-muted)]">
            Serve the god of discord. Shatter the crystals and let the cycle burn.
          </p>
          <button
            type="button"
            onClick={fight}
            className="da-btn min-h-12 border-[var(--rift-chaos-accent)]! bg-[var(--rift-chaos-accent)]! px-6 py-4 text-sm text-[var(--rift-chaos-btn-ink)]!"
          >
            <span aria-hidden>◆</span> Fight for Chaos
          </button>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5 max-[760px]:hidden">
        <svg width="104" height="190" viewBox="0 0 104 190" fill="none">
          <path d="M52 2 L52 188 L4 150 L4 40 Z" strokeWidth="1.5" style={{ fill: 'var(--rift-cosmos-bg)', stroke: 'var(--rift-gold)' }} />
          <path d="M52 2 L100 40 L100 150 L52 188 Z" strokeWidth="1.5" style={{ fill: 'var(--rift-chaos-bg)', stroke: 'var(--rift-chaos-accent)' }} />
          <path d="M4 40 L52 62 L100 40 M4 150 L52 128 L100 150 M52 62 L52 128" strokeWidth="1" opacity="0.7" style={{ stroke: 'var(--rift-gold)' }} />
        </svg>
        <span className="border border-line bg-ink px-3.5 py-1.5 font-brand text-lg font-bold">VS</span>
      </div>
    </section>
  )
}

function SectionHead({ eyebrow, title, lore, center = true }: { eyebrow: string; title: string; lore?: string; center?: boolean }) {
  return (
    <div className={center ? 'flex flex-col items-center gap-2.5 text-center' : 'flex flex-col gap-2'}>
      <p className="da-eyebrow">{eyebrow}</p>
      <h2 className="m-0 text-[38px] font-semibold leading-tight">{title}</h2>
      {lore && <p className="da-lore m-0 max-w-[480px] text-xl text-muted">{lore}</p>}
    </div>
  )
}

function RiftHome() {
  const trials = useTrials()
  const cycle = useCycle()
  const { appearance } = useAppearance()
  const { signedIn } = useApp()
  const cardClass = 'da-card da-brackets min-h-36 gap-2 p-7 text-left no-underline transition-colors hover:border-fg'
  return (
    <>
      <Hero />
      <div className="mx-auto box-border max-w-[1240px] px-[clamp(20px,4vw,56px)]">
        <section aria-labelledby="trials-title" className="pb-10 pt-[72px]">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <p className="da-eyebrow">TRIALS</p>
            <h2 id="trials-title" className="m-0 text-[38px] font-semibold">
              Enter the arena
            </h2>
          </div>
          <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {trials.map((t) => {
              const body = (
                <>
                  <span className="font-brand text-2xl font-bold text-gold" aria-hidden>
                    {t.numeral}
                  </span>
                  <span className="font-heading text-xl font-semibold">{t.title}</span>
                  <span className="text-sm text-muted">{t.text}</span>
                </>
              )
              return t.to ? (
                <Link key={t.numeral} to={t.to} className={cardClass}>
                  {body}
                </Link>
              ) : (
                <button key={t.numeral} type="button" onClick={t.onClick} className={cardClass}>
                  {body}
                </button>
              )
            })}
          </div>
        </section>

        <section className="py-10">
          <SectionHead eyebrow="WORLDS" title="Choose a world" lore="Each crystal holds the colours of a different world. Choose one and the whole arena changes." />
          <div className="mt-9">
            <WorldsPicker />
          </div>
        </section>

        <section className="py-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <SectionHead eyebrow="THE CYCLE OF WAR" title="Your war so far" center={false} />
            <p className="m-0 text-sm text-muted">
              {signedIn ? `${cycle.wins} won · ${cycle.losses} lost in ranked` : 'Sign in to record your battles'}
            </p>
          </div>
          <div role="img" aria-label={`Cosmos ${cycle.cosmos} percent, Chaos ${cycle.chaos} percent`} className="da-gauge">
            <div className="da-gauge__cosmos" style={{ width: `${cycle.cosmos}%` }} />
            <div className="da-gauge__chaos" style={{ width: `${cycle.chaos}%` }} />
          </div>
          <div className="mt-3 flex justify-between font-heading text-base font-semibold">
            <span className="flex items-center gap-2">
              <SideGlyph side="cosmos" /> Cosmos {cycle.cosmos}%
            </span>
            <span className="flex items-center gap-2">
              {cycle.chaos}% Chaos <SideGlyph side="chaos" />
            </span>
          </div>
        </section>

        <section id="rewards" className="pb-[88px] pt-12">
          <div className="mb-9">
            <SectionHead eyebrow="REWARDS" title="Earn new ways to see the arena" />
            <p className="m-0 mt-2.5 text-center text-[15px] text-muted">
              You have {appearance.ranked_wins} ranked {appearance.ranked_wins === 1 ? 'win' : 'wins'}.{' '}
              <Link to="/rewards" className="text-gold underline underline-offset-4">
                See all {appearance.rewards.length} rewards
              </Link>
            </p>
          </div>
          <RewardCards count={3} />
        </section>
      </div>

      <section className="-mb-16 bg-[var(--rift-chaos-bg)] text-[var(--rift-chaos-ink)]">
        <div className="mx-auto box-border flex max-w-[860px] flex-col items-center gap-5 px-[clamp(20px,4vw,56px)] py-20 text-center">
          <p className="da-lore m-0 text-[clamp(26px,3vw,36px)] leading-[1.35]">
            “Twelve times the war has ended. Twelve times it began again. This cycle, the arena remembers every victory.”
          </p>
          <p className="m-0 font-heading text-[13px] font-semibold tracking-[0.18em] text-[var(--rift-chaos-muted)]">THE CHRONICLE OF THE ARENA</p>
        </div>
      </section>
    </>
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
