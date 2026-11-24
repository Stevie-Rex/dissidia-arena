import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './mock'

// Seen from the signed-in tester (id 1). The opponent (id 2) reported a 2-1 win.
const player = (id: number, displayName: string) => ({ id, displayName, avatarUrl: '', region: 'EU', gameId: `id${id}`, accepted: true })

const noShots = { you: [], opponent: [] }
const shot = (id: number, removed = false) => ({
  id, url: removed ? null : `/api/matches/42/screenshots/${id}`, at: '2026-11-21T12:10:00Z', round: 0, removed,
})
// A 1x1 PNG, enough for the browser to load an <img>.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

function reportedMatch(overrides: Record<string, unknown> = {}) {
  const match = {
    id: 42, game: 'nt', mode: '1v1', bestOf: 3, platform: 'PS4', region: 'EU', status: 'reported',
    acceptDeadline: '2026-11-21T10:00:00Z', createdAt: '2026-11-21T10:00:00Z', finishedAt: null,
    confirmDeadline: new Date(Date.now() + 2 * 3600_000 - 30_000).toISOString().replace(/\.\d+Z$/, 'Z'),
    host: 'you', you: player(1, 'Tester'), opponent: player(2, 'Rival'), winsNeeded: 2,
    score: { you: 1, opponent: 2 },
    games: [
      { n: 1, winner: 'opponent', reportedBy: 'opponent', details: {} },
      { n: 2, winner: 'you', reportedBy: 'opponent', details: {} },
      { n: 3, winner: 'opponent', reportedBy: 'opponent', details: {} },
    ],
    winner: 'opponent', reportedBy: 'opponent', endedBy: null, dispute: null, rewardsUnlocked: [], messages: [],
    ...overrides,
  }
  // The server always sends a dispute's screenshots, so a dispute written without them has none.
  if (match.dispute) match.dispute = { screenshots: noShots, ...(match.dispute as object) }
  return match
}

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

/** The match room with this match current, recording what the page sends. */
async function inRoom(page: Page, match: Record<string, unknown>) {
  await mockApi(page, { wins: 0 })
  const sent: { method: string; path: string; body: unknown }[] = []
  let current = match
  await page.route('**/api/queue', (r) =>
    r.fulfill(json({ queue: null, match: current.status === 'reported' ? current : null, searching: { '012': 0, nt: 0 }, disputes: [] })),
  )
  await page.route('**/api/matches/42**', (r) => {
    const req = r.request()
    const path = new URL(req.url()).pathname
    if (req.method() !== 'GET') sent.push({ method: req.method(), path, body: req.postDataJSON() })
    if (path.endsWith('/dispute')) {
      const { games, reason } = req.postDataJSON()
      current = { ...current, status: 'disputed', endedBy: 'you', confirmDeadline: null,
        dispute: { games, reason, by: 'you', statements: { you: null, opponent: null }, screenshots: noShots } }
    } else if (path.endsWith('/statement')) {
      const d = current.dispute as { statements: Record<string, unknown> }
      current = { ...current, dispute: { ...d, statements: { ...d.statements, you: { text: req.postDataJSON().text, updatedAt: '2026-11-21T12:00:00Z' } } } }
    }
    return r.fulfill(json(current))
  })
  await page.goto('/match/live')
  return sent
}

test('the opponent disputes through the form: games, a reason, then their statement', async ({ page }) => {
  const sent = await inRoom(page, reportedMatch())
  await page.getByRole('button', { name: 'Dispute' }).click()

  const form = page.getByRole('form', { name: 'Dispute the result' })
  await expect(form).toBeVisible()
  expect((await new AxeBuilder({ page }).include('form[aria-label="Dispute the result"]').analyze()).violations).toEqual([])

  // Both a game and a reason are required.
  await form.getByRole('button', { name: 'Submit dispute' }).click()
  await expect(form.getByText('Tick the games you dispute.')).toBeVisible()
  expect(sent).toEqual([])

  await form.getByRole('checkbox', { name: /Game 3/ }).check()
  await form.getByRole('textbox', { name: 'Why are you disputing?' }).fill('Game 3 was mine, they misreported.')
  await form.getByRole('button', { name: 'Submit dispute' }).click()

  expect(sent).toEqual([
    { method: 'POST', path: '/api/matches/42/dispute', body: { games: [3], reason: 'Game 3 was mine, they misreported.' } },
  ])
  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel).toContainText('Disputed games: 3')
  await expect(panel).toContainText('Game 3 was mine, they misreported.')
  await expect(panel).toContainText('Rival has not added their side yet.')

  await panel.getByRole('textbox', { name: 'Your side' }).fill('Video in Discord.')
  await panel.getByRole('button', { name: 'Save your side' }).click()
  await expect(panel.getByText('Video in Discord.')).toBeVisible()
  expect(sent.at(-1)).toEqual({ method: 'PUT', path: '/api/matches/42/statement', body: { text: 'Video in Discord.' } })
})

