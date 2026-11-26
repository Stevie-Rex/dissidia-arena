import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './mock'

// The Match found dialog (#47): Crystal shatter once per found match, Accept usable at once, focus kept inside,
// and nothing moving under reduced motion. The queue state comes from a faked /api/queue.

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString().replace(/\.\d+Z$/, 'Z')
const player = (id: number, displayName: string, accepted = false) => ({ id, displayName, avatarUrl: '', region: 'EU', gameId: `id${id}`, accepted })

function match(overrides: Record<string, unknown> = {}) {
  return {
    id: 42, game: '012', mode: '1v1', bestOf: 3, platform: 'PS4', region: 'EU', status: 'pending',
    acceptDeadline: iso(42_000), createdAt: iso(-1000), finishedAt: null, confirmDeadline: null, replayDeadline: null,
    replayNotFinished: false, host: 'you', you: player(1, 'Tester'), opponent: player(2, 'Rival'), winsNeeded: 2,
    score: { you: 0, opponent: 0 }, games: [], winner: null, reportedBy: null, endedBy: null, dispute: null, ruling: null,
    rewardsUnlocked: [], messages: [], canAskAdmin: false, helpRequest: null,
    ...overrides,
  }
}

/** Signed in with a pending match. Accept marks you accepted; `start()` lets the opponent accept too. */
async function found(page: Page, mode: 'chaos' | 'cosmos' = 'chaos') {
  await mockApi(page, { wins: 3, prefs: { rift_mode: mode } })
  let current: ReturnType<typeof match> | null = match()
  const sent: string[] = []
  await page.route('**/api/queue', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ queue: null, match: current, searching: { '012': 4, nt: 1 }, disputes: [] }) }),
  )
  await page.route('**/api/matches/42**', (r) => {
    const req = r.request()
    const action = new URL(req.url()).pathname.split('/').pop()
    if (req.method() !== 'GET') sent.push(`${req.method()} ${action}`)
    if (action === 'accept' && current) current = { ...current, you: player(1, 'Tester', true) }
    if (action === 'decline') current = null
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current ?? match({ status: 'declined' })) })
  })
  return { sent, start: () => { current = match({ status: 'active', you: player(1, 'Tester', true), opponent: player(2, 'Rival', true) }) } }
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Match found' })
const card = (page: Page) => page.getByRole('region', { name: 'Match status' })
const accept = (page: Page) => dialog(page).getByRole('button', { name: 'Accept', exact: true })
const running = (page: Page) => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
})

test('a found match opens the dialog with Accept focused, the countdown inside, and the card hidden', async ({ page }) => {
  await found(page)
  await page.goto('/rewards')
  await expect(dialog(page)).toBeVisible()
  await expect(accept(page)).toBeFocused()
  await expect(dialog(page)).toContainText('Tester')
  await expect(dialog(page)).toContainText('Rival')
  await expect(dialog(page)).toContainText('012 · 1v1 Bo3 · EU')
  await expect(dialog(page)).toContainText(/0:[34]\d/)
  await expect(card(page)).toBeHidden()
})

test('the shatter plays without delaying Accept', async ({ page }) => {
  const { sent } = await found(page)
  await page.goto('/rewards')
  await expect(dialog(page)).toBeVisible()
  expect(await running(page)).toBeGreaterThan(0)
  // Nothing in the effect layer sits over the key, and the key takes a press while the shatter still runs.
  const onTop = await accept(page).evaluate((key) => {
    const box = key.getBoundingClientRect()
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === key
  })
  expect(onTop).toBe(true)
  await page.keyboard.press('Enter')
  await expect.poll(() => sent).toContain('POST accept')
  expect(await running(page)).toBeGreaterThan(0)
})

test('after Accept the dialog waits for the opponent, then the match room opens', async ({ page }) => {
  const { start } = await found(page)
  await page.goto('/rewards')
  await accept(page).click()
  await expect(dialog(page).getByRole('status')).toHaveText('Waiting for Rival')
  await expect(accept(page)).toBeHidden()
  await expect(dialog(page)).toBeFocused()
  start()
  await expect(page).toHaveURL(/\/match\/live$/)
  await expect(dialog(page)).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Match room' })).toBeFocused()
})

test('focus stays in the dialog, and Escape declines', async ({ page }) => {
  const { sent } = await found(page)
  await page.goto('/rewards')
  const decline = dialog(page).getByRole('button', { name: 'Decline' })
  await expect(accept(page)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(decline).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(accept(page)).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(decline).toBeFocused()
  await page.keyboard.press('Escape')
  await expect.poll(() => sent).toContain('POST decline')
  await expect(dialog(page)).toBeHidden()
})

test('the shatter plays once per match, not again after a reload', async ({ page }) => {
  await found(page)
  await page.goto('/rewards')
  await expect(dialog(page)).toBeVisible()
  expect(await running(page)).toBeGreaterThan(0)
  await page.reload()
  await expect(dialog(page)).toBeVisible()
  await expect(accept(page)).toBeFocused()
  expect(await running(page)).toBe(0)
})

test('the match room is not covered by the dialog', async ({ page }) => {
  await found(page)
  await page.goto('/match/live')
  await expect(page.getByRole('main').getByRole('button', { name: 'Accept', exact: true })).toBeVisible()
  await expect(dialog(page)).toBeHidden()
})

for (const mode of ['chaos', 'cosmos'] as const) {
  for (const width of [1440, 390]) {
    test(`reduced motion in ${mode} mode at ${width}px: still, announced, and Accept works`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 844 })
      const { sent } = await found(page, mode)
      await page.goto('/rewards')
      await expect(dialog(page)).toBeVisible()
      await expect(dialog(page)).toHaveAttribute('aria-modal', 'true')
      await expect(dialog(page).getByText('Match found', { exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)

      // The key darkens when pressed but doesn't move.
      const box = (await accept(page).boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      expect(await accept(page).evaluate((key) => getComputedStyle(key).transform)).toBe('none')
      await page.mouse.down()
      expect(await accept(page).evaluate((key) => getComputedStyle(key).transform)).toBe('none')
      await page.mouse.up()
      await expect.poll(() => sent).toContain('POST accept')
    })
  }

  test(`the dialog passes axe in ${mode} mode`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await found(page, mode)
    await page.goto('/rewards')
    await expect(dialog(page)).toBeVisible()
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(results.violations).toEqual([])
  })
}

test('keys lift on hover and sink on press when motion is allowed', async ({ page }) => {
  await mockApi(page, { wins: 3 })
  await page.goto('/queue')
  const key = page.getByRole('main').getByRole('button', { name: 'Queue', exact: true })
  const box = (await key.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect.poll(() => key.evaluate((k) => getComputedStyle(k).transform)).not.toBe('none')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => key.evaluate((k) => getComputedStyle(k).transform)).toBe('none')
})
