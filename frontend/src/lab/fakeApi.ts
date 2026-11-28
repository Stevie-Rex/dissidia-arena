/*
 * Lab, round 3 (#70): a fake /api for the real app, so every screen opens with no backend and no sign-in.
 * Dev-only; main.tsx installs it when a lab scenario is on. This branch never merges.
 */
import type { GameId } from '../data/mock'
import type { Match, QueueState, Season, SettledMatchInfo, Side } from '../lib/api'
import { DEFAULT_PREFERENCES, REWARDS, rewardStatus, type Preferences } from '../theme/appearance'
import { forfeit, imHere, scenarioById, startCountdown, type Scenario } from './scenarios'
import { DAY, MIN, PLAYER_A, PLAYER_B, at, msg, other, type LabMatch, type LabWorld, type Who } from './world'

const KEY = 'da-lab'

export interface LabSession {
  scenario: string
  as: Who | 'master'
  mode: 'chaos' | 'cosmos'
}

/** The lab session from the URL (?lab=&as=&mode=), or the one this tab already has. */
export function readSession(): LabSession | null {
  const q = new URLSearchParams(window.location.search)
  let s: LabSession | null = null
  try {
    s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as LabSession | null
  } catch {
    s = null
  }
  const id = q.get('lab')
  if (id && scenarioById(id)) {
    const sc = scenarioById(id)!
    const as = q.get('as') as LabSession['as'] | null
    s = {
      scenario: id,
      as: as && sc.sides.includes(as) ? as : sc.sides[0],
      mode: q.get('mode') === 'cosmos' ? 'cosmos' : q.get('mode') === 'chaos' ? 'chaos' : (s?.mode ?? 'chaos'),
    }
  }
  if (s && !scenarioById(s.scenario)) s = null
  return s
}

export function saveSession(s: LabSession | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s))
    else sessionStorage.removeItem(KEY)
  } catch {
    /* the lab still works for this page load */
  }
}

let session: LabSession
let scenario: Scenario
let world: LabWorld
let prefs: Preferences

export const labState = () => ({ session, scenario, world })

/** Something the other player (or the clock) does, from the lab bar. */
export function runAction(index: number) {
  scenario.actions?.[index]?.run(world)
}

const seen = (w: LabWorld): Who => (w.as === 'master' ? 'a' : w.as)

function view(m: LabMatch, w: LabWorld): Match {
  const me = seen(w)
  const side = (x: Who): Side => (x === me ? 'you' : 'opponent')
  const sideOrNull = (x: Who | null) => (x ? side(x) : null)
  const player = (x: Who) => {
    const p = x === 'a' ? PLAYER_A : PLAYER_B
    return { id: p.id, displayName: p.displayName, avatarUrl: '', gameId: p.gameId, accepted: true }
  }
  const score = { you: 0, opponent: 0 }
  for (const g of m.games) score[side(g.winner)]++
  const byWho = <T,>(r: Record<Who, T>): Record<Side, T> => ({ you: r[me], opponent: r[other(me)] })
  const open = ['active', 'reported'].includes(m.status)
  return {
    id: m.id,
    game: m.game,
    mode: '1v1',
    bestOf: 3,
    platform: m.platform,
    region: 'EU',
    status: m.status,
    acceptDeadline: m.createdAt,
    confirmDeadline: null,
    replayDeadline: m.replayDeadline,
    replayNotFinished: false,
    createdAt: m.createdAt,
    finishedAt: m.finishedAt,
    host: side(m.host),
    you: player(me),
    opponent: player(other(me)),
    winsNeeded: 2,
    score,
    games: m.games.map((g) => ({ n: g.n, winner: side(g.winner), reportedBy: side(g.reportedBy), details: g.details })),
    winner: sideOrNull(m.winner),
    reportedBy: sideOrNull(m.reportedBy),
    endedBy: sideOrNull(m.endedBy),
    dispute: m.dispute && {
      round: m.dispute.round,
      games: m.dispute.games,
      reason: m.dispute.reason,
      by: sideOrNull(m.dispute.by),
      statements: { you: null, opponent: null },
      screenshots: { you: [], opponent: [] },
    },
    ruling: m.ruling,
    messages: m.messages.map((x) => ({ ...x, from: x.from === 'system' ? 'system' : side(x.from) })),
    canAskAdmin: open || m.status === 'completed' || m.status === 'disputed',
    helpRequest: null,
    rewardsUnlocked: [],
    ratingChanges: m.ratingChanges && byWho(m.ratingChanges),
    forfeit: m.forfeit && { by: side(m.forfeit.by), how: m.forfeit.how },
    reopened: m.reopened && { ...m.reopened, tookBackFrom: sideOrNull(m.reopened.tookBackFrom) },
    gone:
      m.status === 'active' && m.gone
        ? { ...m.gone, countdown: m.gone.countdown && { absent: side(m.gone.countdown.absent), endsAt: m.gone.countdown.endsAt } }
        : null,
  }
}

