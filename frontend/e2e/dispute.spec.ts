import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './mock'

// Seen from the signed-in tester (id 1). The opponent (id 2) reported a 2-1 win.
const player = (id: number, displayName: string) => ({ id, displayName, avatarUrl: '', region: 'EU', gameId: `id${id}`, accepted: true })

function reportedMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 42, game: 'nt', mode: '1v1', bestOf: 3, platform: 'PS4', region: 'EU', status: 'reported',
    acceptDeadline: '2026-11-21T10:00:00Z', createdAt: '2026-11-21T10:00:00Z', finishedAt: null,
    confirmDeadline: new Date(Date.now() + 2 * 3600_000 - 30_000).toISOString().replace(/\.\d+Z$/, 'Z'),
    host: 'you', you: player(1, 'Tester'), opponent: player(2, 'Rival'), winsNeeded: 2,
    score: { you: 1, opponent: 2 },
    games: [
      { n: 1, winner: 'opponent', reportedBy: 'opponent', details: {} },
      { n: 2, winner: 'you', reportedBy: 'opponent', details: {} },
      { n: 3, winner: 'opponent', reportedBy: 'opponent', details: {} },
    ],
    winner: 'opponent', reportedBy: 'opponent', endedBy: null, dispute: null, rewardsUnlocked: [], messages: [],
    ...overrides,
  }
}

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

/** The match room with this match current, recording what the page sends. */
async function inRoom(page: Page, match: Record<string, unknown>) {
  await mockApi(page, { wins: 0 })
  const sent: { method: string; path: string; body: unknown }[] = []
  let current = match
  await page.route('**/api/queue', (r) =>
    r.fulfill(json({ queue: null, match: current.status === 'reported' ? current : null, searching: { '012': 0, nt: 0 }, disputes: [] })),
  )
  await page.route('**/api/matches/42**', (r) => {
    const req = r.request()
    const path = new URL(req.url()).pathname
    if (req.method() !== 'GET') sent.push({ method: req.method(), path, body: req.postDataJSON() })
    if (path.endsWith('/dispute')) {
      const { games, reason } = req.postDataJSON()
      current = { ...current, status: 'disputed', endedBy: 'you', confirmDeadline: null,
        dispute: { games, reason, by: 'you', statements: { you: null, opponent: null } } }
    } else if (path.endsWith('/statement')) {
      const d = current.dispute as { statements: Record<string, unknown> }
      current = { ...current, dispute: { ...d, statements: { ...d.statements, you: { text: req.postDataJSON().text, updatedAt: '2026-11-21T12:00:00Z' } } } }
    }
    return r.fulfill(json(current))
  })
  await page.goto('/match/live')
  return sent
}

test('the opponent disputes through the form: games, a reason, then their statement', async ({ page }) => {
  const sent = await inRoom(page, reportedMatch())
  await page.getByRole('button', { name: 'Dispute' }).click()

  const form = page.getByRole('form', { name: 'Dispute the result' })
  await expect(form).toBeVisible()
  expect((await new AxeBuilder({ page }).include('form[aria-label="Dispute the result"]').analyze()).violations).toEqual([])

  // Both a game and a reason are required.
  await form.getByRole('button', { name: 'Submit dispute' }).click()
  await expect(form.getByText('Tick the games you dispute.')).toBeVisible()
  expect(sent).toEqual([])

  await form.getByRole('checkbox', { name: /Game 3/ }).check()
  await form.getByRole('textbox', { name: 'Why are you disputing?' }).fill('Game 3 was mine, they misreported.')
  await form.getByRole('button', { name: 'Submit dispute' }).click()

  expect(sent).toEqual([
    { method: 'POST', path: '/api/matches/42/dispute', body: { games: [3], reason: 'Game 3 was mine, they misreported.' } },
  ])
  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel).toContainText('Disputed games: 3')
  await expect(panel).toContainText('Game 3 was mine, they misreported.')
  await expect(panel).toContainText('Rival has not added their side yet.')

  await panel.getByRole('textbox', { name: 'Your side' }).fill('Video in Discord.')
  await panel.getByRole('button', { name: 'Save your side' }).click()
  await expect(panel.getByText('Video in Discord.')).toBeVisible()
  expect(sent.at(-1)).toEqual({ method: 'PUT', path: '/api/matches/42/statement', body: { text: 'Video in Discord.' } })
})

