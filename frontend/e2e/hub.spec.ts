import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './mock'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const player = (id: number, displayName: string) => ({ id, displayName, avatarUrl: '', region: 'EU', gameId: `id${id}`, accepted: true })

/** An active NT match against Rival, one game each. */
const openMatch = {
  id: 42, game: 'nt', mode: '1v1', bestOf: 3, platform: 'PS4', region: 'EU', status: 'active',
  acceptDeadline: '2026-11-21T10:00:00Z', createdAt: '2026-11-21T10:00:00Z', finishedAt: null, confirmDeadline: null,
  host: 'you', you: player(1, 'Tester'), opponent: player(2, 'Rival'), winsNeeded: 2,
  score: { you: 1, opponent: 1 },
  games: [
    { n: 1, winner: 'you', reportedBy: 'you', details: {} },
    { n: 2, winner: 'opponent', reportedBy: 'you', details: {} },
  ],
  winner: null, reportedBy: null, endedBy: null, dispute: null, rewardsUnlocked: [], messages: [],
}

async function queueState(page: Page, state: { match?: unknown; searching?: Record<string, number> }) {
  await page.route('**/api/queue', (r) =>
    r.fulfill(json({ queue: null, match: state.match ?? null, searching: state.searching ?? { '012': 0, nt: 0 }, disputes: [] })),
  )
}

const banner = (page: Page, name: string | RegExp) => page.getByRole('region', { name })

test.describe('Rift Hub', () => {
  test('has one h1 naming the game', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await page.goto('/012')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Hub/)
    await expect(page.getByRole('main')).toContainText('Dissidia 012 Duodecim')
  })

  test('signed in, the queue banner shows the real search count for this game and region', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await queueState(page, { searching: { '012': 7, nt: 2 } })
    await page.goto('/012')
    const queue = banner(page, /^Ranked · 012/)
    await expect(queue).toContainText('EU')
    await expect(queue.getByText('7', { exact: true })).toBeVisible()
    await expect(queue).toContainText('players searching now')
    await page.goto('/nt')
    await expect(banner(page, /^Ranked · NT/).getByText('2', { exact: true })).toBeVisible()
    await expect(banner(page, /^Ranked · NT/)).toContainText('players searching now')
  })

  test('one player searching reads in the singular', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await queueState(page, { searching: { '012': 1, nt: 0 } })
    await page.goto('/012')
    await expect(banner(page, /^Ranked · 012/)).toContainText('player searching now')
    await expect(banner(page, /^Ranked · 012/)).not.toContainText('players')
  })

  test('signed in, Queue picks this game and goes to the queue page', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await page.goto('/nt')
    await banner(page, /^Ranked · NT/).getByRole('button', { name: 'Queue' }).click()
    await expect(page).toHaveURL(/\/queue$/)
  })

  test('signed out, the queue banner asks you to sign in instead of showing a count', async ({ page }) => {
    await mockApi(page, { wins: null })
    await page.goto('/012')
    const queue = banner(page, /^Ranked · 012/)
    await expect(queue).toContainText('Sign in to queue and see who is searching')
    await expect(queue).not.toContainText('searching now')
    await queue.getByRole('button', { name: 'Queue' }).click()
    await expect(page.getByRole('dialog')).toContainText(/sign in/i)
  })

  test('with an open match, its banner shows the score, the opponent and the next game, and links to it', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await queueState(page, { match: openMatch })
    await page.goto('/012')
    const match = banner(page, /^Open match/)
    await expect(match).toContainText('1–1')
    await expect(match).toContainText('vs Rival')
    await expect(match).toContainText('Game 3 next')
    await match.getByRole('link', { name: 'Go to match' }).click()
    await expect(page).toHaveURL(/\/match\/live$/)
  })

  test('once a result is reported, the match banner says so instead of naming the next game', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await queueState(page, { match: { ...openMatch, status: 'reported', score: { you: 2, opponent: 1 } } })
    await page.goto('/012')
    const match = banner(page, /^Open match/)
    await expect(match).toContainText('2–1')
    await expect(match).toContainText('Result reported')
    await expect(match).not.toContainText('next')
  })

  test('without an open match there is no match banner', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await queueState(page, { match: { ...openMatch, status: 'confirmed' } })
    await page.goto('/012')
    await expect(banner(page, /^Ranked · 012/)).toBeVisible()
    await expect(banner(page, /^Open match/)).toHaveCount(0)
  })

  test('the season banner says the pre-season is on', async ({ page }) => {
    await mockApi(page, { wins: null })
    await page.goto('/nt')
    await expect(banner(page, 'Season status')).toContainText('Pre-season: wins still count before Season 1')
  })

  test('shows no invented data', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await page.goto('/012')
    await expect(banner(page, 'Season status')).toBeVisible()
    const main = page.getByRole('main')
    for (const text of ['Player A', 'Player B', 'Recent matches', 'online', 'days left', 'Find match', '#212']) {
      await expect(main).not.toContainText(text)
    }
  })
})

