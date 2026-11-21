import RewardCards from '../components/appearance/RewardCards'
import { Progress } from '../components/appearance/parts'
import { Btn } from '../components/ui'
import { useApp } from '../state/AppState'
import { useAppearance } from '../state/Appearance'

/** Every reward on the ladder with progress: Classic at 10 ranked wins, then a new unlock every 5. */
export default function Rewards() {
  const { appearance, ui } = useAppearance()
  const { signedIn, signIn } = useApp()
  const wins = appearance.ranked_wins
  const next = appearance.next
  const earned = appearance.unlocks.length

  return (
    <div className="flex flex-col gap-8">
      <header className={ui === 'classic' ? 'da-window flex flex-col gap-3 px-6 py-5' : 'flex flex-col items-center gap-2.5 text-center'}>
        {ui === 'rift' && <p className="da-eyebrow">REWARDS</p>}
        <h1 className="m-0 text-[clamp(28px,4vw,38px)] font-semibold">Earn new ways to see the arena</h1>
        <p className="m-0 max-w-xl text-[15px] text-muted">
          Ranked wins in either game count. Unlocks are yours for good once earned.
        </p>
        {signedIn ? (
          <div className="flex w-full max-w-md flex-col gap-2">
            <p className="m-0 font-semibold">
              {wins} ranked {wins === 1 ? 'win' : 'wins'} · {earned} of {appearance.rewards.length} unlocked
            </p>
            {next && (
              <div className="flex items-center gap-3">
                <Progress done={wins} goal={next.goal} label={`${next.name}: ${wins} of ${next.goal} wins`} />
                <span className="whitespace-nowrap text-sm">
                  {next.remaining} to {next.name}
                </span>
              </div>
            )}
          </div>
        ) : (
          <Btn size="lg" onClick={signIn}>
            Sign in to start counting
          </Btn>
        )}
      </header>
      <RewardCards headingLevel={2} />
    </div>
  )
}
