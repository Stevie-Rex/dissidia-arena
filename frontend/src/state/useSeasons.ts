import { useEffect, useState } from 'react'
import type { GameId } from '../data/mock'
import { api, PLACEMENT_MATCHES, type LadderStanding, type Me, type Season } from '../lib/api'

/** Lab round 3 (#14, #71): each game's live Season, or null before Season 1 (and while loading). */
export function useSeasons(): Record<GameId, Season | null> {
  const [seasons, setSeasons] = useState<Record<GameId, Season | null>>({ '012': null, nt: null })
  useEffect(() => {
    let current = true
    api.seasons().then(
      (r) => current && setSeasons(r.seasons),
      () => {
        /* no Seasons yet */
      },
    )
    return () => {
      current = false
    }
  }, [])
  return seasons
}

/** Your Ladders for a game in its live Season: one for 012, PS4 and PC for NT. */
export const laddersFor = (user: Me | null | undefined, game: GameId): LadderStanding[] =>
  (user?.ladders ?? []).filter((l) => l.game === game)

/** "1548" once placed, "Placement 3/5" before. */
export const standingText = (l: LadderStanding) => (l.placed ? String(l.rating) : `Placement ${l.placements}/${PLACEMENT_MATCHES}`)

/** A Season's end, as players read it, such as "29 Dec 2026, 00:00 UTC". */
export const seasonEnds = (s: Season) =>
  `${new Date(s.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}, 00:00 UTC`
