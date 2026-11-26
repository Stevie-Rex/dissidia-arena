import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApi, modeName } from './mock'

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

const hero = (page: Page) => page.getByRole('region', { name: 'Dissidia Arena' })

test.describe('Rift Home', () => {
  test('opens on the hero with one h1 and a Queue key', async ({ page }) => {
    await mockApi(page, { wins: null })
    await page.goto('/')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(hero(page).getByRole('heading', { level: 1, name: 'Dissidia Arena' })).toBeVisible()
    await expect(hero(page)).toContainText('Ranked 1v1 for Dissidia 012 and NT.')
    await expect(hero(page).getByRole('button', { name: 'Queue' })).toBeVisible()
    await expect(hero(page).getByRole('link', { name: 'Read the rules' })).toHaveAttribute('href', /^\/(012|nt)$/)
  })

  test('signed out, Queue asks to sign in, the searching panel shows 0 and there is no match panel', async ({ page }) => {
    await mockApi(page, { wins: null })
    await page.goto('/')
    const searching = page.getByRole('region', { name: /^Searching now/ })
    await expect(searching).toContainText('0')
    await expect(page.getByRole('region', { name: 'Your match' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Pre-season' })).toContainText('Wins still count before Season 1.')
    await hero(page).getByRole('button', { name: 'Queue' }).click()
    await expect(page.getByRole('dialog')).toContainText(/sign in/i)
  })

  test('signed in, the panels show the real search count and your open match', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await queueState(page, { match: openMatch, searching: { '012': 4, nt: 7 } })
    await page.goto('/nt')
    await page.goto('/')
    const searching = page.getByRole('region', { name: 'Searching now · NT' })
    await expect(searching).toContainText('7')
    const match = page.getByRole('region', { name: 'Your match' })
    await expect(match).toContainText('1–1')
    await expect(match).toContainText('vs Rival')
    await match.getByRole('link', { name: 'Go to match' }).click()
    await expect(page).toHaveURL(/\/match\/live$/)
  })

  test('signed in, Queue goes to the queue page', async ({ page }) => {
    await mockApi(page, { wins: 3 })
    await page.goto('/')
    await page.getByRole('region', { name: /^Searching now/ }).getByRole('button', { name: 'Queue' }).click()
    await expect(page).toHaveURL(/\/queue$/)
  })

  test("in Cosmos mode the searching panel's Queue is the same blue key as the hero's", async ({ page }) => {
    await mockApi(page, { wins: 3, prefs: { rift_mode: 'cosmos' } })
    await page.goto('/')
    const face = (button: ReturnType<Page['getByRole']>) => button.evaluate((el) => getComputedStyle(el).backgroundImage)
    const heroKey = await face(hero(page).getByRole('button', { name: 'Queue' }))
    const panelKey = page.getByRole('region', { name: /^Searching now/ }).getByRole('button', { name: 'Queue' })
    await expect.poll(() => face(panelKey)).toBe(heroKey)
  })

  test('recent battles: the empty state before your first ranked battle, then your record', async ({ page }) => {
    await mockApi(page, { wins: 0 })
    await page.goto('/')
    const recent = page.getByRole('region', { name: 'Recent battles' })
    await expect(recent).toContainText('No battles fought yet. The Rift is waiting.')
    await expect(recent.getByRole('button', { name: 'Queue' })).toBeVisible()
  })

  test('recent battles shows your ranked record once you have one', async ({ page }) => {
    await mockApi(page, { wins: 3, losses: 2 })
    await page.goto('/')
    const recent = page.getByRole('region', { name: 'Recent battles' })
    await expect(recent).toContainText('5 ranked battles: 3 won, 2 lost.')
    await expect(recent.getByRole('link', { name: 'See your profile' })).toHaveAttribute('href', '/players/me')
  })
})


for (const mode of ['chaos', 'cosmos'] as const) {
  test(`Home and Welcome fit a phone in ${modeName(mode)}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockApi(page, { wins: 0, prefs: { rift_mode: mode }, onboarded: false })

    for (const { path, heading } of [{ path: '/', heading: 'Dissidia Arena' }, { path: '/welcome', heading: 'Welcome, Tester' }]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-rift-mode', mode)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    }
    const result = await new AxeBuilder({ page }).analyze()
    expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([])
  })
}

for (const mode of ['chaos', 'cosmos'] as const) {
  test(`on a short desktop the hero leaves the first row of panels in view in ${modeName(mode)}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await mockApi(page, { wins: 3, prefs: { rift_mode: mode } })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-rift-mode', mode)
    const strip = (await page.locator('.rift-helpstrip').boundingBox())!
    for (const name of [/^Searching now/, 'Pre-season']) {
      const panel = page.getByRole('region', { name })
      await expect(panel).toBeInViewport({ ratio: 1 })
      const { y, height } = (await panel.boundingBox())!
      expect(y + height, 'the panel clears the help strip').toBeLessThanOrEqual(strip.y)
    }
    const copy = (await hero(page).getByRole('heading', { level: 1 }).locator('..').boundingBox())!
    const box = (await hero(page).boundingBox())!
    const gap = box.y + box.height - (copy.y + copy.height)
    expect(gap, 'copy sits about 44px above the bottom of the hero').toBeGreaterThanOrEqual(36)
    expect(gap).toBeLessThanOrEqual(52)
  })
}