const REOPEN_DAYS = 90

function settledInfo(m: LabMatch): SettledMatchInfo {
  const score: [number, number] = [m.games.filter((g) => g.winner === 'a').length, m.games.filter((g) => g.winner === 'b').length]
  const settled = !['pending', 'active', 'reported', 'disputed'].includes(m.status)
  return {
    id: m.id,
    game: m.game,
    platform: m.platform,
    players: [PLAYER_A.displayName, PLAYER_B.displayName],
    score,
    status: m.status,
    winner: m.winner ? (m.winner === 'a' ? PLAYER_A : PLAYER_B).displayName : null,
    settledBy: settled ? m.settledBy : null,
    settledAt: settled ? m.finishedAt : null,
    reopenUntil: settled && m.finishedAt ? new Date(Date.parse(m.finishedAt) + REOPEN_DAYS * DAY).toISOString() : null,
    reopened: m.reopened && { at: m.reopened.at, reason: m.reopened.reason },
  }
}

/** The clock: a countdown that ran out is a Forfeit by the absent player, as lifecycle.advance will do. */
function tick() {
  for (const m of world.matches) {
    const c = m.gone?.countdown
    if (m.status === 'active' && c && Date.parse(c.endsAt) <= Date.now()) {
      if (m.replayDeadline) {
        m.status = 'disputed'
        m.gone = null
        m.messages.push(msg('system', 'The countdown ran out. The Replay goes back to the Admins.'))
        world.current = null
      } else forfeit(m, c.absent, 'countdown', world)
    }
  }
}

class Fail {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    this.status = status
    this.body = body
  }
}

function appearance() {
  const wins = world.me.rankedWins
  const unlocks = REWARDS.filter((r) => wins >= r.goal).map((r) => r.key)
  const rewards = rewardStatus(wins, unlocks)
  return { preferences: prefs, ranked_wins: wins, ranked_losses: 9, unlocks, rewards, next: rewards.find((r) => !r.unlocked) ?? null }
}

