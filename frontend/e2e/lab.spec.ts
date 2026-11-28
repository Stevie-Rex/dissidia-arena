import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Lab, round 3 (#70): every scenario opens on sample data, with no backend and no sign-in. This branch never merges.
test('every lab scenario opens without the backend', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/lab')
  await page.locator('.lab-index__links a').first().waitFor()
  const links = await page.locator('.lab-index__links a').evaluateAll((as) => as.map((a) => a.getAttribute('href')!))
  expect(links.length).toBeGreaterThan(30)

  const leaks: string[] = []
  const errors: string[] = []
  // Any /api call that reaches the network means the fake API missed it.
  await page.route('**/api/**', (route) => {
    leaks.push(route.request().url())
    return route.fulfill({ status: 500, body: '{}' })
  })
  page.on('pageerror', (e) => errors.push(e.message))

  for (const href of links) {
    await page.goto(href)
    await expect(page.getByRole('main'), href).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Lab controls' }), href).toBeVisible()
    await page.waitForTimeout(300)
    const violations = (await new AxeBuilder({ page }).include('main').analyze()).violations
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`), href).toEqual([])
  }
  expect(leaks).toEqual([])
  expect(errors).toEqual([])
})
