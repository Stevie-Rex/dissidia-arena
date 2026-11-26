import type { Page, Request } from '@playwright/test'
import type { Role } from '../src/lib/api'
import tokens from '../src/theme/tokens.json' with { type: 'json' }

type Prefs = {
  interface: string
  window_theme: string
  menu_font: string
  cursor: string
  window_rgb: number[]
}

const DEFAULTS: Prefs = {
  interface: 'rift',
  window_theme: 'classic',
  menu_font: 'auto',
  cursor: 'glove',
  window_rgb: [6, 10, 26],
}

const REWARDS = tokens.rewards as { key: string; name: string; goal: number; unlocks: Record<string, string[]> }[]

function appearance(wins: number, prefs: Prefs, losses = 0) {
  const unlocks = REWARDS.filter((r) => wins >= r.goal).map((r) => r.key)
  const rewards = REWARDS.map((r) => {
    const have = unlocks.includes(r.key)
    return {
      ...r,
      unlocked: have,
      remaining: have ? 0 : Math.max(0, r.goal - wins),
      percent: have ? 100 : Math.min(100, Math.round((wins / r.goal) * 100)),
    }
  })
  return { preferences: prefs, ranked_wins: wins, ranked_losses: losses, unlocks, rewards, next: rewards.find((r) => !r.unlocked) ?? null }
}

/** The server's lock rule, enough for the tests: any value a reward lists needs that reward. */
function lockedBy(field: string, value: unknown, wins: number) {
  for (const r of REWARDS) {
    const vals = r.unlocks[field]
    if (vals && (vals.includes('any') || vals.includes(value as string)) && wins < r.goal) return r
  }
  return null
}

export interface MockServer {
  patches: Record<string, unknown>[]
}

/**
 * Mock the API. `wins: null` means signed out. PATCH /api/me/appearance applies the same lock rule
 * as the server and records what was sent.
 */
export async function mockApi(
  page: Page,
  opts: { wins: number | null; prefs?: Partial<Prefs>; losses?: number; getDelayMs?: number; role?: Role },
): Promise<MockServer> {
  const server: MockServer = { patches: [] }
  let prefs: Prefs = { ...DEFAULTS, ...opts.prefs }
  const signedIn = opts.wins !== null
  const wins = opts.wins ?? 0

  await page.route('**/api/**', async (route) => {
    const req: Request = route.request()
    const path = new URL(req.url()).pathname
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (path === '/api/me') {
      if (!signedIn) return json(401, { error: 'unauthenticated' })
      return json(200, {
        id: 1, discordId: '1', username: 'tester', displayName: 'Tester', avatarUrl: '', onboarded: true,
        region: 'EU', games: ['012', 'nt'], gameIds: {}, rankedWins: wins, role: opts.role ?? 'player',
      })
    }
    if (path === '/api/me/appearance') {
      if (!signedIn) return json(401, { error: 'unauthenticated' })
      if (req.method() === 'PATCH') {
        const changes = req.postDataJSON() as Record<string, unknown>
        server.patches.push(changes)
        for (const [field, value] of Object.entries(changes)) {
          const r = lockedBy(field, value, wins)
          if (r) return json(403, { error: 'locked', reward: r.key, goal: r.goal, remaining: r.goal - wins, message: 'locked' })
        }
        prefs = { ...prefs, ...(changes as Partial<Prefs>) }
      } else if (opts.getDelayMs) {
        await new Promise((r) => setTimeout(r, opts.getDelayMs))
      }
      return json(200, appearance(wins, prefs, opts.losses))
    }
    if (path === '/api/queue') return json(200, { queue: null, match: null, searching: { '012': 0, nt: 0 } })
    if (path === '/api/rewards') return json(200, { rewards: REWARDS })
    return json(404, { error: 'not_found' })
  })
  return server
}

export const WINDOW_KEYS = Object.keys(tokens.classic.windows)
