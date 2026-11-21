import type { GameId, Region } from '../data/mock'
import type { Appearance, Preferences, RewardDef } from '../theme/appearance'

export interface Me {
  id: number
  discordId: string
  username: string
  displayName: string
  avatarUrl: string
  onboarded: boolean
  region: Region
  games: GameId[]
  gameIds: Partial<Record<GameId, string>>
  rankedWins: number
}

export interface QueueSettings {
  game: GameId
  mode: '1v1' | '3v3'
  bestOf: number
  platform: string
}

export interface QueueEntry extends QueueSettings {
  region: Region
  joinedAt: string
  source: 'web' | 'discord'
}

/** Seen from the signed-in player's side. */
export type Side = 'you' | 'opponent'

export interface MatchPlayer {
  id: number
  displayName: string
  avatarUrl: string
  gameId: string | null
  accepted: boolean
}

export type MatchStatus = 'pending' | 'active' | 'reported' | 'completed' | 'disputed' | 'cancelled' | 'abandoned'
export const OPEN_STATUSES: MatchStatus[] = ['pending', 'active', 'reported']

export interface GameDetails {
  character?: string
  helper?: string
  stage?: string
}

export interface DisputeStatement {
  text: string
  updatedAt: string
}

/** The dispute form and each player's side. games is empty and reason null on disputes filed before the form. */
export interface Dispute {
  games: number[]
  reason: string | null
  by: Side | null
  statements: Record<Side, DisputeStatement | null>
}

/** One of your Disputed matches, for the "add your side" notice. */
export interface DisputeSummary {
  id: number
  game: GameId
  opponent: string
  youReported: boolean
  statementAdded: boolean
}

export interface Match extends QueueSettings {
  id: number
  region: Region
  status: MatchStatus
  acceptDeadline: string
  /** While reported: when the result confirms itself unless the opponent confirms or disputes first. */
  confirmDeadline: string | null
  createdAt: string
  finishedAt: string | null
  host: Side
  you: MatchPlayer
  opponent: MatchPlayer
  winsNeeded: number
  score: Record<Side, number>
  games: { n: number; winner: Side; reportedBy: Side; details: GameDetails }[]
  winner: Side | null
  reportedBy: Side | null
  endedBy: Side | null
  dispute: Dispute | null
  messages: { id: number; from: Side | 'system'; text: string; at: string }[]
  /** Rewards this match earned for you (non-empty only for the winner of a completed match). */
  rewardsUnlocked: Pick<RewardDef, 'key' | 'name' | 'goal'>[]
  /** Only on the confirm response: reward keys you unlocked just now. */
  newlyUnlocked?: string[]
}

export interface QueueState {
  queue: QueueEntry | null
  match: Match | null
  searching: Record<GameId, number>
  disputes: DisputeSummary[]
}

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super(`API ${status}`)
    this.status = status
    this.body = body
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  /** Returns null when signed out. */
  me: () => request<Me>('GET', '/me').catch((e) => (e instanceof ApiError && e.status === 401 ? null : Promise.reject(e))),
  updateMe: (patch: Partial<Pick<Me, 'region' | 'games' | 'gameIds' | 'onboarded'>>) => request<Me>('PATCH', '/me', patch),
  logout: () => request<void>('POST', '/auth/logout'),

  queueState: () => request<QueueState>('GET', '/queue'),
  joinQueue: (settings: QueueSettings) => request<QueueState>('POST', '/queue', settings),
  leaveQueue: () => request<QueueState>('DELETE', '/queue'),
  match: (id: number) => request<Match>('GET', `/matches/${id}`),
  matchAction: (id: number, action: 'accept' | 'decline' | 'confirm' | 'leave') =>
    request<Match>('POST', `/matches/${id}/${action}`),
  reportGame: (id: number, gameNo: number, winnerId: number, details: GameDetails) =>
    request<Match>('POST', `/matches/${id}/games`, { gameNo, winnerId, details }),
  dispute: (id: number, games: number[], reason: string) =>
    request<Match>('POST', `/matches/${id}/dispute`, { games, reason }),
  saveStatement: (id: number, text: string) => request<Match>('PUT', `/matches/${id}/statement`, { text }),
  sendMessage: (id: number, text: string) => request<Match>('POST', `/matches/${id}/messages`, { text }),

  appearance: () => request<Appearance>('GET', '/me/appearance'),
  saveAppearance: (changes: Partial<Preferences>) => request<Appearance>('PATCH', '/me/appearance', changes),
  rewards: () => request<{ rewards: RewardDef[] }>('GET', '/rewards'),

  /** Full-page redirect into Discord's OAuth flow; comes back to `next`. */
  discordLoginUrl: (next: string) => `/api/auth/discord/login?next=${encodeURIComponent(next)}`,
}

/** Human-readable message from an API error body ({ error, message }). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { message?: string } | null
    if (body?.message) return body.message
    if (e.status === 401) return 'Sign in first'
  }
  return 'Something went wrong. Try again.'
}

export function errorCode(e: unknown): string | undefined {
  return e instanceof ApiError ? (e.body as { error?: string } | null)?.error : undefined
}
