import { useState } from 'react'
import type { Match } from '../../lib/api'
import { useAppearance } from '../../state/Appearance'
import type { Preferences } from '../../theme/appearance'
import { Btn } from '../ui'
import { REWARD_COPY, upcomingRewards } from './copy'
import { MenuCursor, Progress, WindowSwatch } from './parts'
import { RewardRows } from './RewardCards'

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** What "Equip" saves for each reward. Everything past the first lives in Classic, so it switches there too. */
function equipChanges(key: string): Partial<Preferences> {
  if (key === 'classic_interface') return { interface: 'classic' }
  if (key === 'font_8bit') return { interface: 'classic', menu_font: 'bit8' }
  if (key === 'window_custom') return { interface: 'classic', window_theme: 'custom' }
  if (key.startsWith('window_')) return { interface: 'classic', window_theme: key.slice('window_'.length) as Preferences['window_theme'] }
  return {}
}

/** Shown on a completed match that unlocked something for you: the reward, Equip, and what's next. */
export default function VictoryReward({ match }: { match: Match }) {
  const { appearance, prefs, save, ui } = useAppearance()
  const [kept, setKept] = useState(false)
  if (match.status !== 'completed' || match.winner !== 'you' || !match.rewardsUnlocked?.length) return null

  // Usually one reward per win; if a match ever grants several, lead with the newest.
  const reward = match.rewardsUnlocked[match.rewardsUnlocked.length - 1]
  const copy = REWARD_COPY[reward.key]
  const isClassic = reward.key === 'classic_interface'
  const title = isClassic ? 'The Classic interface' : `The ${reward.name}`
  const next = upcomingRewards(appearance.rewards, 2).filter((r) => !r.unlocked)

  const changes = equipChanges(reward.key)
  // Derived from the saved look, not local state: equipping Classic swaps the layout and remounts this card.
  const equipped = Object.entries(changes).every(([k, v]) => prefs[k as keyof Preferences] === v)
  const equip = () => void save(changes, { trustServer: true })

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="reward-title" className="da-card da-card--gold da-brackets flex-row flex-wrap items-center gap-8 p-[clamp(20px,4vw,40px)]">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
          <p className="da-eyebrow">REWARD UNLOCKED</p>
          <h2 id="reward-title" className="m-0 text-[clamp(26px,3vw,36px)] font-semibold leading-tight">
            {title}
          </h2>
          <p className="m-0 text-base leading-relaxed text-muted">
            That was your {ordinal(reward.goal)} ranked win. {copy?.text}
          </p>
          <div className="flex max-w-md items-center gap-3">
            <Progress done={reward.goal} goal={reward.goal} />
            <span className="font-heading text-sm font-semibold">
              {reward.goal} / {reward.goal}
            </span>
          </div>
          {!equipped && !kept ? (
            <div className="flex flex-wrap gap-2.5">
              <Btn size="lg" onClick={equip}>
                {isClassic ? 'Equip Classic now' : 'Equip it now'} <span aria-hidden>◆</span>
              </Btn>
              <Btn size="lg" variant="ghost" onClick={() => setKept(true)}>
                {isClassic || ui === 'rift' ? 'Keep Rift for now' : 'Keep my current look'}
              </Btn>
            </div>
          ) : (
            <p role="status" className="m-0 font-semibold">
              {equipped ? 'Equipped. Enjoy the new look.' : 'Saved for later. Equip it any time from Config.'}
            </p>
          )}
          <p className="m-0 text-sm text-muted">You can switch at any time from the Interface control at the top of every page.</p>
        </div>
        {copy?.window && (
          <div className="flex flex-[1_1_260px] flex-col gap-2">
            <WindowSwatch window={copy.window} font={copy.font} className="min-h-14 px-4 py-3 text-[length:var(--menu-body)]">
              Received {reward.name}!
            </WindowSwatch>
            <WindowSwatch window={copy.window} font={copy.font} className="flex-col items-start! gap-1 px-4 py-3 text-[length:var(--menu-command)]">
              <span aria-hidden className="flex items-center gap-1.5">
                <span className="flex w-6 items-center">
                  <MenuCursor />
                </span>
                Battle
              </span>
              <span aria-hidden className="pl-[30px]">Fighters</span>
              <span aria-hidden className="pl-[30px]">Config</span>
            </WindowSwatch>
          </div>
        )}
      </section>
      {next.length > 0 && (
        <section aria-labelledby="next-title" className="flex flex-col gap-3">
          <h2 id="next-title" className="m-0 text-xl font-semibold">
            Next rewards
          </h2>
          <RewardRows rewards={next} wins={appearance.ranked_wins} />
        </section>
      )}
    </div>
  )
}
