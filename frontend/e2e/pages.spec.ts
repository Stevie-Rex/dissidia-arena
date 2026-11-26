import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApi, modeName } from './mock'

const html = (page: Page) => page.locator('html')
const main = (page: Page) => page.getByRole('main')

test.describe('Rift Config', () => {
  test('a ◀ value ▶ picker sets Chaos mode or Cosmos mode and saves it', async ({ page }) => {
    const server = await mockApi(page, { wins: 12 })
    await page.goto('/config')
    const mode = main(page).getByRole('spinbutton', { name: 'Mode' })
    await expect(mode).toHaveAttribute('aria-valuetext', 'Chaos mode')
    await mode.focus()
    await page.keyboard.press('ArrowRight')
    await expect(mode).toHaveAttribute('aria-valuetext', 'Cosmos mode')
    await expect(html(page)).toHaveAttribute('data-rift-mode', 'cosmos')
    await expect.poll(() => server.patches).toContainEqual({ rift_mode: 'cosmos' })
    // The arrows work with the pointer too, and the list wraps round.
    await main(page).getByRole('button', { name: 'Next Mode' }).click()
    await expect(mode).toHaveAttribute('aria-valuetext', 'Chaos mode')
    await expect(html(page)).toHaveAttribute('data-rift-mode', 'chaos')
  })

  test('shows the interface choice and points to Classic options, with no worlds', async ({ page }) => {
    await mockApi(page, { wins: 12 })
    await page.goto('/config')
    await expect(main(page)).not.toContainText(/world/i)
    await expect(main(page).getByText(/Window themes, menu fonts and the cursor/)).toBeVisible()
    await main(page).getByRole('group', { name: 'Interface' }).getByRole('button', { name: /classic/i }).click()
    await expect(html(page)).toHaveAttribute('data-interface', 'classic')
  })
})

// #50: the restyled pages pass axe in both modes, at desktop and phone width.
const PAGES = [
  { path: '/players/me', heading: 'Tester' },
  { path: '/players/me/edit', heading: /edit/i },
  { path: '/matches/m-1001', heading: 'Match details' },
  { path: '/012/ladder', heading: /ladder/i },
  { path: '/config', heading: 'Your look' },
]
for (const mode of ['chaos', 'cosmos'] as const) {
  for (const width of [1440, 390]) {
    test(`Profile, Profile edit, Match details, Ladder and Config pass axe in ${modeName(mode)} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockApi(page, { wins: 12, prefs: { rift_mode: mode } })
      const found: { path: string; id: string; targets: unknown[] }[] = []
      for (const { path, heading } of PAGES) {
        await page.goto(path)
        await expect(html(page)).toHaveAttribute('data-rift-mode', mode)
        await expect(main(page).getByRole('heading', { level: 1, name: heading })).toBeVisible()
        const { violations } = await new AxeBuilder({ page }).analyze()
        for (const { id, nodes } of violations) found.push({ path, id, targets: nodes.map(({ target }) => target) })
      }
      expect(found).toEqual([])
    })
  }
}