test('a reported result shows the countdown to auto-confirm', async ({ page }) => {
  await inRoom(page, reportedMatch())
  await expect(page.getByText(/Confirms automatically in 1:59:\d\d/)).toBeVisible()
})

test('the reporting player gets a notice and can add their side', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  const disputed = reportedMatch({
    status: 'disputed', reportedBy: 'you', winner: 'you', endedBy: 'opponent', confirmDeadline: null,
    dispute: { games: [2], reason: 'I won game 2.', by: 'opponent', statements: { you: null, opponent: { text: 'Lag spike.', updatedAt: '2026-11-21T12:00:00Z' } } },
  })
  await page.route('**/api/queue', (r) =>
    r.fulfill(json({ queue: null, match: null, searching: { '012': 0, nt: 0 },
      disputes: [{ id: 42, game: 'nt', opponent: 'Rival', youReported: true, statementAdded: false }] })),
  )
  await page.route('**/api/matches/42', (r) => r.fulfill(json(disputed)))
  await page.goto('/nt')

  const notice = page.getByRole('status').filter({ hasText: 'Rival disputed your result' })
  await expect(notice).toBeVisible()
  await notice.getByRole('link', { name: 'Add your side' }).click()

  await expect(page).toHaveURL(/\/match\/live\?match=42$/)
  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel).toContainText('I won game 2.')
  await expect(panel).toContainText('Lag spike.')
  await expect(panel.getByRole('textbox', { name: 'Your side' })).toBeVisible()
})

test('a match disputed before the form shows no details', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  const legacy = reportedMatch({
    status: 'disputed', endedBy: 'you', confirmDeadline: null,
    dispute: { games: [], reason: null, by: 'you', statements: { you: null, opponent: null } },
  })
  await page.route('**/api/matches/42', (r) => r.fulfill(json(legacy)))
  await page.goto('/match/live?match=42')
  await expect(page.getByRole('region', { name: 'Dispute' })).toContainText('No details (filed before the dispute form)')
})

test('a Disputed match stays open while you are in a new match, and picks up their side', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  let disputed = reportedMatch({
    status: 'disputed', reportedBy: 'you', winner: 'you', endedBy: 'opponent', confirmDeadline: null,
    dispute: { games: [2], reason: 'I won game 2.', by: 'opponent', statements: { you: null, opponent: null } },
  })
  // Meanwhile the player queued again and is in match 50.
  const current = reportedMatch({ id: 50, status: 'active', score: { you: 0, opponent: 0 }, games: [], winner: null, reportedBy: null, confirmDeadline: null })
  await page.route('**/api/queue', (r) =>
    r.fulfill(json({ queue: null, match: current, searching: { '012': 0, nt: 0 },
      disputes: [{ id: 42, game: 'nt', opponent: 'Rival', youReported: true, statementAdded: false }] })),
  )
  await page.route('**/api/matches/42', (r) => r.fulfill(json(disputed)))
  await page.goto('/nt')
  await page.getByRole('link', { name: 'Add your side' }).click()

  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel).toContainText('I won game 2.')
  await page.waitForTimeout(2500) // a queue poll or two
  await expect(panel).toContainText('I won game 2.')
  await expect(page.getByRole('status').filter({ hasText: 'disputed your result' })).toBeHidden()

  disputed = { ...disputed, dispute: { ...(disputed.dispute as object), statements: { you: null, opponent: { text: 'Lag spike.', updatedAt: 'b' } } } }
  await expect(panel).toContainText('Lag spike.', { timeout: 10_000 })
})

