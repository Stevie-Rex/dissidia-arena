import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './mock'

// The searching and match-ready status card (#44): the floating card in the bottom-right corner on desktop, above
// the tab bar on phones. It follows the queue state polling, so these tests fake /api/queue.

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString().replace(/\.\d+Z$/, 'Z')
const player = (id: number, displayName: string, accepted = false) => ({ id, displayName, avatarUrl: '', region: 'EU', gameId: `id${id}`, accepted })

const entry = () => ({ game: '012', mode: '1v1', bestOf: 3, platform: 'PS4', region: 'EU', joinedAt: iso(-65_000), source: 'web' })

function match(overrides: Record<string, unknown> = {}) {
  return {
    id: 42, game: '012', mode: '1v1', bestOf: 3, platform: 'PS4', region: 'EU', status: 'pending',
    acceptDeadline: iso(42_000), createdAt: iso(-1000), finishedAt: null, confirmDeadline: null,
    host: 'you', you: player(1, 'Tester'), opponent: player(2, 'Rival'), winsNeeded: 2,
    score: { you: 0, opponent: 0 }, games: [], winner: null, reportedBy: null, endedBy: null, dispute: null,
    rewardsUnlocked: [], messages: [], canAskAdmin: false, helpRequest: null,
    ...overrides,
  }
}

type Queue = { queue: unknown; match: unknown }

/** Signed in, with a queue state the test can change. Records the queue and match calls the page sends. */
async function withQueue(page: Page, start: Queue) {
  await mockApi(page, { wins: 3 })
  const state = { current: start }
  const sent: string[] = []
  await page.route('**/api/queue', (r) => {
    const method = r.request().method()
    if (method !== 'GET') sent.push(`${method} /api/queue`)
    if (method === 'DELETE') state.current = { queue: null, match: null }
    if (method === 'POST') state.current = { queue: entry(), match: null }
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...state.current, searching: { '012': 4, nt: 1 }, disputes: [] }),
    })
  })
  await page.route('**/api/matches/42**', (r) => {
    const req = r.request()
    if (req.method() !== 'GET') sent.push(`${req.method()} ${new URL(req.url()).pathname}`)
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.current.match ?? match()) })
  })
  return { state, sent }
}

const card = (page: Page) => page.getByRole('region', { name: 'Match status' })

test.describe('Match status card', () => {
  test('a search started from Queue shows on other pages, and Cancel there leaves the queue', async ({ page }) => {
    const { sent } = await withQueue(page, { queue: null, match: null })
    await page.goto('/queue')
    await page.getByRole('main').getByRole('button', { name: 'Queue', exact: true }).click()
    await expect.poll(() => sent).toContain('POST /api/queue')

    for (const path of ['/rewards', '/012']) {
      await page.goto(path)
      await expect(card(page)).toBeVisible()
      await expect(card(page)).toContainText('Searching')
      await expect(card(page)).toContainText('012 · 1v1 Bo3 · EU')
      await expect(card(page)).toContainText('4 in queue')
      await expect(card(page)).toContainText(/[01]:\d\d/)
    }

    await card(page).getByRole('button', { name: 'Cancel' }).click()
    await expect.poll(() => sent).toContain('DELETE /api/queue')
    await expect(card(page)).toBeHidden()
  })
})

test('a found match opens the dialog on a phone and can be accepted there', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 })
  const { sent } = await withQueue(page, { queue: null, match: match() })
  await page.goto('/rewards')
  const dialog = page.getByRole('dialog', { name: 'Match found' })
  await expect(dialog).toBeVisible()
  await expect(card(page)).toBeHidden()
  await dialog.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect.poll(() => sent).toContain('POST /api/matches/42/accept')
})

test('a found match can still be accepted from its room', async ({ page }) => {
  const { sent } = await withQueue(page, { queue: null, match: match() })
  await page.goto('/match/live')
  await expect(page.getByRole('dialog', { name: 'Match found' })).toBeHidden()
  await page.getByRole('main').getByRole('button', { name: 'Accept', exact: true }).click()
  await expect.poll(() => sent).toContain('POST /api/matches/42/accept')
})

test('an open match links back to its room', async ({ page }) => {
  await withQueue(page, { queue: null, match: match({ status: 'active' }) })
  await page.goto('/rewards')
  await expect(card(page)).toContainText('Match in progress')
  await card(page).getByRole('link', { name: 'Go to match' }).click()
  await expect(page).toHaveURL(/\/match\/live$/)
  await expect(page.getByRole('main')).toContainText('Rival')
  await expect(card(page)).toBeHidden()
})

test('the match found sound setting survives a reload', async ({ page }) => {
  await mockApi(page, { wins: 3 })
  await page.goto('/config')
  const sound = page.getByRole('checkbox', { name: 'Match found sound' })
  await expect(sound).toBeChecked()
  await sound.uncheck()
  await page.reload()
  await expect(sound).not.toBeChecked()
})

test('the Match found dialog scrolls when the screen is too short for it', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 300 })
  await withQueue(page, { queue: null, match: match() })
  await page.goto('/rewards')
  const dialog = page.getByRole('dialog', { name: 'Match found' })
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(300)
  const decline = dialog.getByRole('button', { name: 'Decline' })
  await decline.scrollIntoViewIfNeeded()
  await expect(decline).toBeInViewport()
})
