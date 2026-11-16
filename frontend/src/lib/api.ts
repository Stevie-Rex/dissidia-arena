import type { GameId, Region } from '../data/mock'

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

export interface Match extends QueueSettings {
  id: number
  region: Region
  status: MatchStatus
  acceptDeadline: string
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
  messages: { id: number; from: Side | 'system'; text: string; at: string }[]
}

export interface QueueState {
  queue: QueueEntry | null
  match: Match | null
  searching: Record<GameId, number>
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
  matchAction: (id: number, action: 'accept' | 'decline' | 'confirm' | 'dispute' | 'leave') =>
    request<Match>('POST', `/matches/${id}/${action}`),
  reportGame: (id: number, gameNo: number, winnerId: number, details: GameDetails) =>
    request<Match>('POST', `/matches/${id}/games`, { gameNo, winnerId, details }),
  sendMessage: (id: number, text: string) => request<Match>('POST', `/matches/${id}/messages`, { text }),

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
