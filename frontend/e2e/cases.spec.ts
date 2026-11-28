import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Role } from '../src/lib/api'
import { mockApi, modeName } from './mock'

// The signed-in tester is user 1. Ashe (7) reported a 2-1 win over Rival (2), who disputed game 3.
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const ref = (id: number, displayName: string) => ({ id, displayName })
const player = (id: number, displayName: string) => ({ id, displayName, avatarUrl: '', region: 'EU', gameId: `id${id}` })
const noRecord = { filed: 0, outcomes: {}, disputes: [] }

function theCase(overrides: Record<string, unknown> = {}) {
  const page = {
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
    replayFrom: { games: [1, 2, 3], default: 3 }, earlierDisputes: [], ruling: null, playedIn: false, canAct: false,
    ...overrides,
  }
  // The server always sends the dispute's round and screenshots, so a dispute written without them has none.
  return { ...page, dispute: { round: 0, screenshots: {}, ...(page.dispute as object) } }
}

/** Signed in with this role, looking at a case the server describes as `start`. Records what the page sends. */
async function onCase(page: Page, role: Role, start: Record<string, unknown>, extraRoutes?: () => Promise<void>) {
  await mockApi(page, { wins: 0, role })
  await extraRoutes?.() // after mockApi: the last route registered is the first to answer
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
        current = { ...current, status: req.postDataJSON().outcome === 'replay' ? 'active' : 'completed', canAct: false, claim: null,
          ruling: { outcome: req.postDataJSON().outcome, reason: req.postDataJSON().reason, at: '2026-11-21T13:00:00Z', by: ref(1, 'Tester') } }
    }
    return r.fulfill(json(current))
  })
  await page.goto('/admin/cases/42')
  return sent
}

const status = (page: Page) => page.getByRole('region', { name: 'Case status' })

/** A route for onCase's `extraRoutes`: shows the page in this interface. */
const inInterface = async (page: Page, ui: 'rift' | 'classic', mode: 'chaos' | 'cosmos' = 'chaos') => {
  await page.route('**/api/me/appearance', (r) =>
    r.fulfill(json({ preferences: { interface: ui, window_theme: 'classic', menu_font: 'auto', cursor: 'glove', window_rgb: [6, 10, 26], rift_mode: mode },
      ranked_wins: 60, ranked_losses: 0, unlocks: ['classic_interface'], rewards: [], next: null })),
  )
}

