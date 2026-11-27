import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { Role } from '../src/lib/api'
import { mockApi } from './mock'

// Seen from the signed-in tester (id 1), whose opponent (id 2) has stopped answering.
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const player = (id: number, displayName: string) => ({ id, displayName, avatarUrl: '', region: 'EU', gameId: `id${id}`, accepted: true })

function activeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 42, game: 'nt', mode: '1v1', bestOf: 3, platform: 'PS4', region: 'EU', status: 'active',
    acceptDeadline: '2026-11-21T10:00:00Z', createdAt: '2026-11-21T10:00:00Z', finishedAt: null, confirmDeadline: null,
    replayDeadline: null, host: 'you', you: player(1, 'Tester'), opponent: player(2, 'Rival'), winsNeeded: 2,
    score: { you: 0, opponent: 0 }, games: [], winner: null, reportedBy: null, endedBy: null, dispute: null,
    rewardsUnlocked: [], messages: [], canAskAdmin: true, helpRequest: null,
    ...overrides,
  }
}

/** The match room with this match current, recording what the page sends. */
async function inRoom(page: Page, match: Record<string, unknown>, askStatus = 201) {
  await mockApi(page, { wins: 0 })
  const sent: { path: string; body: unknown }[] = []
  let current = match
  await page.route('**/api/queue', (r) => r.fulfill(json({ queue: null, match: current, searching: { '012': 0, nt: 0 }, disputes: [] })))
  await page.route('**/api/matches/42**', (r) => {
    const req = r.request()
    if (req.method() === 'POST') {
      sent.push({ path: new URL(req.url()).pathname, body: req.postDataJSON() })
      if (askStatus !== 201)
        return r.fulfill(json({ error: 'help_unavailable', message: 'You can only ask about open or recent matches.' }, askStatus))
      current = { ...current, canAskAdmin: false, helpRequest: { id: 5, message: req.postDataJSON().message, at: '2026-11-21T11:00:00Z' } }
    }
    return r.fulfill(json(current))
  })
  await page.goto('/match/live')
  return sent
}

test('a player asks an Admin about their match, and sees that it was sent', async ({ page }) => {
  const sent = await inRoom(page, activeMatch())
  await page.getByRole('button', { name: 'Ask an Admin' }).click()

  const form = page.getByRole('form', { name: 'Ask an Admin' })
  await form.getByRole('button', { name: 'Send to the Admins' }).click()
  await expect(form.getByRole('alert')).toHaveText('Say what you need help with.')
  expect(sent).toEqual([])
  expect((await new AxeBuilder({ page }).include('form[aria-label="Ask an Admin"]').analyze()).violations).toEqual([])

  await form.getByLabel('What do you need help with?').fill('  Rival left and is not answering.  ')
  await form.getByRole('button', { name: 'Send to the Admins' }).click()

  const done = page.getByRole('region', { name: 'Help request' })
  await expect(done).toContainText('An Admin will look at this match.')
  await expect(done).toContainText('Rival left and is not answering.')
  expect(sent).toEqual([{ path: '/api/matches/42/help', body: { message: 'Rival left and is not answering.' } }])
  await expect(page.getByRole('button', { name: 'Ask an Admin' })).toHaveCount(0)
  expect((await new AxeBuilder({ page }).include('[aria-label="Help request"]').analyze()).violations).toEqual([])
})

test('there is no Ask an Admin button when the server says the match is out of reach', async ({ page }) => {
  await inRoom(page, activeMatch({ status: 'disputed', canAskAdmin: false }))
  await expect(page.getByRole('button', { name: 'Ask an Admin' })).toHaveCount(0)
})

test('a refused request shows the reason and keeps the form open', async ({ page }) => {
  await inRoom(page, activeMatch(), 409)
  await page.getByRole('button', { name: 'Ask an Admin' }).click()
  await page.getByLabel('What do you need help with?').fill('Help please')
  await page.getByRole('button', { name: 'Send to the Admins' }).click()
  await expect(page.getByText('You can only ask about open or recent matches.')).toBeVisible()
  await expect(page.getByRole('form', { name: 'Ask an Admin' })).toBeVisible()
})

// ---------------------------------------------------------------- the Admins' side

const ref = (id: number, displayName: string) => ({ id, displayName })
const asked = {
  kind: 'help', helpRequestId: 5, matchId: 42, game: 'nt', platform: 'PS4', players: ['Tester', 'Rival'],
  message: 'Rival left and is not answering.', askedBy: ref(1, 'Tester'), askedAt: '2026-11-21T11:00:00Z', claim: null,
}

