/*
 * Lab, round 3 (#70): every screen and state to sign off for reopening (#13), Season 1 (#14), Ratings (#71),
 * Leave and Forfeit (#64) and "My opponent's gone" (#72). Each scenario builds a fresh sample world.
 */
import type { GameId } from '../data/mock'
import type { LadderStanding, RatingChange } from '../lib/api'
import {
  DAY,
  MIN,
  at,
  baseMatch,
  meFor,
  msg,
  other,
  season1,
  twoGames,
  type LabMatch,
  type LabWorld,
  type Who,
} from './world'

export interface LabAction {
  label: string
  /** Only offered when you are this player. */
  as?: Who
  run: (w: LabWorld) => void
}

export interface Scenario {
  id: string
  group: string
  title: string
  /** What to look at, or try. */
  note: string
  /** Where the scenario opens. */
  path: string
  /** Who you can be: either player, or the Master. */
  sides: (Who | 'master')[]
  build: (as: Who | 'master') => LabWorld
  /** Things the other player (or the clock) does, from the lab bar. */
  actions?: LabAction[]
  /** Other pages of the same world, linked from the lab bar. */
  pages?: { label: string; path: string }[]
}

const NO_SEASONS: Record<GameId, null> = { '012': null, nt: null }
const LIVE = (): LabWorld['seasons'] => ({ '012': season1('012', 6 * DAY), nt: season1('nt', 6 * DAY) })

const change = (before: number, delta: number, placements: number): RatingChange => ({
  before,
  after: before + delta,
  change: delta,
  placements,
  placed: placements >= 5,
})

/** What a Forfeit does to a match, from Leave or from the countdown. */
export function forfeit(m: LabMatch, by: Who, how: 'left' | 'countdown', w?: LabWorld) {
  const winner = other(by)
  m.status = 'completed'
  m.winner = winner
  m.endedBy = by
  m.forfeit = { by, how }
  m.gone = null
  m.finishedAt = at(0)
  m.settledBy = 'forfeit'
  if (w?.seasons[m.game]) m.ratingChanges = { [winner]: change(1532, 14, 4), [by]: change(1561, -13, 5) } as Record<Who, RatingChange>
  const name = (x: Who) => (x === 'a' ? 'Vesper' : 'Kestrel')
  m.messages.push(
    msg('system', how === 'left' ? `${name(by)} left the match. ${name(winner)} wins by Forfeit.` : `${name(by)} didn't come back in time. ${name(winner)} wins by Forfeit.`),
  )
  if (w) w.current = null
}

export function startCountdown(m: LabMatch, absent: Who) {
  m.gone = { availableAt: m.gone?.availableAt ?? at(0), waitingFor: 'start', countdown: { absent, endsAt: at(5 * MIN) } }
  const name = (x: Who) => (x === 'a' ? 'Vesper' : 'Kestrel')
  m.messages.push(msg('system', `${name(other(absent))} says ${name(absent)} is gone. ${name(absent)} has 5 minutes to come back.`))
}

export function imHere(m: LabMatch) {
  const absent = m.gone?.countdown?.absent
  m.gone = { availableAt: at(5 * MIN), waitingFor: 'here', countdown: null }
  if (absent) m.messages.push(msg('system', `${absent === 'a' ? 'Vesper' : 'Kestrel'} is here.`))
}

const world = (as: Who | 'master', matches: LabMatch[], over: Partial<LabWorld> = {}): LabWorld => ({
  as,
  me: meFor(as),
  matches,
  // The Master plays in none of the sample matches.
  current: as === 'master' ? null : (matches.find((m) => ['pending', 'active', 'reported'].includes(m.status))?.id ?? null),
  seasons: NO_SEASONS,
  ...over,
})

const matchOf = (w: LabWorld) => w.matches[0]

