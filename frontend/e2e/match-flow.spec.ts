import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { Match, QueueEntry, Side } from '../src/lib/api'
import { mockApi } from './mock'

// The Rift match flow at phone width: queue, accept, report, confirm and dispute with a Screenshot.
// Seen from the signed-in tester (id 1) against Rival (id 2). The mock server below plays the backend's rules.

const PHONE = { width: 390, height: 844 }
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const player = (id: number, displayName: string, accepted = true) => ({
  id, displayName, avatarUrl: '', region: 'EU', gameId: `id${id}`, accepted,
})
const iso = (ms: number) => new Date(Date.now() + ms).toISOString().replace(/\.\d+Z$/, 'Z')
// A 1x1 PNG, enough for the browser to load an <img>.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 42, game: '012', mode: '1v1', bestOf: 3, platform: 'PSP', region: 'EU', status: 'active',
    acceptDeadline: iso(30_000), createdAt: iso(0), finishedAt: null, confirmDeadline: null, replayDeadline: null,
    replayNotFinished: false, host: 'you', you: player(1, 'Tester'), opponent: player(2, 'Rival'), winsNeeded: 2,
    score: { you: 0, opponent: 0 }, games: [], winner: null, reportedBy: null, endedBy: null, dispute: null, ruling: null,
    rewardsUnlocked: [], messages: [], canAskAdmin: true, helpRequest: null,
    ...overrides,
  }
}

/**
 * A small stand-in for the server: POST /api/queue finds a match at once, accept starts it,
 * each reported game adds to the score, and confirm, dispute and screenshots change the match.
 */
async function server(page: Page, start: { queue?: QueueEntry; match?: Match; mode?: 'chaos' | 'cosmos' } = {}) {
  await mockApi(page, { wins: 0, prefs: { rift_mode: start.mode ?? 'chaos' } })
  const sent: { method: string; path: string; body?: unknown }[] = []
  let queue: QueueEntry | null = start.queue ?? null
  let m: Match | null = start.match ?? null
  const state = () => ({
    queue, match: m && ['pending', 'active', 'reported'].includes(m.status) ? m : null,
    searching: { '012': 3, nt: 0 }, disputes: [],
  })
  await page.route('**/api/queue', (r) => {
    const req = r.request()
    if (req.method() === 'POST') {
      sent.push({ method: 'POST', path: '/api/queue', body: req.postDataJSON() })
      queue = null
      m = match({ status: 'pending', you: player(1, 'Tester', false), opponent: player(2, 'Rival', true) })
    } else if (req.method() === 'DELETE') {
      sent.push({ method: 'DELETE', path: '/api/queue' })
      queue = null
    }
    return r.fulfill(json(state()))
  })
  await page.route('**/api/matches/42/**', (r) => {
    const req = r.request()
    const path = new URL(req.url()).pathname
    if (req.method() === 'GET') return r.fulfill(path.includes('/screenshots/') ? { status: 200, contentType: 'image/png', body: PNG } : json(m))
    const body = req.headers()['content-type']?.startsWith('application/json') ? req.postDataJSON() : undefined
    sent.push({ method: req.method(), path, body })
    const action = path.split('/').pop()
    if (!m) return r.fulfill(json({ error: 'not_found' }, 404))
    if (action === 'accept') m = { ...m, status: 'active', you: { ...m.you, accepted: true } }
    if (action === 'games') {
      const winner: Side = body.winnerId === 1 ? 'you' : 'opponent'
      const score = { ...m.score, [winner]: m.score[winner] + 1 }
      const games: Match['games'] = [...m.games, { n: body.gameNo, winner, reportedBy: 'you', details: body.details }]
      const done = score[winner] >= m.winsNeeded
      m = { ...m, score, games, ...(done && { status: 'reported', reportedBy: 'you', winner, confirmDeadline: iso(2 * 3600_000) }) }
    }
    if (action === 'confirm') m = { ...m, status: 'completed', confirmDeadline: null, finishedAt: iso(0) }
    if (action === 'dispute') {
      m = { ...m, status: 'disputed', endedBy: 'you', confirmDeadline: null,
        dispute: { round: 0, games: body.games, reason: body.reason, by: 'you', statements: { you: null, opponent: null },
          screenshots: { you: [], opponent: [] } } }
    }
    if (action === 'screenshots' && m.dispute) {
      const mine = m.dispute.screenshots.you
      const shot = { id: 100 + mine.length, url: `/api/matches/42/screenshots/${100 + mine.length}`, at: iso(0), round: 0, removed: false }
      m = { ...m, dispute: { ...m.dispute, screenshots: { ...m.dispute.screenshots, you: [...mine, shot] } } }
      return r.fulfill(json(m, 201))
    }
    if (action === 'messages') {
      m = { ...m, messages: [...m.messages, { id: m.messages.length + 1, from: 'you', text: body.text, at: iso(0) }] }
    }
    return r.fulfill(json(m))
  })
  await page.route('**/api/matches/42', (r) => r.fulfill(json(m)))
  return sent
}

