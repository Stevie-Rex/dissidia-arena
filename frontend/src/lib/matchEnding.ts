/* Lab, round 3 (#70): helpers for the match-room countdowns and the Forfeit result. */
import { useEffect, useState } from 'react'
import type { Match } from './api'

/** The time now, ticking every second. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

/** m:ss until a time, never below 0:00. */
export function leftUntil(iso: string, now: number) {
  const s = Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000))
  return { seconds: s, text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
}

/** How a Forfeit reads on the result card, for the player who left and the one who stayed. */
export function forfeitResult(match: Match): ['cosmos' | 'chaos', string, string] | null {
  const f = match.forfeit
  if (!f) return null
  const opp = match.opponent.displayName
  if (f.by === 'you')
    return [
      'chaos',
      'You forfeited',
      f.how === 'left'
        ? `You left the match, so ${opp} wins. It counts as a ranked loss, whatever the score.`
        : `You didn't come back within 5 minutes, so ${opp} wins. It counts as a ranked loss, whatever the score.`,
    ]
  return [
    'cosmos',
    'You win by Forfeit',
    f.how === 'left'
      ? `${opp} left the match. It counts as a ranked win, whatever the score.`
      : `${opp} didn't come back within 5 minutes. It counts as a ranked win, whatever the score.`,
  ]
}
