/*
 * Lab, round 3 (#70): the sample world the fake API serves. Dev-only, on a branch that never merges.
 * Matches are stored from neither player's side (players a and b) and turned into the signed-in player's view on each request,
 * so one scenario can be seen as either player.
 */
import type { GameId } from '../data/mock'
import type { GameDetails, Me, MatchStatus, RatingChange, Ruling, Season, SettledMatchInfo } from '../lib/api'

export type Who = 'a' | 'b'
export const other = (w: Who): Who => (w === 'a' ? 'b' : 'a')

export interface LabPlayer {
  id: number
  displayName: string
  username: string
  gameId: string
}

export const PLAYER_A: LabPlayer = { id: 101, displayName: 'Vesper', username: 'vesper', gameId: 'Vesper_PS' }
export const PLAYER_B: LabPlayer = { id: 102, displayName: 'Kestrel', username: 'kestrel', gameId: 'Kestrel99' }
export const MASTER: LabPlayer = { id: 1, displayName: 'Corvin', username: 'corvin', gameId: 'Corvin' }

export interface LabGameRow {
  n: number
  winner: Who
  reportedBy: Who
  details: GameDetails
}

/** A match from neither side. */
export interface LabMatch {
  id: number
  game: GameId
  platform: string
  status: MatchStatus
  host: Who
  games: LabGameRow[]
  winner: Who | null
  reportedBy: Who | null
  endedBy: Who | null
  ruling: Ruling | null
  replayDeadline: string | null
  createdAt: string
  finishedAt: string | null
  messages: { id: number; from: Who | 'system'; text: string; at: string }[]
  ratingChanges: Record<Who, RatingChange> | null
  forfeit: { by: Who; how: 'left' | 'countdown' } | null
  reopened: { at: string; reason: string; tookBackFrom: Who | null } | null
  gone: { availableAt: string; waitingFor: 'start' | 'here'; countdown: { absent: Who; endsAt: string } | null } | null
  dispute: { round: number; games: number[]; reason: string | null; by: Who | null } | null
  settledBy: SettledMatchInfo['settledBy']
}

export interface LabWorld {
  /** Who you are signed in as: player a, player b, or the Master. */
  as: Who | 'master'
  me: Me
  matches: LabMatch[]
  /** The match the queue poll returns (your open match), if any. */
  current: number | null
  seasons: Record<GameId, Season | null>
}

export const at = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString()
export const MIN = 60_000
export const DAY = 24 * 60 * MIN

/** Season 1 ends one calendar month after it starts, at 00:00 UTC. */
export function seasonEnd(start: Date) {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate() + 1)).toISOString()
}

export function season1(game: GameId, startedMsAgo = 0): Season {
  const start = new Date(Date.now() - startedMsAgo)
  return { game, number: 1, startedAt: start.toISOString(), endsAt: seasonEnd(start) }
}

let nextMessage = 1000
export const msg = (from: Who | 'system', text: string, msAgo = 0) => ({ id: nextMessage++, from, text, at: at(-msAgo) })

export function baseMatch(over: Partial<LabMatch> = {}): LabMatch {
  return {
    id: 212,
    game: '012',
    platform: 'PPSSPP',
    status: 'active',
    host: 'a',
    games: [],
    winner: null,
    reportedBy: null,
    endedBy: null,
    ruling: null,
    replayDeadline: null,
    createdAt: at(-20 * MIN),
    finishedAt: null,
    messages: [msg('system', 'Match started', 20 * MIN), msg('b', 'gl hf', 19 * MIN), msg('a', 'you too', 19 * MIN)],
    ratingChanges: null,
    forfeit: null,
    reopened: null,
    gone: { availableAt: at(-15 * MIN), waitingFor: 'start', countdown: null },
    dispute: null,
    settledBy: null,
    ...over,
  }
}

export const twoGames = (winner: Who = 'a'): LabGameRow[] => [
  { n: 1, winner, reportedBy: 'a', details: { character: 'Squall', helper: 'Yuna', stage: 'Order Sanctuary' } },
  { n: 2, winner: other(winner), reportedBy: 'b', details: { character: 'Squall', helper: 'Yuna', stage: 'Kefka Tower' } },
  { n: 3, winner, reportedBy: 'a', details: { character: 'Squall', helper: 'Yuna', stage: 'Order Sanctuary' } },
]

export function meFor(as: Who | 'master', over: Partial<Me> = {}): Me {
  const p = as === 'master' ? MASTER : as === 'a' ? PLAYER_A : PLAYER_B
  return {
    id: p.id,
    discordId: String(p.id),
    username: p.username,
    displayName: p.displayName,
    avatarUrl: '',
    onboarded: true,
    region: 'EU',
    games: ['012', 'nt'],
    gameIds: { '012': p.gameId, nt: p.gameId },
    rankedWins: 14,
    role: as === 'master' ? 'master' : 'player',
    ladders: [],
    ...over,
  }
}