test.describe('Classic Hub', () => {
  const classic = { prefs: { interface: 'classic' } }

  test('shows no invented data', async ({ page }) => {
    await mockApi(page, { wins: 3, ...classic })
    await page.goto('/012')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dissidia 012 Duodecim')
    const main = page.getByRole('main')
    for (const text of ['Player A', 'Player B', 'Recent matches', 'online', 'days left', '#212', 'Ladder · ']) {
      await expect(main).not.toContainText(text)
    }
  })

  test('shows the real search count for this game', async ({ page }) => {
    await mockApi(page, { wins: 3, ...classic })
    await queueState(page, { searching: { '012': 7, nt: 2 } })
    await page.goto('/012')
    await expect(page.getByRole('main')).toContainText('7 players searching now')
    await page.goto('/nt')
    await expect(page.getByRole('main')).toContainText('2 players searching now')
  })

  test('signed out, asks you to sign in instead of showing a count', async ({ page }) => {
    await mockApi(page, { wins: null, ...classic })
    await page.goto('/012')
    const main = page.getByRole('main')
    await expect(main).toContainText('Sign in to queue and see who is searching')
    await expect(main).not.toContainText('searching now')
  })

  test('with an open match, links to it', async ({ page }) => {
    await mockApi(page, { wins: 3, ...classic })
    await queueState(page, { match: openMatch })
    await page.goto('/012')
    const main = page.getByRole('main')
    await expect(main).toContainText('vs Rival')
    await main.getByRole('link', { name: 'Go to match' }).click()
    await expect(page).toHaveURL(/\/match\/live$/)
  })

  test('says the pre-season is on, and Find match goes to the queue', async ({ page }) => {
    await mockApi(page, { wins: 3, ...classic })
    await page.goto('/nt')
    await expect(page.getByRole('main')).toContainText('Pre-season: wins still count before Season 1')
    await page.getByRole('button', { name: 'Find match' }).first().click()
    await expect(page).toHaveURL(/\/queue$/)
  })
})

for (const mode of ['chaos', 'cosmos'] as const) {
  test(`Hub fits a phone in ${mode} mode, with each action on its own row`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockApi(page, { wins: 3, prefs: { rift_mode: mode } })
    await queueState(page, { match: openMatch, searching: { '012': 7, nt: 2 } })
    await page.goto('/012')
    await expect(page.locator('html')).toHaveAttribute('data-rift-mode', mode)
    const match = banner(page, /^Open match/)
    await expect(match).toContainText('Game 3 next')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    // The action sits below the banner's text, not squeezed beside it.
    for (const b of [banner(page, /^Ranked · 012/), match]) {
      const text = await b.getByText(/searching now|vs Rival/).boundingBox()
      const action = await b.getByRole(b === match ? 'link' : 'button').boundingBox()
      expect(action!.y).toBeGreaterThanOrEqual(text!.y + text!.height - 1)
    }
    // "Game 3 next" stays on one line.
    const next = await match.getByText('Game 3 next').boundingBox()
    expect(next!.height).toBeLessThan(40)

    const result = await new AxeBuilder({ page }).analyze()
    expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([])
  })

  test(`Hub passes axe at desktop width in ${mode} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockApi(page, { wins: 3, prefs: { rift_mode: mode } })
    await queueState(page, { match: openMatch, searching: { '012': 7, nt: 2 } })
    await page.goto('/012')
    await expect(banner(page, /^Open match/)).toBeVisible()
    // Hover a banner, so the selection-blue state is checked too.
    await banner(page, /^Ranked · 012/).hover()
    const result = await new AxeBuilder({ page }).analyze()
    expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([])
  })
}

test('on a short phone, the Searching card clears the Queue action and the end of the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 })
  await mockApi(page, { wins: 3 })
  const joinedAt = new Date(Date.now() - 30_000).toISOString().replace(/\.\d+Z$/, 'Z')
  await page.route('**/api/queue', (r) =>
    r.fulfill(json({ queue: { game: '012', mode: '1v1', bestOf: 3, platform: 'PS4', region: 'EU', joinedAt, source: 'web' }, match: null, searching: { '012': 4, nt: 1 }, disputes: [] })),
  )
  await page.goto('/012')
  const status = page.getByRole('region', { name: 'Match status' })
  await expect(status).toContainText('Searching')
  // The Queue key can be reached: nothing sits on top of it.
  await banner(page, /^Ranked · 012/).getByRole('button', { name: 'Queue' }).click({ trial: true })
  // Scrolled into view, the last panel ends above the card.
  const rules = page.getByRole('main').getByText(/^PPSSPP/)
  await rules.scrollIntoViewIfNeeded()
  const box = await rules.boundingBox()
  const card = await status.boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(card!.y)
})