function handle(method: string, path: string, body: Record<string, unknown>): unknown {
  tick()
  const w = world
  const find = (id: number) => w.matches.find((m) => m.id === id)
  const me = seen(w)
  let r: RegExpMatchArray | null

  if (path === '/me') return w.me
  if (path === '/me/appearance') {
    if (method === 'PATCH') {
      prefs = { ...prefs, ...(body as Partial<Preferences>) }
      if (prefs.rift_mode !== session.mode) {
        session = { ...session, mode: prefs.rift_mode }
        saveSession(session)
      }
    }
    return appearance()
  }
  if (path === '/rewards') return { rewards: REWARDS }
  if (path === '/auth/logout') return null
  if (path === '/queue') {
    const m = w.current ? find(w.current) : undefined
    const state: QueueState = {
      queue: null,
      match: m && ['pending', 'active', 'reported'].includes(m.status) ? view(m, w) : null,
      searching: { '012': 3, nt: 7 },
      disputes: [],
    }
    return state
  }
  if (path === '/seasons') return { seasons: w.seasons }

  if ((r = path.match(/^\/matches\/(\d+)(?:\/(\w+))?$/))) {
    const m = find(Number(r[1]))
    if (!m) throw new Fail(404, { error: 'not_found', message: 'No such match.' })
    const action = r[2]
    if (action === 'leave') {
      if (m.status !== 'active') throw new Fail(409, { error: 'not_active', message: 'The match is not being played.' })
      if (m.replayDeadline) {
        m.status = 'disputed'
        m.endedBy = me
        m.messages.push(msg('system', 'A player left the Replay. It goes back to the Admins.'))
        w.current = null
      } else forfeit(m, me, 'left', w)
    } else if (action === 'gone') {
      if (!m.gone || Date.parse(m.gone.availableAt) > Date.now())
        throw new Fail(409, { error: 'too_soon', message: "You can't say your opponent is gone yet." })
      startCountdown(m, other(me))
    } else if (action === 'here') {
      imHere(m)
    } else if (action === 'messages') {
      m.messages.push(msg(me, String(body.text ?? '')))
    } else if (action) {
      throw new Fail(400, { error: 'lab', message: `The lab doesn't do "${action}" here.` })
    }
    return view(m, w)
  }

  if (path === '/admin/admins') {
    return {
      admins: [
        { id: 7, discordId: '7', username: 'aerith_ref', displayName: 'Lune', avatarUrl: '', role: 'admin', since: at(-40 * DAY) },
        { id: 8, discordId: '8', username: 'grimoire', displayName: 'Grimoire', avatarUrl: '', role: 'admin', since: at(-12 * DAY) },
      ],
    }
  }
  if (path.startsWith('/admin/players')) return { players: [] }
  if (path === '/admin/cases') {
    return {
      cases: w.matches
        .filter((m) => m.status === 'disputed')
        .map((m) => ({
          kind: 'dispute',
          matchId: m.id,
          game: m.game,
          platform: m.platform,
          players: [PLAYER_A.displayName, PLAYER_B.displayName],
          disputedAt: m.reopened?.at ?? at(-5 * MIN),
          replayNotFinished: false,
          claim: null,
        })),
    }
  }
  if ((r = path.match(/^\/admin\/matches\/(\d+)(?:\/(reopen))?$/))) {
    const m = find(Number(r[1]))
    if (!m) throw new Fail(404, { error: 'not_found', message: `There is no match #${r[1]}.` })
    if (r[2]) {
      const info = settledInfo(m)
      if (!info.settledAt) throw new Fail(409, { error: 'not_settled', message: 'Only a settled match can be reopened.' })
      if (Date.parse(info.reopenUntil!) < Date.now())
        throw new Fail(409, { error: 'reopen_window_passed', message: 'The 90 days to reopen this match have passed.' })
      m.reopened = { at: at(0), reason: String(body.reason), tookBackFrom: m.status === 'completed' ? m.winner : null }
      m.status = 'disputed'
      m.winner = null
      m.dispute = { round: (m.dispute?.round ?? -1) + 1, games: m.games.map((g) => g.n), reason: null, by: null }
      m.messages.push(msg('system', 'The Master reopened this match'))
    }
    return settledInfo(m)
  }
  if ((r = path.match(/^\/admin\/seasons\/(012|nt)\/start$/))) {
    const game = r[1] as GameId
    if (w.seasons[game]) throw new Fail(409, { error: 'season_one_started', message: 'Season 1 has already started for this game.' })
    const start = new Date()
    const season: Season = {
      game,
      number: 1,
      startedAt: start.toISOString(),
      endsAt: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate() + 1)).toISOString(),
    }
    w.seasons = { ...w.seasons, [game]: season }
    return { seasons: w.seasons }
  }
  throw new Fail(404, { error: 'not_found', message: 'The lab has no sample data for this.' })
}

const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status: body === null ? 204 : status, headers: { 'Content-Type': 'application/json' } })

/** Serves /api from the sample world. Everything else goes to the real fetch. */
export function install(s: LabSession) {
  session = s
  saveSession(s)
  scenario = scenarioById(s.scenario)!
  world = scenario.build(s.as)
  prefs = { ...DEFAULT_PREFERENCES, rift_mode: s.mode }
  // The cached appearance would flash the last mode before the first fetch.
  try {
    localStorage.removeItem('da-appearance')
  } catch {
    /* fine */
  }
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return real(input, init)
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: Record<string, unknown> = {}
    if (typeof init?.body === 'string') body = JSON.parse(init.body) as Record<string, unknown>
    await new Promise((r) => setTimeout(r, 80))
    try {
      return json(200, handle(method, url.pathname.slice(4), body) ?? null)
    } catch (e) {
      if (e instanceof Fail) return json(e.status, e.body)
      throw e
    }
  }
  // Keep the clock honest while nobody is polling.
  setInterval(tick, 1000)
}
