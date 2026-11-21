import { REWARDS_BY_KEY, type MenuFont, type RewardStatus, type WindowTheme } from '../../theme/appearance'

/** Player-facing copy for each reward, and what its preview tile shows. */
export const REWARD_COPY: Record<string, { text: string; preview: string; window?: WindowTheme; font?: MenuFont }> = {
  classic_interface: {
    text: 'The whole arena as old-school menu windows, with a glove cursor and pixel lettering. Comes with the Classic window.',
    preview: '▶ Battle',
    window: 'classic',
  },
  window_crystal: { text: 'A violet window in the style of IV.', preview: '▶ Battle', window: 'crystal' },
  window_magitek: { text: 'A bronze window in the style of VI.', preview: '▶ Battle', window: 'magitek' },
  window_midgar: { text: 'A diagonal blue window in the style of VII.', preview: '▶ Battle', window: 'midgar' },
  window_garden: { text: 'A slim steel window in the style of VIII.', preview: '▶ Battle', window: 'garden' },
  window_gaia: { text: 'A rounded grey window in the style of IX.', preview: '▶ Battle', window: 'gaia' },
  window_spira: { text: 'A soft blue window in the style of X.', preview: '▶ Battle', window: 'spira' },
  window_ivalice: { text: 'A parchment window in the style of XII.', preview: '▶ Battle', window: 'ivalice' },
  font_8bit: { text: 'The chunky lettering of the earliest games, for the Classic interface.', preview: 'BATTLE', window: 'classic', font: 'bit8' },
  window_custom: { text: 'Mix your own window colour with red, green and blue sliders.', preview: 'R 06  G 10  B 26', window: 'custom' },
}

export function rewardName(key: string) {
  return REWARDS_BY_KEY[key]?.name ?? key
}

/** Status text for a reward card: "Unlocked" or "7 / 15". */
export function rewardStatusText(r: RewardStatus, wins: number) {
  return r.unlocked ? 'Unlocked' : `${Math.min(wins, r.goal)} / ${r.goal}`
}

/** The rewards to show in a short list: the next `count` still locked (or the last ones, once all are earned). */
export function upcomingRewards(rewards: RewardStatus[], count: number) {
  const i = rewards.findIndex((r) => !r.unlocked)
  return i === -1 ? rewards.slice(-count) : rewards.slice(i, i + count)
}