function helpPage(overrides: Record<string, unknown> = {}) {
  return {
    ...asked, closed: null, playedIn: false, canAct: false,
    match: {
      id: 42, status: 'active', players: [
        { id: 1, displayName: 'Tester', avatarUrl: '', region: 'EU', gameId: 'id1' },
        { id: 2, displayName: 'Rival', avatarUrl: '', region: 'EU', gameId: 'id2' },
      ],
      score: [0, 0], winsNeeded: 2, winner: null, games: [], createdAt: '2026-11-21T10:00:00Z', finishedAt: null, canVoid: true,
      messages: [{ id: 1, from: 2, text: 'brb', at: '2026-11-21T10:30:00Z' }],
    },
    ...overrides,
  }
}

async function asAdmin(page: Page, role: Role, start: Record<string, unknown>) {
  await mockApi(page, { wins: 0, role })
  const sent: { path: string; body: unknown }[] = []
  let current = start
  await page.route('**/api/admin/**', (r) => {
    const req = r.request()
    const path = new URL(req.url()).pathname
    if (path === '/api/admin/cases') return r.fulfill(json({ cases: [{ ...current, claim: current.claim }] }))
    if (req.method() === 'POST') {
      sent.push({ path, body: req.postDataJSON() })
      if (path.endsWith('/claim')) current = { ...current, claim: { by: ref(9, 'Admin'), at: new Date().toISOString(), byYou: true }, canAct: true }
      if (path.endsWith('/close'))
        current = { ...current, canAct: false, claim: null, closed: { by: ref(9, 'Admin'), at: '2026-11-21T12:00:00Z', reason: req.postDataJSON().reason } }
      if (path.endsWith('/void')) current = { ...current, match: { ...(current.match as object), status: 'voided', canVoid: false } }
    }
    return r.fulfill(json(current))
  })
  return sent
}

test('Help requests sit in the case list and open their own page', async ({ page }) => {
  await asAdmin(page, 'admin', helpPage())
  await page.goto('/admin')
  const link = page.getByRole('region', { name: 'Open cases' }).getByRole('link', { name: 'Match #42', exact: true }) // changed: the case list is a table
  await expect(link).toBeVisible()
  await expect(page.getByText('Rival left and is not answering.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Open cases' }).locator('tbody tr')).toContainText('Unclaimed') // changed: Unclaimed is also a filter chip
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
  await link.click()
  await expect(page).toHaveURL(/\/admin\/help-requests\/5$/)
})

test('an Admin claims a Help request, Voids its stuck match, and closes it with a reason', async ({ page }) => {
  const sent = await asAdmin(page, 'admin', helpPage())
  await page.goto('/admin/help-requests/5')
  await expect(page.getByRole('button', { name: 'Close request' })).toHaveCount(0) // needs the Claim first

  await page.getByRole('button', { name: 'Claim', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Request status' })).toContainText('You hold the Claim on this request.')

  await page.getByRole('button', { name: 'Void match' }).click()
  await expect(page.getByRole('alert')).toHaveText('Give a reason.')
  await page.getByLabel('Reason (goes in the Admin log)').fill('Rival never came back.')
  await page.getByRole('button', { name: 'Void match' }).click()
  await expect(page.getByRole('region', { name: 'Match', exact: true })).toContainText('Voided')
  await expect(page.getByRole('button', { name: 'Void match' })).toHaveCount(0)

  await page.getByLabel(/^Reason \(pass it to the Master/).fill('Voided it. Passing the no-show to the Master.')
  await page.getByRole('button', { name: 'Close request' }).click()
  await expect(page.getByRole('region', { name: 'Request status' })).toContainText('Passing the no-show to the Master.')

  expect(sent).toEqual([
    { path: '/api/admin/help-requests/5/claim', body: null },
    { path: '/api/admin/matches/42/void', body: { reason: 'Rival never came back.' } },
    { path: '/api/admin/help-requests/5/close', body: { reason: 'Voided it. Passing the no-show to the Master.' } },
  ])
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})

test('an Admin who played in the match is told so and cannot Claim', async ({ page }) => {
  await asAdmin(page, 'admin', helpPage({ playedIn: true, match: { ...helpPage().match, canVoid: false } }))
  await page.goto('/admin/help-requests/5')
  await expect(page.getByRole('region', { name: 'Request status' })).toContainText('You played in this match.')
  for (const name of ['Claim', 'Void match', 'Close request']) await expect(page.getByRole('button', { name })).toHaveCount(0)
})
