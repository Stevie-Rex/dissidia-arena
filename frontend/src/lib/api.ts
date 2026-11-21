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
  /** Full-page redirect into Discord's OAuth flow; comes back to `next`. */
  discordLoginUrl: (next: string) => `/api/auth/discord/login?next=${encodeURIComponent(next)}`,
}