/** A completed 2–1 match won by a, confirmed three days ago. */
const settled = (over: Partial<LabMatch> = {}) =>
  baseMatch({
    status: 'completed',
    games: twoGames('a'),
    winner: 'a',
    reportedBy: 'a',
    createdAt: at(-3 * DAY - 30 * MIN),
    finishedAt: at(-3 * DAY),
    settledBy: 'confirmed',
    gone: null,
    messages: [msg('system', 'Match started', 3 * DAY + 30 * MIN), msg('b', 'gg', 3 * DAY), msg('system', 'Result confirmed', 3 * DAY)],
    ...over,
  })

/** The Master's lookups for the reopen control: one to reopen, one past 90 days, one still being played. */
const reopenable = () => [
  settled({ id: 212 }),
  settled({ id: 188, finishedAt: at(-120 * DAY), createdAt: at(-120 * DAY - 40 * MIN), settledBy: 'uphold' }),
  baseMatch({ id: 215, game: 'nt', platform: 'PS4' }),
  settled({ id: 201, status: 'voided', winner: null, settledBy: 'void', finishedAt: at(-10 * DAY) }),
]

const ladders = (placedNt: boolean): LadderStanding[] => [
  { ladder: '012/PPSSPP', game: '012', platform: 'PPSSPP', rating: 1508, placements: 3, placed: false },
  { ladder: 'nt/PS4', game: 'nt', platform: 'PS4', rating: 1548, placements: placedNt ? 9 : 2, placed: placedNt },
  { ladder: 'nt/PC', game: 'nt', platform: 'PC', rating: 1500, placements: 0, placed: false },
]

