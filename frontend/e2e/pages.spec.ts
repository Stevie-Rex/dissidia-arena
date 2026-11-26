import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './mock'

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

test('Rewards and the player card agree on the next unlock', async ({ page }) => {
  await mockApi(page, { wins: 12 })
  await page.goto('/rewards')

  const progress = page.getByRole('progressbar', { name: /^Progress to/ })
  await expect(progress).toHaveCount(2)
  await expect(progress.first()).toHaveAttribute('aria-valuenow', '80')
  await expect(progress.last()).toHaveAttribute('aria-valuenow', '80')
  await expect(main(page).getByRole('heading', { name: 'Classic interface', exact: true })).toBeVisible()
  await expect(main(page).getByText(/3 wins to .*12\/15/)).toBeVisible()
})