test('a reported result shows the countdown to auto-confirm', async ({ page }) => {
  await inRoom(page, reportedMatch())
  await expect(page.getByText(/Confirms automatically in 1:59:\d\d/)).toBeVisible()
})

test('the reporting player gets a notice and can add their side', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  const disputed = reportedMatch({
    status: 'disputed', reportedBy: 'you', winner: 'you', endedBy: 'opponent', confirmDeadline: null,
    dispute: { games: [2], reason: 'I won game 2.', by: 'opponent', statements: { you: null, opponent: { text: 'Lag spike.', updatedAt: '2026-11-21T12:00:00Z' } } },
  })
  await page.route('**/api/queue', (r) =>
    r.fulfill(json({ queue: null, match: null, searching: { '012': 0, nt: 0 },
      disputes: [{ id: 42, game: 'nt', opponent: 'Rival', youReported: true, statementAdded: false }] })),
  )
  await page.route('**/api/matches/42', (r) => r.fulfill(json(disputed)))
  await page.goto('/nt')

  const notice = page.getByRole('status').filter({ hasText: 'Rival disputed your result' })
  await expect(notice).toBeVisible()
  await notice.getByRole('link', { name: 'Add your side' }).click()

  await expect(page).toHaveURL(/\/match\/live\?match=42$/)
  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel).toContainText('I won game 2.')
  await expect(panel).toContainText('Lag spike.')
  await expect(panel.getByRole('textbox', { name: 'Your side' })).toBeVisible()
})

test('a match disputed before the form shows no details', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  const legacy = reportedMatch({
    status: 'disputed', endedBy: 'you', confirmDeadline: null,
    dispute: { games: [], reason: null, by: 'you', statements: { you: null, opponent: null } },
  })
  await page.route('**/api/matches/42', (r) => r.fulfill(json(legacy)))
  await page.goto('/match/live?match=42')
  await expect(page.getByRole('region', { name: 'Dispute' })).toContainText('No details (filed before the dispute form)')
})

test('a Disputed match stays open while you are in a new match, and picks up their side', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  let disputed = reportedMatch({
    status: 'disputed', reportedBy: 'you', winner: 'you', endedBy: 'opponent', confirmDeadline: null,
    dispute: { games: [2], reason: 'I won game 2.', by: 'opponent', statements: { you: null, opponent: null } },
  })
  // Meanwhile the player queued again and is in match 50.
  const current = reportedMatch({ id: 50, status: 'active', score: { you: 0, opponent: 0 }, games: [], winner: null, reportedBy: null, confirmDeadline: null })
  await page.route('**/api/queue', (r) =>
    r.fulfill(json({ queue: null, match: current, searching: { '012': 0, nt: 0 },
      disputes: [{ id: 42, game: 'nt', opponent: 'Rival', youReported: true, statementAdded: false }] })),
  )
  await page.route('**/api/matches/42', (r) => r.fulfill(json(disputed)))
  await page.goto('/nt')
  await page.getByRole('link', { name: 'Add your side' }).click()

  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel).toContainText('I won game 2.')
  await page.waitForTimeout(2500) // a queue poll or two
  await expect(panel).toContainText('I won game 2.')
  await expect(page.getByRole('status').filter({ hasText: 'disputed your result' })).toBeHidden()

  disputed = { ...disputed, dispute: { ...(disputed.dispute as object), statements: { you: null, opponent: { text: 'Lag spike.', updatedAt: 'b' } } } }
  await expect(panel).toContainText('Lag spike.', { timeout: 10_000 })
})