test('after a Ruling, players see the outcome and the reason in the match room', async ({ page }) => {
  await inRoom(page, reportedMatch({
    status: 'voided', winner: null, endedBy: 'you', confirmDeadline: null,
    dispute: { games: [3], reason: 'Game 3 was mine.', by: 'you', statements: { you: null, opponent: null } },
    ruling: { outcome: 'void', reason: 'Neither clip shows game 3.', at: '2026-11-21T13:00:00Z' },
  }))
  await page.goto('/match/live?match=42')
  const ruling = page.getByRole('region', { name: 'Ruling' })
  await expect(page.getByText('Match void')).toBeVisible()
  await expect(ruling).toContainText('An Admin voided the match.')
  await expect(ruling).toContainText('Neither clip shows game 3.')
  expect((await new AxeBuilder({ page }).include('[aria-label="Ruling"]').analyze()).violations).toEqual([])
})

test('a Replay shows the Ruling and the countdown to its deadline', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  const replaying = reportedMatch({
    status: 'active', winner: null, reportedBy: null, confirmDeadline: null,
    replayDeadline: new Date(Date.now() + 48 * 3600_000 - 30_000).toISOString().replace(/\.\d+Z$/, 'Z'),
    games: reportedMatch().games.slice(0, 2), score: { you: 1, opponent: 1 }, endedBy: 'you',
    dispute: { games: [3], reason: 'Game 3 was mine.', by: 'you', statements: { you: null, opponent: null } },
    ruling: { outcome: 'replay', reason: 'The clip cuts out, so play game 3 again.', at: '2026-11-21T12:00:00Z' },
  })
  await page.route('**/api/queue', (r) =>
    r.fulfill(json({ queue: null, match: replaying, searching: { '012': 0, nt: 0 }, disputes: [] })),
  )
  await page.route('**/api/matches/42**', (r) => r.fulfill(json(replaying)))
  await page.goto('/match/live')

  const replay = page.getByRole('region', { name: 'Replay' })
  await expect(replay).toContainText('An Admin ruled that this match is replayed. Earlier games stand.')
  await expect(replay).toContainText('The clip cuts out, so play game 3 again.')
  await expect(replay.getByRole('timer')).toHaveText(/Back to the Admins in 47:59:\d\d unless the match is settled/)
  await expect(page.getByText('Game 3 winner?')).toBeVisible()
  expect((await new AxeBuilder({ page }).include('[aria-label="Replay"]').analyze()).violations).toEqual([])
})

test('during a Replay the old dispute is read-only', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  const replaying = reportedMatch({
    status: 'active', winner: null, reportedBy: null, confirmDeadline: null,
    replayDeadline: new Date(Date.now() + 48 * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z'),
    games: reportedMatch().games.slice(0, 2), score: { you: 1, opponent: 1 }, endedBy: 'you',
    dispute: { games: [3], reason: 'Game 3 was mine.', by: 'you', statements: { you: null, opponent: null } },
    ruling: { outcome: 'replay', reason: 'Play game 3 again.', at: '2026-11-21T12:00:00Z' },
  })
  await page.route('**/api/queue', (r) => r.fulfill(json({ queue: null, match: replaying, searching: { '012': 0, nt: 0 }, disputes: [] })))
  await page.route('**/api/matches/42**', (r) => r.fulfill(json(replaying)))
  await page.goto('/match/live')

  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel).toContainText('Read-only: this dispute led to a Replay.')
  await expect(panel.getByRole('textbox')).toHaveCount(0)
  await expect(panel.getByRole('button')).toHaveCount(0)
})

test('a new dispute after a Replay starts your side afresh', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  let shown = reportedMatch({
    status: 'disputed', endedBy: 'you', confirmDeadline: null,
    dispute: { round: 0, games: [3], reason: 'Game 3 was mine.', by: 'you',
      statements: { you: { text: 'My old side.', updatedAt: '2026-11-21T12:00:00Z' }, opponent: null } },
  })
  await page.route('**/api/matches/42', (r) => r.fulfill(json(shown)))
  await page.goto('/match/live?match=42')
  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel).toContainText('My old side.')

  // Replayed, and the replayed game 3 disputed again: the server cleared both sides.
  shown = { ...shown, dispute: { round: 1, games: [3], reason: 'Lag again.', by: 'you', statements: { you: null, opponent: null }, screenshots: noShots } }
  await expect(panel).toContainText('Lag again.', { timeout: 10_000 })
  await expect(panel.getByRole('textbox', { name: 'Your side' })).toHaveValue('')
})


