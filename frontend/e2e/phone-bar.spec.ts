import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApi, modeName } from './mock'

const PHONE = { width: 390, height: 844 }
const bar = (page: Page) => page.getByRole('navigation', { name: 'Phone navigation' })
const tile = (page: Page, name: string) => bar(page).getByRole('link', { name, exact: true })

test.use({ viewport: PHONE })

test.describe('Rift phone bottom bar', () => {
  test('five tiles replace the sidebar, and the current one is marked', async ({ page }) => {
    await mockApi(page, { wins: 12 })
    await page.goto('/012/ladder')
    await expect(page.getByRole('complementary', { name: 'Sidebar' })).toBeHidden()
    await expect(bar(page).getByRole('link')).toHaveText(['Hub', 'Ladder', 'Queue', 'Profile', 'More'])
    await expect(tile(page, 'Ladder')).toHaveAttribute('aria-current', 'page')
    await expect(bar(page).locator('[aria-current]')).toHaveCount(1)
    await tile(page, 'Queue').click()
    await expect(page).toHaveURL(/\/queue$/)
    await expect(tile(page, 'Queue')).toHaveAttribute('aria-current', 'page')
    await tile(page, 'Hub').click()
    await expect(page).toHaveURL(/\/012$/)
    await expect(tile(page, 'Hub')).toHaveAttribute('aria-current', 'page')
    await page.getByRole('button', { name: 'NT', exact: true }).click()
    await expect(page).toHaveURL(/\/nt$/)
    await expect(tile(page, 'Ladder')).toHaveAttribute('href', '/nt/ladder')

    // Scroll to the very end: scrollIntoViewIfNeeded only centres the footer, which on a short page leaves it under the bar.
    const footer = page.getByRole('contentinfo')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const footerBox = await footer.boundingBox()
    const barBox = await bar(page).boundingBox()
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(barBox!.y + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width)
  })

  test('the tiles are all the same size', async ({ page }) => {
    await mockApi(page, { wins: 12 })
    await page.goto('/012')
    const boxes = await bar(page).getByRole('link').evaluateAll((els) => els.map((el) => [el.clientWidth, el.clientHeight]))
    expect(new Set(boxes.map((b) => b.join('x'))).size, JSON.stringify(boxes)).toBe(1)
    expect(boxes[0][1]).toBeGreaterThanOrEqual(44)
  })

  test('Classic keeps no bottom bar', async ({ page }) => {
    await mockApi(page, { wins: 60, prefs: { interface: 'classic' } })
    await page.goto('/012')
    await expect(page.locator('html')).toHaveAttribute('data-interface', 'classic')
    await expect(bar(page)).toHaveCount(0)
  })

  test('desktop has no bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await mockApi(page, { wins: 12 })
    await page.goto('/012')
    await expect(bar(page)).toBeHidden()
  })
})

for (const rift_mode of ['chaos', 'cosmos']) {
  test(`phone More exposes player and Admin destinations in ${modeName(rift_mode)}`, async ({ page }) => {
    await mockApi(page, { wins: 12, role: 'master', prefs: { rift_mode } })
    await page.goto('/012')
    await tile(page, 'More').click()
    await expect(page.getByRole('heading', { name: 'More', exact: true })).toBeVisible()
    await expect(page.getByRole('progressbar')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admin log' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admins', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /switch to .* mode/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Feedback/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.getByRole('link', { name: 'Rewards' }).click()
    await expect(page).toHaveURL(/\/rewards$/)
    await expect(tile(page, 'More')).toHaveAttribute('aria-current', 'page')
  })
}

test('players can reach Settings through More without seeing Admin links', async ({ page }) => {
  await mockApi(page, { wins: 12 })
  await page.goto('/more')
  await expect(page.getByRole('progressbar')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/config$/)
})
