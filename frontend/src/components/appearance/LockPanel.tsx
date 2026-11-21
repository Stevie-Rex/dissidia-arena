import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppState'
import { useAppearance } from '../../state/Appearance'
import { Btn } from '../ui'
import { rewardName } from './copy'
import { Progress } from './parts'

/** Opens under the Rift header when a locked reward is chosen. Classic gets a Preview button. */
export default function LockPanel() {
  const { lockPanel, closeLock, startPreview, appearance } = useAppearance()
  const { signedIn, signIn } = useApp()
  if (!lockPanel) return null
  const wins = appearance.ranked_wins
  const isClassic = lockPanel.key === 'classic_interface'
  const title = isClassic ? 'The Classic interface is a reward' : `${rewardName(lockPanel.key)} is a reward`
  const remaining = Math.max(0, lockPanel.goal - wins)

  return (
    <div
      id={isClassic ? 'classic-lock-panel' : undefined}
      role="region"
      aria-label={`${rewardName(lockPanel.key)} is locked`}
      className="border-b border-line bg-card"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-4 px-[clamp(20px,4vw,56px)] py-5">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
          <p className="m-0 font-heading text-lg font-semibold">{title}</p>
          <p className="m-0 text-[15px] text-muted">
            {signedIn
              ? `Win ${remaining} more ranked ${remaining === 1 ? 'battle' : 'battles'} to unlock it for good.`
              : `Unlocks at ${lockPanel.goal} ranked wins. Sign in to start counting.`}
            {isClassic && ' You can preview it now.'}
          </p>
          <div className="flex max-w-md items-center gap-3">
            <Progress done={wins} goal={lockPanel.goal} />
            <span className="font-heading text-sm font-semibold">
              {Math.min(wins, lockPanel.goal)} / {lockPanel.goal}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {isClassic && (
            <Btn size="lg" onClick={startPreview}>
              Preview Classic
            </Btn>
          )}
          {!signedIn && (
            <Btn size="lg" variant="ghost" onClick={signIn}>
              Sign in
            </Btn>
          )}
          {!isClassic && (
            <Link to="/rewards" onClick={closeLock} className="da-btn da-btn--ghost min-h-11 px-6 py-3 text-sm">
              All rewards
            </Link>
          )}
          <Btn size="lg" variant="ghost" onClick={closeLock}>
            Not now
          </Btn>
        </div>
      </div>
    </div>
  )
}
