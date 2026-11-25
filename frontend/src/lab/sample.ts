/* Fixed sample data for the lab. Nothing here reaches the API. */
import tokens from '../theme/tokens.json'

export type LabGame = '012' | 'NT'

export const GAMES: { id: LabGame; name: string; searching: number }[] = [
  { id: '012', name: 'Dissidia 012 Duodecim', searching: 14 },
  { id: 'NT', name: 'Dissidia NT', searching: 6 },
]

export const PLAYER = {
  name: 'Lightbringer',
  region: 'EU',
  rankedWins: 23,
}

/** The next locked reward, from the real reward goals in tokens.json. */
export function nextUnlock(wins: number) {
  const next = tokens.rewards.find((r) => r.goal > wins)
  if (!next) return null
  const prev = [...tokens.rewards].reverse().find((r) => r.goal <= wins)
  return { name: next.name, goal: next.goal, from: prev?.goal ?? 0 }
}

export const OPPONENT = { name: 'Kuja Fanatic', region: 'EU' }

export const MATCH = {
  id: 1042,
  bestOf: 3,
  games: [
    { n: 1, you: 'Warrior of Light', them: 'Kuja', winner: 'you' as const },
    { n: 2, you: 'Warrior of Light', them: 'Kuja', winner: 'them' as const },
  ],
  chat: [
    { from: 'them', text: 'gg, room code is 4471' },
    { from: 'you', text: 'joining now' },
    { from: 'them', text: 'last game, good luck' },
  ],
}
