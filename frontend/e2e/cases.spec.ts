import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { Role } from '../src/lib/api'
import { mockApi } from './mock'

// The signed-in tester is user 1. Ashe (7) reported a 2-1 win over Rival (2), who disputed game 3.
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const ref = (id: number, displayName: string) => ({ id, displayName })
const player = (id: number, displayName: string) => ({ id, displayName, avatarUrl: '', region: 'EU', gameId: `id${id}` })
const noRecord = { filed: 0, outcomes: {}, disputes: [] }

function theCase(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'dispute', matchId: 42, game: 'nt', platform: 'PS4', disputedAt: '2026-11-21T12:00:00Z', claim: null,
    status: 'disputed', players: [player(7, 'Ashe'), player(2, 'Rival')], score: [2, 1], winsNeeded: 2,
    reportedBy: 7, winner: 7,
    games: [
      { n: 1, winner: 7, reportedBy: 7, details: {} },
      { n: 2, winner: 2, reportedBy: 7, details: {} },
      { n: 3, winner: 7, reportedBy: 7, details: {} },
    ],
    dispute: { games: [3], reason: 'They quit game 3.', by: 2,
      statements: { 7: { text: 'They rage quit, I won.', updatedAt: '2026-11-21T12:05:00Z' } } },
    messages: [{ id: 1, from: null, text: 'Result disputed. An Admin will review it.', at: '2026-11-21T12:00:00Z' }],
    records: {
      7: noRecord,
      2: { filed: 3, outcomes: { uphold: 2, pending: 1 }, disputes: [
        { matchId: 42, game: 'nt', at: '2026-11-21T12:00:00Z', outcome: null },
        { matchId: 30, game: 'nt', at: '2026-11-10T12:00:00Z', outcome: 'uphold' },
        { matchId: 12, game: '012', at: '2026-11-01T12:00:00Z', outcome: 'uphold' },
      ] },
    },
    ruling: null, playedIn: false, canAct: false,
    ...overrides,
  }
}

/** Signed in with this role, looking at a case the server describes as `start`. Records what the page sends. */
async function onCase(page: Page, role: Role, start: Record<string, unknown>) {
  await mockApi(page, { wins: 0, role })
  const sent: { path: string; body: unknown }[] = []
  let current = start
  await page.route('**/api/admin/**', (r) => {
    const req = r.request()
    const path = new URL(req.url()).pathname
    if (path === '/api/admin/cases') return r.fulfill(json({ cases: [{ ...current, players: ['Ashe', 'Rival'] }] }))
    if (req.method() === 'POST') {
      sent.push({ path, body: req.postDataJSON() })
      if (path.endsWith('/claim')) current = { ...current, claim: { by: ref(1, 'Tester'), at: new Date().toISOString(), byYou: true }, canAct: true }
      if (path.endsWith('/ruling'))
        current = { ...current, status: 'completed', canAct: false, claim: null,
          ruling: { outcome: req.postDataJSON().outcome, reason: req.postDataJSON().reason, at: '2026-11-21T13:00:00Z', by: ref(1, 'Tester') } }
    }
    return r.fulfill(json(current))
  })
  await page.goto('/admin/cases/42')
  return sent
}

const status = (page: Page) => page.getByRole('region', { name: 'Case status' })

test('another Admin sees "Being handled" and no resolve buttons', async ({ page }) => {
  await onCase(page, 'admin', theCase({ claim: { by: ref(8, 'Kefka'), at: new Date(Date.now() - 20 * 60_000).toISOString(), byYou: false } }))
  await expect(status(page)).toContainText('Being handled by Kefka')
  for (const name of ['Claim', 'Take over', 'Release', 'Give Ruling'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Dispute records' })).toContainText('Filed 3 disputes: 2 upheld, 1 waiting.')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})

test('an Admin who played in the match is told so and cannot Claim it', async ({ page }) => {
  await onCase(page, 'admin', theCase({ playedIn: true }))
  await expect(status(page)).toContainText('You played in this match.')
  await expect(page.getByRole('button', { name: 'Claim', exact: true })).toHaveCount(0)
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})

test('the Master can take over a Claim, and act on their own match', async ({ page }) => {
  await onCase(page, 'master', theCase({ playedIn: true, canAct: true, claim: { by: ref(8, 'Kefka'), at: '2026-11-21T12:10:00Z', byYou: false } }))
  await expect(status(page)).toContainText('You played in this match.')
  await expect(page.getByRole('button', { name: 'Take over' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Give Ruling' })).toBeVisible()
})

test('an Admin Claims the case and Upholds it with a reason', async ({ page }) => {
  const sent = await onCase(page, 'admin', theCase())
  await expect(page.getByRole('region', { name: 'Reported games' })).toContainText('Game 3: Ashe wins (reported by Ashe) · disputed')
  await page.getByRole('button', { name: 'Claim', exact: true }).click()
  await expect(status(page)).toContainText('You hold the Claim')

  await page.getByRole('button', { name: 'Give Ruling' }).click()
  await expect(page.getByRole('alert')).toHaveText('Pick a Ruling.')
  await page.getByRole('radio', { name: /Uphold/ }).check()
  await page.getByLabel(/^Reason/).fill('Rival left mid-game; the clip shows it.')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Give Ruling' }).click()

  await expect(status(page)).toContainText('Ruling: Upheld')
  await expect(status(page)).toContainText('Rival left mid-game; the clip shows it.')
  expect(sent).toEqual([
    { path: '/api/admin/disputes/42/claim', body: null },
    { path: '/api/admin/disputes/42/ruling', body: { outcome: 'uphold', reason: 'Rival left mid-game; the clip shows it.' } },
  ])
})

test('an Admin Overturns the case by correcting the disputed game', async ({ page }) => {
  const sent = await onCase(page, 'admin', theCase({ claim: { by: ref(1, 'Tester'), at: '2026-11-21T12:10:00Z', byYou: true }, canAct: true }))
  await page.getByRole('radio', { name: /Overturn/ }).check()

  const corrections = page.getByRole('group', { name: 'Corrected games' })
  await expect(corrections.getByLabel('Game 1 winner')).toHaveValue('7')
  await expect(corrections.getByLabel('Game 3 winner (disputed)')).toHaveValue('2') // pre-selected: the other player
  await expect(corrections).toContainText('Rival wins 2–1')
  await corrections.getByLabel('Game 1 winner').selectOption({ label: 'Rival' })
  await expect(corrections).toContainText('Rival wins 3–0')
  await corrections.getByLabel('Game 1 winner').selectOption({ label: 'Ashe' })

  await page.getByLabel(/^Reason/).fill('The clip shows Rival won game 3.')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Give Ruling' }).click()

  await expect(status(page)).toContainText('Ruling: Overturned')
  expect(sent).toEqual([
    { path: '/api/admin/disputes/42/ruling', body: { outcome: 'overturn', reason: 'The clip shows Rival won game 3.', games: [{ n: 3, winner: 2 }] } },
  ])
})

test('the case list shows which cases are claimed', async ({ page }) => {
  await onCase(page, 'admin', theCase({ claim: { by: ref(8, 'Kefka'), at: '2026-11-21T12:10:00Z', byYou: false } }))
  await page.goto('/admin')
  const list = page.getByRole('region', { name: 'Open cases' })
  await expect(list.getByRole('listitem')).toContainText('Claimed by Kefka')
  await list.getByRole('link', { name: 'Match #42: Ashe vs Rival' }).click()
  await expect(page).toHaveURL(/\/admin\/cases\/42$/)
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})