test.describe('the match flow at phone width', () => {
  test.use({ viewport: PHONE })

  test('a player queues, accepts the match, and reports both games', async ({ page }) => {
    const sent = await server(page)
    await page.goto('/queue')
    await expect(page.getByRole('heading', { level: 1, name: 'Queue' })).toBeVisible()
    const queue = page.getByRole('main')
    await queue.getByRole('group', { name: 'Game' }).getByRole('button', { name: '012', exact: true }).click()
    await queue.getByRole('button', { name: 'Queue', exact: true }).click()
    const accept = page.getByRole('dialog', { name: 'Match found' }).getByRole('button', { name: 'Accept', exact: true })
    await expect(accept).toBeVisible()
    expect(sent[0]).toMatchObject({ method: 'POST', path: '/api/queue', body: { game: '012', mode: '1v1', bestOf: 3 } })

    await accept.click()
    await expect(page).toHaveURL(/\/match\/live$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Match room' })).toBeVisible()
    const score = page.getByRole('region', { name: 'Score' })
    await expect(score.getByRole('img', { name: 'Score 0 to 0' })).toBeVisible()
    await expect(score).toContainText('Rival')
    await page.getByRole('textbox', { name: 'Message Rival' }).fill('Ready when you are.')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.getByRole('log', { name: 'Match chat' })).toContainText('Ready when you are.')

    // Game 1: pick who won, then Report result.
    const report = page.getByRole('form', { name: 'Report game 1' })
    await report.getByRole('radio', { name: 'I won' }).check()
    await report.getByRole('button', { name: 'Report result' }).click()
    await expect(score.getByRole('img', { name: 'Score 1 to 0' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Games' })).toContainText('Game 1')

    // Without a winner picked, nothing is sent.
    const next = page.getByRole('form', { name: 'Report game 2' })
    const before = sent.length
    await next.getByRole('button', { name: 'Report result' }).click()
    await expect(next.getByRole('alert')).toHaveText('Pick who won game 2.')
    expect(sent.length).toBe(before)

    await next.getByRole('radio', { name: 'I won' }).check()
    await next.getByRole('button', { name: 'Report result' }).click()
    await expect(score.getByRole('img', { name: 'Score 2 to 0' })).toBeVisible()
    await expect(page.getByText('Rival needs to confirm or dispute.')).toBeVisible()
    expect(sent.filter((s) => s.path.endsWith('/games')).map((s) => (s.body as { gameNo: number }).gameNo)).toEqual([1, 2])

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

const reported = () => match({
  status: 'reported', reportedBy: 'opponent', winner: 'opponent', score: { you: 0, opponent: 2 },
  confirmDeadline: iso(3600_000),
  games: [1, 2].map((n) => ({ n, winner: 'opponent', reportedBy: 'opponent', details: {} })),
})

test.describe('responding to a result at phone width', () => {
  test.use({ viewport: PHONE })

  test('the opponent confirms the reported result', async ({ page }) => {
    const sent = await server(page, { match: reported() })
    await page.goto('/match/live')
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page.getByText('You lost 0–2')).toBeVisible()
    expect(sent).toContainEqual({ method: 'POST', path: '/api/matches/42/confirm', body: undefined })
  })

  for (const mode of ['chaos', 'cosmos'] as const) {
    test(`queue and dispute with a Screenshot in ${mode} mode`, async ({ page }) => {
      await server(page, { mode })
      await page.goto('/queue')
      await expect(page.getByRole('main').getByRole('button', { name: 'Queue', exact: true })).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-rift-mode', mode)
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])

      await server(page, { mode, match: match() })
      await page.goto('/match/live')
      await expect(page.getByRole('form', { name: 'Report game 1' })).toBeVisible()
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])

      await server(page, { mode, match: reported() })
      await page.goto('/match/live')
      await page.getByRole('button', { name: 'Dispute', exact: true }).click()
      const form = page.getByRole('form', { name: 'Dispute the result' })
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
      await form.getByRole('checkbox', { name: /^Game 2/ }).check()
      await form.getByRole('textbox', { name: 'Why are you disputing?' }).fill('I won game 2.')
      await form.getByRole('button', { name: 'Submit dispute' }).click()

      const dispute = page.getByRole('region', { name: 'Dispute' })
      await expect(dispute).toContainText('I won game 2.')
      await dispute.getByLabel('Add a screenshot (0 of 3)').setInputFiles({
        name: 'game-2.png', mimeType: 'image/png', buffer: PNG,
      })
      const image = dispute.getByRole('img', { name: 'Screenshot 1 from you' })
      await expect(image).toBeVisible()
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width)
    })
  }
})