/** A Disputed match whose server state the test changes as uploads arrive. Records every upload. */
async function disputedWithUploads(page: Page, opponentShots: unknown[], yours: unknown[] = []) {
  await mockApi(page, { wins: 0 })
  const uploads: { header: string | undefined; type: string | undefined }[] = []
  let mine = yours
  const current = () =>
    reportedMatch({
      status: 'disputed', endedBy: 'you', confirmDeadline: null,
      dispute: { round: 0, games: [3], reason: 'Game 3 was mine.', by: 'you', statements: { you: null, opponent: null },
        screenshots: { you: mine, opponent: opponentShots } },
    })
  await page.route('**/api/matches/42', (r) => r.fulfill(json(current())))
  await page.route('**/api/matches/42/screenshots', (r) => {
    const headers = r.request().headers()
    uploads.push({ header: headers['x-arena-upload'], type: headers['content-type'] })
    mine = [...mine, shot(100 + mine.length)]
    return r.fulfill({ ...json(current()), status: 201 })
  })
  await page.route('**/api/matches/42/screenshots/*', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await page.goto('/match/live?match=42')
  return uploads
}

test('you can add up to three screenshots to a dispute, and see your opponent\'s', async ({ page }) => {
  const uploads = await disputedWithUploads(page, [shot(1)])
  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel.getByRole('img', { name: 'Screenshot 1 from Rival' })).toBeVisible()
  await expect(panel.getByLabel('Add a screenshot (0 of 3)')).toBeVisible()
  expect((await new AxeBuilder({ page }).include('[aria-label="Dispute"]').analyze()).violations).toEqual([])

  const file = { name: 'clip.png', mimeType: 'image/png', buffer: PNG }
  await panel.getByLabel('Add a screenshot (0 of 3)').setInputFiles(file)
  await expect(panel.getByRole('img', { name: 'Screenshot 1 from you' })).toBeVisible()
  // A multipart upload with the custom header the server requires.
  expect(uploads).toHaveLength(1)
  expect(uploads[0].header).toBe('1')
  expect(uploads[0].type).toMatch(/^multipart\/form-data; boundary=/)

  await panel.getByLabel('Add a screenshot (1 of 3)').setInputFiles(file)
  await panel.getByLabel('Add a screenshot (2 of 3)').setInputFiles(file)
  await expect(panel.getByText('You have added all 3 screenshots.')).toBeVisible()
  await expect(panel.getByLabel(/Add a screenshot/)).toHaveCount(0)
  expect((await new AxeBuilder({ page }).include('[aria-label="Dispute"]').analyze()).violations).toEqual([])
})

test('a file over 5 MB is refused before it is sent', async ({ page }) => {
  const uploads = await disputedWithUploads(page, [])
  const panel = page.getByRole('region', { name: 'Dispute' })
  await panel.getByLabel('Add a screenshot (0 of 3)').setInputFiles({
    name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  })
  await expect(panel.getByRole('alert')).toHaveText('Each screenshot can be up to 5 MB.')
  expect(uploads).toEqual([])
})

test('screenshots deleted after 90 days show a placeholder', async ({ page }) => {
  await mockApi(page, { wins: 0 })
  const ruled = reportedMatch({
    status: 'completed', endedBy: 'you', confirmDeadline: null,
    dispute: { round: 0, games: [3], reason: 'Game 3 was mine.', by: 'you', statements: { you: null, opponent: null },
      screenshots: { you: [shot(2, true)], opponent: [shot(1, true), shot(3, true)] } },
    ruling: { outcome: 'uphold', reason: 'The clip is clear.', at: '2026-08-01T12:00:00Z' },
  })
  await page.route('**/api/matches/42', (r) => r.fulfill(json(ruled)))
  await page.goto('/match/live?match=42')
  const panel = page.getByRole('region', { name: 'Dispute' })
  await expect(panel.getByText('Screenshot removed after 90 days')).toHaveCount(3)
  await expect(panel.getByRole('img')).toHaveCount(0)
  // The Ruling is over, so there is nothing left to add to.
  await expect(panel.getByLabel(/Add a screenshot/)).toHaveCount(0)
  expect((await new AxeBuilder({ page }).include('[aria-label="Dispute"]').analyze()).violations).toEqual([])
})
