import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { Role } from '../src/lib/api'
import { mockApi } from './mock'

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

const ashe = { id: 7, discordId: '7', username: 'ashe', displayName: 'Ashe', avatarUrl: '', role: 'player' }
const kefka = { id: 8, discordId: '8', username: 'kefka', displayName: 'Kefka', avatarUrl: '', role: 'admin', since: '2026-11-01T10:00:00Z' }

const LOG = {
  entries: [
    { id: 2, actor: { id: 1, displayName: 'Tester' }, action: 'appoint_admin', matchId: null, target: { id: 8, displayName: 'Kefka' },
      reason: 'Runs the NT community', details: {}, at: '2026-11-21T12:00:00Z' },
    { id: 1, actor: null, action: 'auto_confirm', matchId: 42, target: { id: 2, displayName: 'Rival' },
      reason: "The opponent didn't confirm or dispute within 2 hours.", details: {}, at: '2026-11-21T11:00:00Z' },
    { id: 0, actor: null, action: 'purge_screenshots', matchId: 30, target: null,
      reason: 'Deleted 2 dispute screenshots, 90 days after the final Ruling.', details: { count: 2 }, at: '2026-11-20T11:00:00Z' },
  ],
  page: 1,
  hasMore: true,
}

/** Signed in with this role; records what the admin pages send. */
async function signedInAs(page: Page, role: Role) {
  await mockApi(page, { wins: 0, role })
  const sent: { method: string; path: string; body: unknown }[] = []
  let admins = [kefka]
  await page.route('**/api/admin/**', (r) => {
    const req = r.request()
    const url = new URL(req.url())
    const path = url.pathname
    if (req.method() !== 'GET') sent.push({ method: req.method(), path, body: req.postDataJSON() })
    if (path === '/api/admin/log') return r.fulfill(json({ ...LOG, page: Number(url.searchParams.get('page')), hasMore: url.searchParams.get('page') === '1' }))
    if (path === '/api/admin/admins' && req.method() === 'POST') {
      admins = [...admins, { ...ashe, role: 'admin', since: '2026-11-21T12:00:00Z' }]
      return r.fulfill(json({ admins }, 201))
    }
    if (path === '/api/admin/admins') return r.fulfill(json({ admins }))
    if (path.startsWith('/api/admin/admins/')) {
      admins = admins.filter((a) => `/api/admin/admins/${a.id}/remove` !== path)
      return r.fulfill(json({ admins }))
    }
    if (path === '/api/admin/players') return r.fulfill(json({ players: [ashe, kefka] }))
    if (path === '/api/admin/step-down') return r.fulfill(json({ id: 1, displayName: 'Tester', role: 'player', onboarded: true, games: ['012', 'nt'], gameIds: {}, region: 'EU', rankedWins: 0 }))
    return r.fulfill(json({ error: 'not_found' }, 404))
  })
  return sent
}