test('another Admin sees "Being handled" and no resolve buttons', async ({ page }) => {
  await onCase(page, 'admin', theCase({ claim: { by: ref(8, 'Kefka'), at: new Date(Date.now() - 20 * 60_000).toISOString(), byYou: false } }))
  await expect(status(page)).toContainText('Being handled by Kefka')
  for (const name of ['Claim', 'Take over', 'Release'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Give Ruling' })).toBeDisabled() // changed: the form stays beside the evidence, greyed out until you may use it
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
  await expect(page.getByRole('region', { name: 'Reported games' }).getByRole('row', { name: '3 Ashe Ashe Disputed' })).toBeVisible() // changed: the reported games are a table
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

test('following a dispute record to another case starts a fresh Ruling form', async ({ page }) => {
  const mine = { claim: { by: ref(1, 'Tester'), at: '2026-11-21T12:10:00Z', byYou: true }, canAct: true }
  await onCase(page, 'admin', theCase(mine))
  const other = theCase({ ...mine, matchId: 30, players: [player(5, 'Zidane'), player(2, 'Rival')], winner: 5, reportedBy: 5,
    games: [{ n: 1, winner: 5, reportedBy: 5, details: {} }, { n: 2, winner: 5, reportedBy: 5, details: {} }],
    dispute: { games: [2], reason: 'Lag.', by: 2, statements: {} }, records: { 5: noRecord, 2: noRecord } })
  await page.route('**/api/admin/disputes/30', (r) => r.fulfill(json(other)))

  await page.getByRole('radio', { name: /Overturn/ }).check()
  await page.getByLabel(/^Reason/).fill('Meant for match 42.')
  await page.getByRole('region', { name: 'Dispute records' }).getByRole('link', { name: 'Match #30' }).click()

  await expect(page.getByRole('heading', { name: 'Case: Match #30' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Overturn/ })).not.toBeChecked()
  await expect(page.getByLabel(/^Reason/)).toHaveValue('')
  await page.getByRole('radio', { name: /Overturn/ }).check()
  await expect(page.getByRole('group', { name: 'Corrected games' }).getByLabel('Game 2 winner (disputed)')).toHaveValue('2')
})

test('the case list shows which cases are claimed', async ({ page }) => {
  await onCase(page, 'admin', theCase({ claim: { by: ref(8, 'Kefka'), at: '2026-11-21T12:10:00Z', byYou: false } }))
  await page.goto('/admin')
  const list = page.getByRole('region', { name: 'Open cases' })
  await expect(list.locator('tbody tr')).toContainText('Kefka') // changed: the table's Claim column shows the Admin's name
  await list.getByRole('link', { name: 'Match #42', exact: true }).click() // changed: the players have their own column
  await expect(page).toHaveURL(/\/admin\/cases\/42$/)
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})

test('an Admin rules a Replay from a chosen game', async ({ page }) => {
  const sent = await onCase(page, 'admin', theCase({ claim: { by: ref(1, 'Tester'), at: '2026-11-21T12:10:00Z', byYou: true }, canAct: true }))
  await page.getByRole('radio', { name: /Replay/ }).check()
  const from = page.getByLabel('Replay from')
  await expect(from).toHaveValue('3') // the first disputed game
  await from.selectOption({ label: 'Game 2' })
  await page.getByLabel(/^Reason/).fill('Both clips cut out; play games 2 and 3 again.')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Give Ruling' }).click()

  await expect(status(page)).toContainText('Ruling: Replayed')
  expect(sent).toEqual([
    { path: '/api/admin/disputes/42/ruling', body: { outcome: 'replay', reason: 'Both clips cut out; play games 2 and 3 again.', fromGame: 2 } },
  ])
})

test('an unfinished Replay is marked in the case list and on the case', async ({ page }) => {
  await onCase(page, 'admin', theCase({ replayNotFinished: true, winner: null, reportedBy: null, score: [1, 1],
    games: theCase().games.slice(0, 2) }))
  await expect(status(page)).toContainText('Replay not finished')
  await expect(page.getByRole('region', { name: 'Reported games' })).toContainText('1–1 so far: nobody has won yet')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
  await page.goto('/admin')
  await expect(page.getByRole('region', { name: 'Open cases' }).locator('tbody tr')).toContainText('Replay not finished') // changed: the case list is a table
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})

test('Admins see the dispute from before a Replay, with both sides and the Ruling', async ({ page }) => {
  await onCase(page, 'admin', theCase({
    dispute: { games: [3], reason: 'Lag again in the replay.', by: 2, statements: {} },
    earlierDisputes: [{ games: [3], reason: 'They quit game 3.', by: 2, at: '2026-11-21T12:00:00Z',
      statements: { 7: { text: 'They rage quit, I won.', updatedAt: '2026-11-21T12:05:00Z' } },
      ruling: { outcome: 'replay', reason: 'Play game 3 again.', at: '2026-11-21T13:00:00Z', byId: 8, by: ref(8, 'Kefka') } }],
  }))
  await expect(page.getByRole('region', { name: 'Statements' })).toContainText('Lag again in the replay.') // changed: the statements have their own section
  const earlier = page.getByRole('region', { name: 'Earlier disputes' })
  await expect(earlier).toContainText('Disputed games: 3')
  await expect(earlier).toContainText('Rival wrote: They quit game 3.')
  await expect(earlier).toContainText('They rage quit, I won.')
  await expect(earlier).toContainText('Rival did not add their side.')
  await expect(earlier).toContainText('Ruling: Replayed by Kefka: Play game 3 again.')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})


test('the case page shows every screenshot, with a placeholder for deleted ones', async ({ page }) => {
  const shot = (id: number, round: number, removed = false) => ({
    id, url: removed ? null : `/api/matches/42/screenshots/${id}`, at: '2026-11-21T12:10:00Z', round, removed,
  })
  const base = theCase()
  await onCase(
    page,
    'admin',
    theCase({
      dispute: { ...(base.dispute as object), round: 1,
        screenshots: { 2: [shot(1, 0), shot(2, 1)], 7: [shot(3, 1, true)] } },
    }),
    () =>
      page.route('**/api/matches/42/screenshots/*', (r) =>
        r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }),
      ),
  )
  const dispute = page.getByRole('region', { name: 'Screenshots' }) // changed: the Screenshots have their own section
  await expect(dispute.getByRole('img', { name: 'Screenshot 1 from Rival' })).toBeVisible()
  await expect(dispute.getByRole('img', { name: 'Screenshot 2 from Rival' })).toBeVisible()
  // Visible isn't enough: a broken image is visible too. Both must have actually loaded.
  for (const name of ['Screenshot 1 from Rival', 'Screenshot 2 from Rival'])
    await expect.poll(() => dispute.getByRole('img', { name }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await expect(dispute.getByText('Earlier dispute')).toHaveCount(1) // only the first one, from before a Replay
  await expect(dispute.getByText('Screenshot removed after 90 days')).toHaveCount(1)
  await expect(dispute.getByText('No screenshots.')).toHaveCount(0)
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})

test('the filter chips show the right cases', async ({ page }) => {
  await mockApi(page, { wins: 0, role: 'admin' })
  const dispute = (matchId: number, claim: unknown) => ({ kind: 'dispute', matchId, game: 'nt', platform: 'PS4',
    players: ['Ashe', 'Rival'], disputedAt: '2026-11-21T12:00:00Z', replayNotFinished: false, claim })
  const cases = [
    dispute(42, { by: ref(1, 'Tester'), at: '2026-11-21T12:10:00Z', byYou: true }),
    { kind: 'help', helpRequestId: 5, matchId: 43, game: '012', platform: 'PC', players: ['Tester', 'Rival'],
      message: 'The room closed.', askedBy: ref(2, 'Rival'), askedAt: '2026-11-21T12:00:00Z',
      claim: { by: ref(8, 'Kefka'), at: '2026-11-21T12:10:00Z', byYou: false } },
    dispute(44, null),
  ]
  await page.route('**/api/admin/cases', (r) => r.fulfill(json({ cases })))
  await page.goto('/admin')
  const list = page.getByRole('region', { name: 'Open cases' })
  await expect(list.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const expected = [['All', [42, 43, 44]], ['Disputes', [42, 44]], ['Help', [43]], ['Unclaimed', [44]], ['Mine', [42]]] as const
  for (const [chip, matches] of expected) {
    await list.getByRole('button', { name: chip, exact: true }).click()
    await expect(list.getByRole('button', { name: chip, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(list.getByRole('link')).toHaveText(matches.map((id) => `Match #${id}`))
  }
  await expect(list.locator('tbody tr')).toContainText('Tester')
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})

test('at phone width each case stacks, with nothing off screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await onCase(page, 'admin', theCase({ claim: { by: ref(8, 'Kefka'), at: '2026-11-21T12:10:00Z', byYou: false } }))
  await page.goto('/admin')
  const table = page.getByRole('region', { name: 'Open cases' }).getByRole('table')
  await expect(table.getByRole('cell', { name: 'Claim · Kefka' })).toBeInViewport({ ratio: 1 })
  expect(await table.evaluate((t) => t.parentElement!.scrollWidth - t.parentElement!.clientWidth)).toBe(0)
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
})

test('the picked chip stays while the Admin moves around the panel', async ({ page }) => {
  await onCase(page, 'admin', theCase({}))
  await page.route('**/api/admin/log*', (r) => r.fulfill(json({ entries: [], page: 1, hasMore: false })))
  await page.goto('/admin')
  const disputes = page.getByRole('button', { name: 'Disputes', exact: true })
  const tabs = page.getByRole('navigation', { name: 'Admin area' })
  await disputes.click()
  await page.getByRole('link', { name: 'Match #42', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Case: Match #42' })).toBeVisible()
  await tabs.getByRole('link', { name: 'Cases', exact: true }).click()
  await expect(disputes).toHaveAttribute('aria-pressed', 'true')
  await tabs.getByRole('link', { name: 'Log', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/log$/)
  await tabs.getByRole('link', { name: 'Cases', exact: true }).click()
  await expect(disputes).toHaveAttribute('aria-pressed', 'true')
})

test('on a laptop the cases stay a table, with nothing off screen', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await onCase(page, 'admin', theCase())
  // The widest a row gets: names with no spaces to wrap at, and a Help request's message.
  const long = {
    kind: 'help', helpRequestId: 5, matchId: 43, game: '012', platform: 'PC', players: ['Kestrel_of_the_Northern_Reaches', 'Solstice'],
    message: 'The room closed before game 3 and we cannot rejoin.', askedBy: ref(2, 'Solstice'), askedAt: '2026-11-21T12:00:00Z',
    claim: { by: ref(8, 'Kefka_of_the_Southern_Reaches_'), at: '2026-11-21T12:10:00Z', byYou: false },
  }
  await page.route('**/api/admin/cases', (r) => r.fulfill(json({ cases: [long] })))
  await page.goto('/admin')
  const table = page.getByRole('region', { name: 'Open cases' }).getByRole('table')
  await expect(table.getByRole('columnheader', { name: 'Claim' })).toBeInViewport({ ratio: 1 })
  await expect(table.locator('tbody tr')).toHaveCSS('display', 'table-row')
  expect(await table.evaluate((t) => t.parentElement!.scrollWidth - t.parentElement!.clientWidth)).toBe(0)
})

// ---------------------------------------------------------------- drafts

const mine = { claim: { by: ref(1, 'Tester'), at: '2026-11-21T12:10:00Z', byYou: true }, canAct: true }
const reasonBox = (page: Page) => page.getByLabel(/^Reason/)

test('a Ruling draft survives a reload and is gone after the Ruling succeeds', async ({ page }) => {
  await onCase(page, 'admin', theCase(mine))
  await reasonBox(page).fill('Rival left mid-game; the clip shows it.')
  await page.reload()
  await expect(reasonBox(page)).toHaveValue('Rival left mid-game; the clip shows it.')

  await page.getByRole('radio', { name: /Uphold/ }).check()
  await page.getByRole('button', { name: 'Give Ruling' }).click()
  await expect(status(page)).toContainText('Ruling: Upheld')

  // Serve the case unruled again, as it would be on a device whose draft was never cleared: the form must start empty.
  await page.route('**/api/admin/disputes/42', (r) => r.fulfill(json(theCase(mine))))
  await page.reload()
  await expect(reasonBox(page)).toHaveValue('')
})

test('blocked browser storage is ignored: the Admin still writes and gives the Ruling', async ({ page }) => {
  const errors: Error[] = []
  page.on('pageerror', (e) => errors.push(e))
  // Only the drafts' own storage calls throw: the rest of the app's storage isn't what's under test here.
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      const real = Storage.prototype[method] as (this: Storage, ...args: string[]) => unknown
      Storage.prototype[method] = function (this: Storage, ...args: string[]) {
        if (args[0].startsWith('da-draft:')) throw new DOMException('blocked', 'SecurityError')
        return real.apply(this, args) as never
      }
    }
  })
  const sent = await onCase(page, 'admin', theCase(mine))
  await page.getByRole('radio', { name: /Uphold/ }).check()
  await reasonBox(page).fill('Rival left mid-game.')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Give Ruling' }).click()
  await expect(status(page)).toContainText('Ruling: Upheld')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(sent).toEqual([{ path: '/api/admin/disputes/42/ruling', body: { outcome: 'uphold', reason: 'Rival left mid-game.' } }])
  expect(errors).toEqual([])
})

// ---------------------------------------------------------------- the case page's layout

/** A case long enough to scroll: a full chat, and a dispute from before a Replay. */
const longCase = (overrides: Record<string, unknown> = {}) =>
  theCase({
    ...mine,
    messages: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, from: i % 2 ? 7 : 2, text: `Message ${i + 1}`, at: '2026-11-21T11:00:00Z' })),
    earlierDisputes: Array.from({ length: 4 }, () => ({ games: [3], reason: 'They quit game 3.', by: 2, at: '2026-11-21T12:00:00Z',
      statements: { 7: { text: 'They rage quit, I won.', updatedAt: '2026-11-21T12:05:00Z' } }, ruling: null })),
    ...overrides,
  })

test('a case reads in order: summary, evidence, chat, records, then the Ruling', async ({ page }) => {
  await onCase(page, 'admin', longCase({ claim: null, canAct: false }))
  const summary = status(page)
  for (const text of ['Dispute', 'NT · PS4', 'Ashe vs Rival', 'Disputed', 'Unclaimed']) await expect(summary).toContainText(text)
  await expect(summary.getByRole('button', { name: 'Claim', exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText([
    /Case: Match #42.*Ashe vs Rival/, 'Reported games', 'Statements', 'Screenshots', 'Match chat', 'Dispute records',
    'Earlier disputes', 'Write ruling',
  ])
})

test('the Ruling form waits for the Claim', async ({ page }) => {
  await onCase(page, 'admin', theCase())
  const side = page.getByRole('region', { name: 'Write ruling' })
  await expect(side).toContainText('Claim this case to start.')
  await expect(side.getByRole('radio', { name: /Uphold/ })).toBeDisabled()
  await expect(reasonBox(page)).toBeDisabled()
  await expect(side.getByRole('button', { name: 'Give Ruling' })).toBeDisabled()
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])

  await page.getByRole('button', { name: 'Claim', exact: true }).click()
  await expect(reasonBox(page)).toBeEnabled()
  await expect(side).not.toContainText('Claim this case to start.')
})

for (const ui of ['rift', 'classic'] as const) {
  for (const height of [900, 720]) {
    test(`on desktop the Ruling form stays usable with the evidence scrolled to the bottom (${ui}, ${height} high)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height })
      await onCase(page, 'admin', longCase(), () => inInterface(page, ui))
      await expect(page.locator('html')).toHaveAttribute('data-interface', ui)
      await expect(page.getByRole('region', { name: 'Earlier disputes' })).toBeVisible() // loaded, so there is something to scroll
      await expect(page.getByRole('region', { name: 'Earlier disputes' })).not.toBeInViewport()
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await expect(page.getByRole('region', { name: 'Earlier disputes' })).toBeInViewport()
      const side = page.getByRole('region', { name: 'Write ruling' })
      await expect(side).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('button', { name: 'Write ruling' })).toBeHidden()

      await page.getByRole('radio', { name: /Uphold/ }).check()
      await reasonBox(page).fill('The clip shows it.')
      // Reaching the controls may scroll the column itself, never the page away from the evidence.
      const scrolled = await page.evaluate(() => window.scrollY)
      await page.getByRole('button', { name: 'Give Ruling' }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('button', { name: 'Give Ruling' })).toBeInViewport({ ratio: 1 })
      expect(await page.evaluate(() => window.scrollY)).toBe(scrolled)
    })
  }
}

/** A route for onCase's `extraRoutes`: the Admin is also searching for a match, so the match status card shows. */
const searching = async (page: Page) => {
  const queue = { game: 'nt', mode: '1v1', bestOf: 3, platform: 'PS4', region: 'EU', joinedAt: new Date().toISOString(), source: 'web' }
  await page.route('**/api/queue', (r) => r.fulfill(json({ queue, match: null, searching: { '012': 0, nt: 1 }, disputes: [] })))
}

const box = async (locator: Locator) => (await locator.boundingBox())!
const bottom = async (locator: Locator) => (await box(locator)).y + (await box(locator)).height

/** Scrolls, as a finger would, until this part of the page ends just above the panel; then it must be there. */
async function scrollAbove(page: Page, evidence: Locator, panel: Locator) {
  const x = page.viewportSize()!.width / 2
  await page.mouse.move(x, 150)
  await expect(async () => {
    const over = (await bottom(evidence)) - (await box(panel)).y + 8
    if (over > 8) await page.mouse.wheel(0, over)
    expect(await bottom(evidence)).toBeLessThanOrEqual((await box(panel)).y)
  }).toPass({ timeout: 5000 })
}

test.describe('the Ruling panel at phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  const bar = (page: Page) => page.getByRole('button', { name: 'Write ruling' })
  const panel = (page: Page) => page.getByRole('region', { name: 'Write ruling' })
  const phoneNav = (page: Page) => page.getByRole('navigation', { name: 'Phone navigation' })
  const lastEvidence = (page: Page) => page.getByRole('region', { name: 'Earlier disputes' })
  const intoView = (page: Page) => lastEvidence(page).evaluate((el) => el.scrollIntoView({ block: 'center' }))

  test('a bar pinned to the bottom opens a half-height panel, with the evidence scrolling above it', async ({ page }) => {
    await onCase(page, 'admin', longCase())
    await expect(reasonBox(page)).toBeHidden()
    const navTop = (await box(phoneNav(page))).y
    for (const y of [0, 600]) {
      await page.evaluate((to) => window.scrollTo(0, to), y)
      await expect.poll(async () => {
        const b = await box(panel(page))
        return Math.abs(b.y + b.height - navTop)
      }).toBeLessThanOrEqual(1)
      await expect(bar(page)).toBeInViewport({ ratio: 1 })
    }

    await bar(page).click()
    await expect(reasonBox(page)).toBeVisible()
    await expect(bar(page)).toBeHidden()
    await expect(panel(page).getByRole('heading', { name: 'Write ruling' })).toBeFocused()
    const open = await box(panel(page))
    expect(Math.abs(open.height - navTop / 2)).toBeLessThanOrEqual(2)
    expect(Math.abs(open.y + open.height - navTop)).toBeLessThanOrEqual(1)

    // The last of the evidence can be brought up clear of the panel, which doesn't move.
    await scrollAbove(page, lastEvidence(page), panel(page))
    expect((await box(panel(page))).y).toBeCloseTo(open.y, 0)
    await expect(reasonBox(page)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  })

  test('the panel opens and closes without losing what was typed or picked', async ({ page }) => {
    await onCase(page, 'admin', longCase())
    await bar(page).click()
    await page.getByRole('radio', { name: /Overturn/ }).check()
    await page.getByLabel('Game 1 winner').selectOption({ label: 'Rival' })
    await reasonBox(page).fill('The clip shows Rival won.')
    await panel(page).getByRole('button', { name: 'Hide panel' }).click()
    await expect(reasonBox(page)).toBeHidden()
    await expect(bar(page)).toBeFocused()
    await bar(page).click()
    await expect(reasonBox(page)).toHaveValue('The clip shows Rival won.')
    await expect(page.getByRole('radio', { name: /Overturn/ })).toBeChecked()
    await expect(page.getByLabel('Game 1 winner')).toHaveValue('2')
  })

  test('a Ruling given from the panel puts it away and shows the result', async ({ page }) => {
    await onCase(page, 'admin', longCase())
    await intoView(page)
    await bar(page).click()
    await page.getByRole('radio', { name: /Uphold/ }).check()
    await reasonBox(page).fill('The clip shows it.')
    await page.getByRole('button', { name: 'Give Ruling' }).click()
    await expect(status(page).getByText('Ruling: Upheld')).toBeInViewport()
    await expect(panel(page)).toBeHidden()
    await expect(bar(page)).toHaveCount(0)
  })

  test('there is no bar until the Admin holds the Claim', async ({ page }) => {
    await onCase(page, 'admin', longCase({ claim: null, canAct: false }))
    await expect(status(page)).toContainText('Unclaimed.')
    await expect(bar(page)).toHaveCount(0)
    await expect(panel(page)).toBeHidden()
    await page.getByRole('button', { name: 'Claim', exact: true }).click()
    await expect(bar(page)).toBeInViewport({ ratio: 1 })
  })

  test('the bar and panel stay clear of the match status card', async ({ page }) => {
    await onCase(page, 'admin', longCase(), () => searching(page))
    const card = page.getByRole('region', { name: 'Match status' })
    await expect(card).toBeVisible()
    await expect(bar(page)).toBeInViewport({ ratio: 1 })
    expect((await box(panel(page))).y + (await box(panel(page))).height).toBeLessThanOrEqual((await box(card)).y + 1)
    await bar(page).click()
    const open = await box(panel(page))
    expect(open.y + open.height).toBeLessThanOrEqual((await box(card)).y + 1)
    await page.getByRole('radio', { name: /Uphold/ }).check()
    await reasonBox(page).fill('The clip shows it.')
    await page.getByRole('button', { name: 'Give Ruling' }).click({ trial: true })
    await card.getByRole('button', { name: 'Cancel' }).click({ trial: true })
    await scrollAbove(page, lastEvidence(page), panel(page))
    await expect(reasonBox(page)).toBeVisible()
  })

  test('Classic gets the same bar and panel', async ({ page }) => {
    await onCase(page, 'admin', longCase(), () => inInterface(page, 'classic'))
    await expect(page.locator('html')).toHaveAttribute('data-interface', 'classic')
    await intoView(page)
    await expect(bar(page)).toBeInViewport({ ratio: 1 })
    await bar(page).click()
    await reasonBox(page).fill('The clip shows it.')
    await expect(panel(page)).toBeInViewport({ ratio: 1 })
    await panel(page).getByRole('button', { name: 'Hide panel' }).click()
    await expect(bar(page)).toBeInViewport({ ratio: 1 })
  })

  for (const mode of ['chaos', 'cosmos'] as const) {
    test(`the case page passes axe in ${modeName(mode)}, with the panel closed and open`, async ({ page }) => {
      await onCase(page, 'admin', longCase(), () => inInterface(page, 'rift', mode))
      await expect(page.locator('html')).toHaveAttribute('data-rift-mode', mode)
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
      await bar(page).click()
      await expect(reasonBox(page)).toBeVisible()
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
    })
  }
})

// Between phone and desktop the bar stays, above Rift's help strip.
for (const mode of ['chaos', 'cosmos'] as const) {
  test(`at tablet width in ${modeName(mode)} the bar sits above the help strip, and the status card above the bar`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1000 })
    await onCase(page, 'admin', longCase(), async () => {
      await searching(page)
      await inInterface(page, 'rift', mode)
    })
    const bar = page.getByRole('button', { name: 'Write ruling' })
    const card = page.getByRole('region', { name: 'Match status' })
    await expect(card).toBeVisible()
    await bar.click({ trial: true })
    await card.getByRole('button', { name: 'Cancel' }).click({ trial: true })
    const panel = page.getByRole('region', { name: 'Write ruling' })
    const strip = await box(page.getByText('Point at or focus an item to see what it does.'))
    expect((await box(panel)).y + (await box(panel)).height).toBeLessThanOrEqual(strip.y)
    await bar.click()
    await page.getByRole('radio', { name: /Uphold/ }).check()
    await reasonBox(page).fill('The clip shows it.')
    await page.getByRole('button', { name: 'Give Ruling' }).click({ trial: true })
  })
}

test('on desktop the match status card does not cover the Ruling form', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await onCase(page, 'admin', longCase(), () => searching(page))
  const card = page.getByRole('region', { name: 'Match status' })
  await expect(card).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const side = await box(page.getByRole('region', { name: 'Write ruling' }))
  expect(side.y).toBeGreaterThanOrEqual(0)
  expect(side.y + side.height).toBeLessThanOrEqual((await box(card)).y)
  await page.getByRole('radio', { name: /Uphold/ }).check()
  await reasonBox(page).fill('The clip shows it.')
  await page.getByRole('button', { name: 'Give Ruling' }).click({ trial: true })
})