export const SCENARIOS: Scenario[] = [
  /* ---------------------------------------------------------------- Reopening (#13) */
  {
    id: 'reopen-control',
    group: 'Reopening (#13)',
    title: "The Master's reopen control",
    note: 'Admins tab, "Reopen a settled match". Look up 212 (can be reopened), 188 (past 90 days), 201 (a void) or 215 (still being played). Reopen asks for a reason.',
    path: '/admin/admins',
    sides: ['master'],
    build: (as) => world(as, reopenable(), { seasons: LIVE() }),
  },
  {
    id: 'reopen-room',
    group: 'Reopening (#13)',
    title: 'The match room after a reopen',
    note: 'Vesper won this match; the Master reopened it. Switch "You are" to see it as each player.',
    path: '/match/live?match=212',
    sides: ['a', 'b'],
    build: (as) =>
      world(
        as,
        [
          settled({
            status: 'disputed',
            winner: null,
            settledBy: null,
            reopened: { at: at(-10 * MIN), reason: 'Kestrel sent clips showing game 3 was a disconnect, not a win. Ruling again.', tookBackFrom: 'a' },
            dispute: { round: 1, games: [1, 2, 3], reason: null, by: null },
            messages: [
              msg('system', 'Match started', 3 * DAY + 30 * MIN),
              msg('b', 'gg', 3 * DAY),
              msg('system', 'Result confirmed', 3 * DAY),
              msg('system', 'The Master reopened this match', 10 * MIN),
            ],
          }),
        ],
        { current: null, seasons: LIVE() },
      ),
  },

  /* ---------------------------------------------------------------- Season 1 (#14) */
  {
    id: 'season-before',
    group: 'Starting Season 1 (#14)',
    title: 'Start Season 1, before',
    note: 'Admins tab, "Seasons". Neither game has started. Press Start Season 1: it asks for a reason, then the row turns live.',
    path: '/admin/admins',
    sides: ['master'],
    build: (as) => world(as, reopenable()),
  },
  {
    id: 'season-after',
    group: 'Starting Season 1 (#14)',
    title: 'Start Season 1, after (012 started)',
    note: '012 started Season 1 just now; NT is still in pre-season.',
    path: '/admin/admins',
    sides: ['master'],
    build: (as) => world(as, reopenable(), { seasons: { '012': season1('012', 2 * MIN), nt: null } }),
  },

  /* ---------------------------------------------------------------- Ratings (#71) */
  {
    id: 'ratings-preseason',
    group: 'Ratings (#71)',
    title: 'Hub and profile before Season 1',
    note: 'No Season yet: the Hub and profile say Ratings start with Season 1.',
    path: '/012',
    sides: ['a'],
    build: (as) => world(as, []),
    pages: [
      { label: '012 Hub', path: '/012' },
      { label: 'Profile', path: '/players/me' },
    ],
  },
  {
    id: 'ratings-placing',
    group: 'Ratings (#71)',
    title: 'Hub and profile while placing',
    note: '012: Placement 3/5. NT: PS4 Placement 2/5, PC not played yet. Try the NT Hub and the profile.',
    path: '/012',
    sides: ['a'],
    build: (as) => world(as, [], { seasons: LIVE(), me: meFor(as, { ladders: ladders(false) }) }),
    pages: [
      { label: '012 Hub', path: '/012' },
      { label: 'NT Hub', path: '/nt' },
      { label: 'Profile', path: '/players/me' },
    ],
  },
  {
    id: 'ratings-placed',
    group: 'Ratings (#71)',
    title: 'Hub and profile once placed',
    note: 'NT PS4 is placed with a Rating of 1548; NT PC and 012 are still placing.',
    path: '/nt',
    sides: ['a'],
    build: (as) => world(as, [], { seasons: LIVE(), me: meFor(as, { ladders: ladders(true) }) }),
    pages: [
      { label: 'NT Hub', path: '/nt' },
      { label: '012 Hub', path: '/012' },
      { label: 'Profile', path: '/players/me' },
    ],
  },
  {
    id: 'ratings-result',
    group: 'Ratings (#71)',
    title: 'Rating change on the match result',
    note: 'Vesper won 2–1. Vesper is placed; Kestrel is on Placement 4/5. Switch "You are".',
    path: '/match/live?match=212',
    sides: ['a', 'b'],
    build: (as) =>
      world(as, [settled({ finishedAt: at(-1 * MIN), ratingChanges: { a: change(1548, 16, 9), b: change(1530, -21, 4) } })], {
        seasons: LIVE(),
      }),
  },
  {
    id: 'ratings-result-preseason',
    group: 'Ratings (#71)',
    title: 'Match result before Season 1',
    note: 'Pre-season: no Rating change. The win still counts toward unlocks.',
    path: '/match/live?match=212',
    sides: ['a', 'b'],
    build: (as) => world(as, [settled({ finishedAt: at(-1 * MIN) })]),
  },

  /* ---------------------------------------------------------------- Leave (#64) */
  {
    id: 'leave-confirm',
    group: 'Leave and Forfeit (#64)',
    title: 'Leave: the confirm dialog',
    note: 'Game 2 of an active match. Press "Leave match" for the dialog; Leave makes it a Forfeit. Or play the other side: "Kestrel leaves".',
    path: '/match/live',
    sides: ['a'],
    build: (as) => world(as, [baseMatch({ games: twoGames('b').slice(0, 1) })], { seasons: LIVE() }),
    actions: [{ label: 'Kestrel leaves', as: 'a', run: (w) => forfeit(matchOf(w), 'b', 'left', w) }],
  },
  {
    id: 'leave-replay',
    group: 'Leave and Forfeit (#64)',
    title: 'Leave during a Replay',
    note: 'In a Replay, Leave sends the match back to the Admins instead of a Forfeit.',
    path: '/match/live',
    sides: ['a'],
    build: (as) =>
      world(as, [
        baseMatch({
          games: twoGames('b').slice(0, 1),
          ruling: { outcome: 'replay', reason: 'Game 2 had a disconnect. Replay from game 2.', at: at(-30 * MIN) },
          replayDeadline: at(47 * 60 * MIN),
        }),
      ]),
  },
  {
    id: 'forfeit-left',
    group: 'Leave and Forfeit (#64)',
    title: 'After a Forfeit by Leave',
    note: 'Kestrel pressed Leave at 1–0 to Kestrel. Switch "You are" to see both players.',
    path: '/match/live?match=212',
    sides: ['a', 'b'],
    build: (as) => {
      const m = baseMatch({ games: twoGames('b').slice(0, 1) })
      const w = world(as, [m], { seasons: LIVE() })
      forfeit(m, 'b', 'left', w)
      return w
    },
  },

  /* ---------------------------------------------------------------- "My opponent's gone" (#72) */
  {
    id: 'gone-waiting',
    group: '"My opponent\'s gone" (#72)',
    title: 'Button disabled at the start',
    note: 'The match started 40 seconds ago: the button shows how long until it can be pressed. It turns on by itself.',
    path: '/match/live',
    sides: ['a'],
    build: (as) =>
      world(as, [
        baseMatch({
          createdAt: at(-40_000),
          gone: { availableAt: at(80_000), waitingFor: 'start', countdown: null },
          messages: [msg('system', 'Match started', 40_000)],
        }),
      ]),
  },
  {
    id: 'gone-ready',
    group: '"My opponent\'s gone" (#72)',
    title: 'Button ready',
    note: 'Press "My opponent\'s gone" to start the 5-minute countdown.',
    path: '/match/live',
    sides: ['a'],
    build: (as) => world(as, [baseMatch({ games: twoGames('a').slice(0, 1) })]),
    actions: [
      { label: 'Kestrel presses "I\'m here"', as: 'a', run: (w) => imHere(matchOf(w)) },
      { label: 'Run the countdown out', run: (w) => countdownOut(w) },
    ],
  },
  {
    id: 'gone-countdown',
    group: '"My opponent\'s gone" (#72)',
    title: 'The 5-minute countdown',
    note: 'Vesper started it; Kestrel is the absent player. As Kestrel you get "I\'m here". Switch "You are".',
    path: '/match/live',
    sides: ['a', 'b'],
    build: (as) => {
      const m = baseMatch({ games: twoGames('a').slice(0, 1) })
      startCountdown(m, 'b')
      m.gone!.countdown!.endsAt = at(4 * MIN + 12_000)
      return world(as, [m])
    },
    actions: [
      { label: 'Kestrel presses "I\'m here"', as: 'a', run: (w) => imHere(matchOf(w)) },
      { label: 'Run the countdown out', run: (w) => countdownOut(w) },
    ],
  },
  {
    id: 'gone-cooldown',
    group: '"My opponent\'s gone" (#72)',
    title: 'After "I\'m here"',
    note: 'Kestrel pressed "I\'m here" a minute ago: the button waits 5 minutes from then.',
    path: '/match/live',
    sides: ['a', 'b'],
    build: (as) => {
      const m = baseMatch({ games: twoGames('a').slice(0, 1) })
      startCountdown(m, 'b')
      imHere(m)
      m.gone!.availableAt = at(4 * MIN)
      return world(as, [m])
    },
  },
  {
    id: 'gone-forfeit',
    group: '"My opponent\'s gone" (#72)',
    title: 'After the countdown runs out',
    note: 'Kestrel never pressed "I\'m here". Switch "You are" to see both players.',
    path: '/match/live?match=212',
    sides: ['a', 'b'],
    build: (as) => {
      const m = baseMatch({ games: twoGames('a').slice(0, 1) })
      startCountdown(m, 'b')
      const w = world(as, [m], { seasons: LIVE() })
      forfeit(m, 'b', 'countdown', w)
      return w
    },
  },
]

function countdownOut(w: LabWorld) {
  const m = matchOf(w)
  if (m.status !== 'active') return
  if (!m.gone?.countdown) startCountdown(m, 'b')
  // A moment's lead, so a room that hasn't loaded the match yet still sees it end.
  m.gone!.countdown!.endsAt = at(2000)
}

export const scenarioById = (id: string | null) => SCENARIOS.find((s) => s.id === id) ?? null
