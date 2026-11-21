import { cx } from '../../lib/format'
import { useAppearance } from '../../state/Appearance'
import type { RewardStatus } from '../../theme/appearance'
import { REWARD_COPY, rewardStatusText, upcomingRewards } from './copy'
import { Progress, WindowSwatch } from './parts'

export function RewardCard({ reward, wins, headingLevel = 3 }: { reward: RewardStatus; wins: number; headingLevel?: 2 | 3 }) {
  const copy = REWARD_COPY[reward.key]
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className={cx('da-card da-brackets gap-3.5 p-7', reward.unlocked && 'da-card--gold')}>
      {copy?.window && (
        <WindowSwatch window={copy.window} font={copy.font} className="h-[92px] text-[length:var(--menu-command)]">
          <span aria-hidden>{copy.preview}</span>
        </WindowSwatch>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <Heading className="m-0 text-xl font-semibold">{reward.name}</Heading>
        <span className="font-brand text-lg font-bold text-gold">{reward.goal}</span>
      </div>
      {copy && <p className="m-0 text-[15px] leading-normal text-muted">{copy.text}</p>}
      <div className="mt-auto flex items-center gap-3">
        <Progress done={reward.unlocked ? reward.goal : wins} goal={reward.goal} label={`${reward.name}: ${rewardStatusText(reward, wins)} wins`} />
        <span className="whitespace-nowrap font-heading text-sm font-semibold">{rewardStatusText(reward, wins)}</span>
      </div>
    </div>
  )
}

export default function RewardCards({ count, headingLevel }: { count?: number; headingLevel?: 2 | 3 }) {
  const { appearance } = useAppearance()
  const list = count ? upcomingRewards(appearance.rewards, count) : appearance.rewards
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
      {list.map((r) => (
        <RewardCard key={r.key} reward={r} wins={appearance.ranked_wins} headingLevel={headingLevel} />
      ))}
    </div>
  )
}

/** Compact rows ("45  Ivalice window  ▬▬▬  12 / 45"), for the victory screen and Classic. */
export function RewardRows({ rewards, wins }: { rewards: RewardStatus[]; wins: number }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {rewards.map((r) => (
        <li key={r.key} className="da-card flex-row flex-wrap items-center gap-4 px-5 py-4">
          <span className="w-10 font-brand text-xl font-bold text-gold">{r.goal}</span>
          <span className="flex min-w-[180px] flex-1 flex-col">
            <span className="font-semibold">{r.name}</span>
            <span className="text-sm text-muted">{REWARD_COPY[r.key]?.text}</span>
          </span>
          <Progress done={r.unlocked ? r.goal : wins} goal={r.goal} className="max-w-48 min-w-24" />
          <span className="w-16 text-right text-sm font-semibold">{rewardStatusText(r, wins)}</span>
        </li>
      ))}
    </ul>
  )
}