test('the sidebar shows Admin to Admins and the Master, and Admins to the Master only', async ({ page }) => {
  for (const [role, admin, master] of [['player', 0, 0], ['admin', 1, 0], ['master', 1, 1]] as const) {
    await signedInAs(page, role)
    await page.goto('/rewards')
    await expect(nav(page).getByRole('link', { name: 'Rewards' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Admin', exact: true })).toHaveCount(admin)
    await expect(nav(page).getByRole('link', { name: 'Cases', exact: true })).toHaveCount(admin)
    await expect(nav(page).getByRole('link', { name: 'Admin log', exact: true })).toHaveCount(admin)
    await expect(nav(page).getByRole('link', { name: 'Admins', exact: true })).toHaveCount(master)
    await page.unrouteAll()
  }
  await signedInAs(page, 'master')
  await page.goto('/rewards')
  await nav(page).getByRole('link', { name: 'Admins', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/admins$/) // changed: the Admins tab replaced the Master panel page
  await expect(nav(page).getByRole('link', { name: 'Admins', exact: true })).toHaveAttribute('aria-current', 'page')
  await nav(page).getByRole('link', { name: 'Admin log', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/log$/)
  await expect(nav(page).getByRole('link', { name: 'Admin log', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('the Classic command menu lists Admin for Admins and the Master, and no Master panel', async ({ page }) => {
  // changed: the Master panel command is gone; the Master reaches the Admins tab through Admin
  for (const [role, admin] of [['player', 0], ['admin', 1], ['master', 1]] as const) {
    await mockApi(page, { wins: 10, role, prefs: { interface: 'classic' } })
    await page.goto('/rewards')
    await expect(nav(page).getByRole('button', { name: 'Rewards' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: 'Admin', exact: true })).toHaveCount(admin)
    await expect(nav(page).getByRole('button', { name: 'Master panel' })).toHaveCount(0)
    await page.unrouteAll()
  }
})

test('Admins read the Admin log, page by page', async ({ page }) => {
  await signedInAs(page, 'admin')
  await page.goto('/admin/log')
  const entries = page.getByRole('region', { name: 'Admin log entries' })
  await expect(entries.getByRole('listitem')).toHaveCount(3)
  await expect(entries.getByRole('listitem').first()).toContainText('Tester appointed an Admin: Kefka')
  await expect(entries.getByRole('listitem').nth(1)).toContainText('System confirmed a result automatically')
  await expect(entries.getByRole('listitem').nth(2)).toContainText('System deleted dispute screenshots · Match #30')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])

  await page.getByRole('button', { name: 'Older' }).click()
  await expect(page.getByText('Page 2')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Older' })).toBeDisabled()
})

test('an Admin steps down with a reason and loses the Admin link', async ({ page }) => {
  const sent = await signedInAs(page, 'admin')
  await page.goto('/admin/log')
  const stepDown = page.getByRole('region', { name: 'Step down' })
  await stepDown.getByRole('button', { name: 'Step down' }).click()
  await expect(stepDown.getByRole('alert')).toHaveText('Say why you are stepping down.')
  expect(sent).toEqual([])

  await stepDown.getByLabel('Why are you stepping down?').fill('Taking a break')
  await stepDown.getByRole('button', { name: 'Step down' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(sent).toEqual([{ method: 'POST', path: '/api/admin/step-down', body: { reason: 'Taking a break' } }])
  await expect(nav(page).getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
})

test('the Master does not see a step-down form', async ({ page }) => {
  await signedInAs(page, 'master')
  await page.goto('/admin/log')
  await expect(page.getByRole('region', { name: 'Admin log entries' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Step down' })).toHaveCount(0)
})

test('the Master appoints and removes Admins, each with a reason', async ({ page }) => {
  const sent = await signedInAs(page, 'master')
  await page.goto('/admin/admins') // changed: the Admins tab replaced the Master panel page
  const admins = page.getByRole('region', { name: 'Admins' })
  await expect(admins.getByText('Kefka', { exact: true })).toBeVisible()
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])

  await page.getByLabel('Search players by Discord name').fill('a')
  await page.getByRole('button', { name: 'Search' }).click()
  const results = page.getByRole('list', { name: 'Search results' })
  await expect(results.getByRole('listitem').nth(1)).toContainText('Already an Admin')

  await results.getByRole('button', { name: 'Appoint Ashe' }).click()
  const form = page.getByRole('form', { name: 'Appoint Ashe' })
  await form.getByRole('button', { name: 'Appoint Ashe' }).click()
  await expect(form.getByRole('alert')).toContainText('Give a reason')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
  await form.getByLabel('Why are you appointing Ashe?').fill('Trusted 012 regular')
  await form.getByRole('button', { name: 'Appoint Ashe' }).click()
  await expect(admins.getByText('Ashe', { exact: true })).toBeVisible()
  await expect(results.getByRole('listitem').first()).toContainText('Already an Admin')

  await admins.getByRole('button', { name: 'Remove Kefka' }).click()
  await page.getByLabel('Why are you removing Kefka?').fill('Inactive')
  await page.getByRole('form', { name: 'Remove Kefka' }).getByRole('button', { name: 'Remove Kefka' }).click()
  await expect(admins.getByText('Kefka', { exact: true })).toHaveCount(0)

  expect(sent).toEqual([
    { method: 'POST', path: '/api/admin/admins', body: { userId: 7, reason: 'Trusted 012 regular' } },
    { method: 'POST', path: '/api/admin/admins/8/remove', body: { reason: 'Inactive' } },
  ])
})

test('players and Admins see "Not available" on pages that are not theirs', async ({ page }) => {
  await signedInAs(page, 'player')
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Not available' })).toBeVisible()
  await expect(page.getByText('This page is only for Admins.')).toBeVisible()
  await page.unrouteAll()

  await signedInAs(page, 'admin')
  await page.goto('/admin/admins') // changed: the Admins tab replaced the Master panel page
  await expect(page.getByText('This page is only for the Master.')).toBeVisible()
})

test('the Admin panel shows the Admins tab to the Master only, and /master leads to it', async ({ page }) => {
  for (const [role, count] of [['admin', 0], ['master', 1]] as const) {
    await signedInAs(page, role)
    await page.goto('/admin/log')
    const tabs = page.getByRole('navigation', { name: 'Admin area' })
    await expect(tabs.getByRole('link', { name: 'Log', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(tabs.getByRole('link', { name: 'Admins', exact: true })).toHaveCount(count)
    await page.unrouteAll()
  }
  await signedInAs(page, 'master')
  await page.goto('/master')
  await expect(page).toHaveURL(/\/admin\/admins$/)
  const adminTabs = page.getByRole('navigation', { name: 'Admin area' })
  await expect(adminTabs.getByRole('link', { name: 'Admins', exact: true })).toHaveAttribute('aria-current', 'page')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})
