import { expect, test, type Page } from '@playwright/test'
import type { Role } from '../src/lib/api'
import { mockApi, modeName } from './mock'

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Sidebar' })
const nav = (page: Page) => sidebar(page).getByRole('navigation', { name: 'Main' })
const games = (page: Page) => sidebar(page).getByRole('group', { name: 'Game' })

test.describe('Rift sidebar on desktop', () => {
  test('replaces the top navigation and the Friends column', async ({ page }) => {
    await mockApi(page, { wins: 12 })
    await page.goto('/012')
    await expect(sidebar(page)).toBeVisible()
    for (const name of ['Hub', 'Queue', 'Ladder', 'Profile', 'Rewards']) await expect(nav(page).getByRole('link', { name, exact: true })).toBeVisible()
    await expect(page.getByRole('banner')).toBeHidden()
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(1)
    await expect(page.getByText('From your Discord server')).toHaveCount(0)
  })

  test('the game switcher changes the current game on every page', async ({ page }) => {
    await mockApi(page, { wins: 12 })
    await page.goto('/012/ladder')
    await games(page).getByRole('button', { name: 'NT' }).click()
    await expect(page).toHaveURL(/\/nt\/ladder$/)
    await expect(games(page).getByRole('button', { name: 'NT' })).toHaveAttribute('aria-pressed', 'true')
    await expect(nav(page).getByRole('link', { name: 'Ladder' })).toHaveAttribute('aria-current', 'page')
    // A page that isn't per game stays put, and the game's links follow the switch.
    await page.goto('/rewards')
    await games(page).getByRole('button', { name: '012' }).click()
    await expect(page).toHaveURL(/\/rewards$/)
    await expect(games(page).getByRole('button', { name: '012' })).toHaveAttribute('aria-pressed', 'true')
    await expect(nav(page).getByRole('link', { name: 'Hub' })).toHaveAttribute('href', '/012')
    await games(page).getByRole('button', { name: 'NT' }).click()
    await expect(nav(page).getByRole('link', { name: 'Hub' })).toHaveAttribute('href', '/nt')
    await expect(nav(page).getByRole('link', { name: 'Ladder' })).toHaveAttribute('href', '/nt/ladder')
  })

  test('the player card shows ranked wins and the next unlock, the same as Rewards', async ({ page }) => {
    await mockApi(page, { wins: 12 })
    await page.goto('/rewards')
    await expect(sidebar(page)).toContainText('12 ranked wins')
    await expect(sidebar(page)).toContainText('Next: Crystal window')
    await expect(sidebar(page)).toContainText('12/15')
    const bar = sidebar(page).getByRole('progressbar', { name: 'Progress to Crystal window' })
    await expect(bar).toHaveAttribute('aria-valuenow', '80')
    const rewards = page.getByRole('main')
    await expect(rewards.getByRole('progressbar', { name: 'Progress to Crystal window' })).toHaveAttribute('aria-valuenow', '80')
    await expect(rewards.getByText('3 wins to Crystal window · 12/15')).toBeVisible()
    await expect(rewards.getByRole('heading', { name: 'Classic interface', exact: true })).toBeVisible()
  })

  test('the player card says when every reward is unlocked', async ({ page }) => {
    await mockApi(page, { wins: 60 })
    await page.goto('/012')
    await expect(sidebar(page)).toContainText('60 ranked wins')
    await expect(sidebar(page).getByRole('progressbar', { name: 'Every reward unlocked' })).toHaveAttribute('aria-valuenow', '100')
    await expect(sidebar(page)).not.toContainText('Next:')
  })

  test('signed out, the player card offers sign-in', async ({ page }) => {
    await mockApi(page, { wins: null })
    await page.goto('/012')
    await expect(sidebar(page).getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(sidebar(page)).not.toContainText(/\d+ ranked win/)
    await expect(sidebar(page).getByRole('progressbar')).toHaveCount(0)
  })

  test('Settings, the mode toggle and the interface switch sit in the foot', async ({ page }) => {
    await mockApi(page, { wins: 12 })
    await page.goto('/config')
    await expect(sidebar(page).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    await sidebar(page).getByRole('button', { name: 'Switch to Cosmos mode' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-rift-mode', 'cosmos')
    await expect(sidebar(page).getByRole('group', { name: 'Interface' })).toBeVisible()
    await expect(sidebar(page)).toContainText('a fan project')
    await expect(sidebar(page).getByRole('link', { name: 'game-icons.net' })).toBeVisible()
  })

  test('the foot links to Discord for feedback', async ({ page }) => {
    await mockApi(page, { wins: 12 })
    await page.goto('/012')
    await expect(sidebar(page).getByRole('link', { name: 'Feedback on Discord' })).toHaveAttribute('href', process.env.VITE_DISCORD_FEEDBACK_URL!)
  })

  test('the help strip shows what the hovered item does', async ({ page }) => {
    await mockApi(page, { wins: 12 })
    await page.goto('/012')
    await nav(page).getByRole('link', { name: 'Ladder' }).hover()
    await expect(page.locator('.rift-helpstrip')).toHaveText('Where every player stands this Season.')
    await expect(nav(page).getByRole('link', { name: 'Ladder' })).toHaveAccessibleDescription('Where every player stands this Season.')
  })

  for (const width of [1280, 1440]) {
    for (const mode of ['chaos', 'cosmos'] as const) {
      test(`nothing wraps or scrolls sideways at ${width}px in ${modeName(mode)}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await mockApi(page, { wins: 12, role: 'master' as Role, prefs: { rift_mode: mode } })
        for (const url of ['/', '/012', '/queue', '/012/ladder', '/players/me', '/rewards', '/config', '/admin']) {
          await page.goto(url)
          await expect(sidebar(page)).toBeVisible()
          const problems = await page.evaluate(() => {
            const out: string[] = []
            const doc = document.documentElement
            if (doc.scrollWidth > doc.clientWidth) out.push(`page scrolls sideways by ${doc.scrollWidth - doc.clientWidth}px`)
            const aside = document.querySelector('aside[aria-label="Sidebar"]')!
            if (aside.scrollWidth > aside.clientWidth) out.push('sidebar scrolls sideways')
            aside.querySelectorAll<HTMLElement>('a, button, p').forEach((el) => {
              const lh = parseFloat(getComputedStyle(el).lineHeight) || 20
              const text = el.textContent!.trim().slice(0, 24)
              // The credit line is the one piece of small print allowed to run onto a second line.
              const lines = el.matches('.rift-sidebar__small, .rift-player__note') ? 3 : 1
              if (el.matches('a, button, .rift-player__name, .rift-player__wins') && el.getBoundingClientRect().height > Math.max(48, lh * lines + 8))
                out.push(`${text} wraps`)
              if (el.scrollWidth > el.clientWidth + 1) out.push(`${text} is cut off`)
            })
            return out
          })
          expect(problems, url).toEqual([])
        }
      })
    }
  }
})

test.describe('Rift on phones', () => {
  test('no sidebar or help strip: the compact header and the bottom bar instead', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockApi(page, { wins: 12 })
    await page.goto('/012')
    await expect(sidebar(page)).toBeHidden()
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ladder' }).last()).toBeVisible()
    await expect(page.locator('.rift-helpstrip')).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})

for (const width of [375, 1280]) {
  test(`the Rift footer says it's a fan project and links only beta pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await mockApi(page, { wins: 12 })
    await page.goto('/012')
    const footer = page.getByRole('contentinfo')
    await expect(footer.getByText('Dissidia Arena — a fan project')).toBeVisible()
    const links = footer.getByRole('navigation', { name: 'Site links' })
    await expect(links.getByRole('link', { name: 'Credits' })).toBeVisible()
    for (const name of ['Tournaments', 'Party', 'Friends', 'Discord bot', 'Meta']) await expect(links.getByRole('link', { name })).toHaveCount(0)
  })
}

test('Classic has no sidebar', async ({ page }) => {
  await mockApi(page, { wins: 60, prefs: { interface: 'classic' } })
  await page.goto('/012')
  await expect(page.locator('html')).toHaveAttribute('data-interface', 'classic')
  await expect(sidebar(page)).toHaveCount(0)
  await expect(page.locator('.rift-helpstrip')).toHaveCount(0)
})
