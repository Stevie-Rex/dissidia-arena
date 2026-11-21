// Mock data standing in for the backend until the API exists.

export type GameId = '012' | 'nt'
export type Region = 'NA' | 'EU' | 'JP' | 'SA' | 'OCE'
export const REGIONS: Region[] = ['NA', 'EU', 'JP', 'SA', 'OCE']

export interface GameInfo {
  id: GameId
  short: string
  name: string
  platform: string
  online: number
  searching: number
  season: number
  seasonDaysLeft: number
  formats: string
  modes: ('1v1' | '3v3')[]
  bestOf: number[]
  platforms: string[]
  helperLabel: 'Assist' | 'Summon'
  idLabel: string
}

export const GAMES: Record<GameId, GameInfo> = {
  '012': {
    id: '012',
    short: '012',
    name: 'Dissidia 012 Duodecim',
    platform: 'PPSSPP netplay',
    online: 64,
    searching: 4,
    season: 7,
    seasonDaysLeft: 30,
    formats: '1v1 Bo3 / Bo5',
    modes: ['1v1'],
    bestOf: [3, 5],
    platforms: ['PPSSPP'],
    helperLabel: 'Assist',
    idLabel: 'PPSSPP nickname',
  },
  nt: {
    id: 'nt',
    short: 'NT',
    name: 'Dissidia NT',
    platform: 'PS4 / PC',
    online: 142,
    searching: 9,
    season: 4,
    seasonDaysLeft: 12,
    formats: '1v1, 3v3 · Bo1 / Bo3',
    modes: ['1v1', '3v3'],
    bestOf: [1, 3],
    platforms: ['PS4', 'PC'],
    helperLabel: 'Summon',
    idLabel: 'PSN / Steam ID',
  },
}

export interface Player {
  id: string
  name: string
  discord: string
  region: Region
  bio: string
  title?: string
  ids: Partial<Record<GameId, string>>
  stats: Record<GameId, { rank: number; rating: number; wins: number; losses: number; main: string; mains: string[]; best?: string }>
}

const p = (
  id: string,
  name: string,
  nt: [number, number, number, number, string],
  d012: [number, number, number, number, string],
  extra: Partial<Player> = {},
): Player => ({
  id,
  name,
  discord: name.toLowerCase().replace(/\s/g, ''),
  region: 'NA',
  bio: '',
  ids: { nt: `${name.toLowerCase().replace(/\s/g, '')}`, '012': name.replace(/\s/g, '') },
  stats: {
    nt: { rank: nt[0], rating: nt[1], wins: nt[2], losses: nt[3], main: nt[4], mains: [nt[4]] },
    '012': { rank: d012[0], rating: d012[1], wins: d012[2], losses: d012[3], main: d012[4], mains: [d012[4]] },
  },
  ...extra,
})

export const ME_ID = 'me'

export const PLAYERS: Player[] = [
  p('player-a', 'Player A', [1, 2104, 88, 21, 'Vaan'], [1, 1988, 61, 14, 'Gabranth']),
  p('player-b', 'Player B', [2, 2077, 70, 19, 'Kain'], [2, 1902, 40, 22, 'Kain'], {
    bio: 'Kain or nothing',
    title: 'S2 Champion',
  }),
  p('player-c', 'Player C', [3, 2010, 64, 30, "Y'shtola"], [3, 1880, 38, 25, 'Cecil']),
  p('player-d', 'Player D', [4, 1990, 51, 28, 'Sephiroth'], [4, 1860, 30, 19, 'Kuja']),
  p('player-e', 'Player E', [5, 1972, 47, 26, 'Ardyn'], [5, 1841, 29, 20, 'Laguna']),
  p('player-g', 'Player G', [198, 1530, 25, 19, 'Kain'], [80, 1610, 12, 11, 'Tifa']),
  p('player-h', 'Player H', [240, 1490, 12, 15, 'Ramza'], [90, 1580, 8, 9, 'Yuna']),
  p('player-i', 'Player I', [180, 1560, 30, 20, 'Warrior of Light'], [70, 1640, 14, 8, 'Cecil']),
  p('player-o', 'Player O', [8, 1931, 44, 22, 'Kain'], [12, 1790, 20, 14, 'Kain']),
  p('player-p', 'Player P', [11, 1905, 41, 25, 'Kain'], [15, 1760, 18, 15, 'Kain']),
  p(ME_ID, 'You', [212, 1520, 22, 18, 'Squall'], [84, 1600, 15, 12, 'Squall'], {
    discord: 'discorduser',
    bio: 'Learning the ropes',
  }),
]

PLAYERS.find((x) => x.id === 'player-b')!.stats.nt.mains = ['Kain', 'Ramza', 'Vaan']
PLAYERS.find((x) => x.id === 'player-b')!.stats.nt.best = '#1 S2'

export const playerById = (id: string) => PLAYERS.find((x) => x.id === id)

export function ladder(game: GameId) {
  return [...PLAYERS].sort((a, b) => a.stats[game].rank - b.stats[game].rank)
}

export interface GameResult {
  n: number
  a: { char: string; helper: string }
  b: { char: string; helper: string }
  stage: string
  winner: 'A' | 'B'
}

export interface Match {
  id: string
  game: GameId
  mode: '1v1' | '3v3'
  bestOf: number
  date: string
  region: Region
  a: { name: string; playerId?: string; before: number; after: number; team?: string[] }
  b: { name: string; playerId?: string; before: number; after: number; team?: string[] }
  games: GameResult[]
}

export const MATCHES: Match[] = [
  {
    id: 'm-1001',
    game: '012',
    mode: '1v1',
    bestOf: 5,
    date: '14 Nov 2026',
    region: 'NA',
    a: { name: 'Player A', playerId: 'player-a', before: 1940, after: 1952 },
    b: { name: 'Player B', playerId: 'player-b', before: 1902, after: 1890 },
    games: [
      { n: 1, a: { char: 'Gabranth', helper: 'Aerith' }, b: { char: 'Cecil', helper: 'Kain' }, stage: "Kefka's Tower", winner: 'A' },
      { n: 2, a: { char: 'Gabranth', helper: 'Aerith' }, b: { char: 'Cecil', helper: 'Tifa' }, stage: "Order's Sanctuary", winner: 'B' },
      { n: 3, a: { char: 'Gabranth', helper: 'Yuna' }, b: { char: 'Cecil', helper: 'Tifa' }, stage: 'Edge of Madness', winner: 'A' },
      { n: 4, a: { char: 'Gabranth', helper: 'Yuna' }, b: { char: 'Laguna', helper: 'Kain' }, stage: 'Pandaemonium', winner: 'A' },
    ],
  },
  {
    id: 'm-1002',
    game: 'nt',
    mode: '3v3',
    bestOf: 3,
    date: '15 Nov 2026',
    region: 'NA',
    a: { name: 'Team A', before: 1810, after: 1822, team: ['P1', 'P2', 'P3'] },
    b: { name: 'Team B', before: 1795, after: 1783, team: ['P4', 'P5', 'P6'] },
    games: [
      { n: 1, a: { char: 'Warrior of Light|Y\'shtola|Vaan', helper: 'Bahamut' }, b: { char: 'Sephiroth|Ardyn|Kefka', helper: 'Odin' }, stage: "Kefka's Tower", winner: 'A' },
      { n: 2, a: { char: 'Warrior of Light|Y\'shtola|Vaan', helper: 'Bahamut' }, b: { char: 'Sephiroth|Ardyn|Kefka', helper: 'Odin' }, stage: 'Pandaemonium', winner: 'B' },
      { n: 3, a: { char: 'Warrior of Light|Y\'shtola|Vaan', helper: 'Ifrit' }, b: { char: 'Sephiroth|Ardyn|Kefka', helper: 'Odin' }, stage: "Orphan's Cradle", winner: 'A' },
    ],
  },
  {
    id: 'm-1003',
    game: 'nt',
    mode: '1v1',
    bestOf: 3,
    date: '15 Nov 2026',
    region: 'NA',
    a: { name: 'Player A', playerId: 'player-a', before: 2092, after: 2104 },
    b: { name: 'Player B', playerId: 'player-b', before: 2089, after: 2077 },
    games: [
      { n: 1, a: { char: 'Vaan', helper: 'Ifrit' }, b: { char: 'Kain', helper: 'Odin' }, stage: "Kefka's Tower", winner: 'A' },
      { n: 2, a: { char: 'Vaan', helper: 'Ifrit' }, b: { char: 'Ramza', helper: 'Odin' }, stage: 'Pandaemonium', winner: 'B' },
      { n: 3, a: { char: 'Vaan', helper: 'Ifrit' }, b: { char: 'Kain', helper: 'Odin' }, stage: "Orphan's Cradle", winner: 'A' },
    ],
  },
]

export const matchById = (id: string) => MATCHES.find((m) => m.id === id)

export const CHARACTERS: Record<GameId, string[]> = {
  '012': ['Gabranth', 'Cecil', 'Laguna', 'Kuja', 'Kain', 'Tifa', 'Squall', 'Yuna', 'Vaan', 'Lightning', 'Jecht', 'Exdeath'],
  nt: ['Kain', 'Vaan', "Y'shtola", 'Warrior of Light', 'Sephiroth', 'Ardyn', 'Kefka', 'Ramza', 'Squall', 'Noctis', 'Cloud', 'Terra'],
}

export const HELPERS: Record<GameId, string[]> = {
  '012': ['Aerith', 'Kain', 'Tifa', 'Yuna', 'Shantotto'],
  nt: ['Bahamut', 'Odin', 'Ifrit', 'Shiva', 'Ramuh', 'Alexander'],
}

export const STAGES: Record<GameId, string[]> = {
  '012': ["Kefka's Tower", "Order's Sanctuary", 'Edge of Madness', 'Pandaemonium'],
  nt: ["Kefka's Tower", 'Pandaemonium', "Orphan's Cradle", 'Midgar'],
}

export const TIERS: Record<GameId, Record<'S' | 'A' | 'B' | 'C', string[]>> = {
  nt: {
    S: ['Vaan', 'Kain', "Y'shtola"],
    A: ['Warrior of Light', 'Ramza', 'Sephiroth', 'Ardyn', 'Noctis'],
    B: ['Kefka', 'Squall', 'Cloud', 'Terra'],
    C: [],
  },
  '012': {
    S: ['Gabranth', 'Cecil'],
    A: ['Laguna', 'Kain', 'Lightning', 'Jecht', 'Exdeath'],
    B: ['Tifa', 'Squall', 'Vaan', 'Yuna'],
    C: ['Kuja'],
  },
}

export interface MetaRow {
  char: string
  pick: number
  win: number
  topHelper: string
}

export const META: Record<GameId, MetaRow[]> = {
  '012': [
    { char: 'Gabranth', pick: 14, win: 56, topHelper: 'Aerith' },
    { char: 'Cecil', pick: 11, win: 51, topHelper: 'Kain' },
    { char: 'Laguna', pick: 9, win: 50, topHelper: 'Tifa' },
    { char: 'Kain', pick: 8, win: 52, topHelper: 'Yuna' },
    { char: 'Kuja', pick: 7, win: 45, topHelper: 'Yuna' },
    { char: 'Lightning', pick: 6, win: 49, topHelper: 'Aerith' },
  ],
  nt: [
    { char: 'Vaan', pick: 12, win: 54, topHelper: 'Ifrit' },
    { char: 'Kain', pick: 9, win: 52, topHelper: 'Odin' },
    { char: "Y'shtola", pick: 9, win: 53, topHelper: 'Bahamut' },
    { char: 'Warrior of Light', pick: 8, win: 50, topHelper: 'Bahamut' },
    { char: 'Ramza', pick: 6, win: 49, topHelper: 'Odin' },
    { char: 'Kefka', pick: 5, win: 46, topHelper: 'Shiva' },
  ],
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export interface Tournament {
  id: string
  name: string
  game: GameId
  mode: '1v1' | '3v3'
  when: string
  format: string
  registered: number
  cap?: number
  status: 'check-in' | 'registration' | 'done'
  checkInClosesMin?: number
}

export const TOURNAMENTS: Tournament[] = [
  { id: 'crystal-weekly-42', name: 'Crystal Weekly #42', game: 'nt', mode: '1v1', when: 'Tonight 20:00 EST', format: 'double elim · Bo3 / Bo5 finals', registered: 28, cap: 64, status: 'check-in', checkInClosesMin: 14 },
  { id: 'duodecim-monthly-nov', name: 'Duodecim Monthly', game: '012', mode: '1v1', when: 'Sat 23 Nov', format: 'single elim', registered: 41, status: 'registration' },
  { id: 'cosmos-chaos-cup', name: 'Cosmos vs Chaos Cup', game: 'nt', mode: '3v3', when: 'Dec 7', format: 'teams of 3', registered: 12, status: 'registration' },
  { id: 'crystal-weekly-41', name: 'Crystal Weekly #41', game: 'nt', mode: '1v1', when: 'Nov 9', format: 'double elim', registered: 32, status: 'done' },
]

export interface BracketSet {
  a: string
  b: string
  sa?: number
  sb?: number
  next?: boolean
}

export const BRACKET: { round: string; sets: BracketSet[] }[] = [
  {
    round: 'Round 1',
    sets: [
      { a: 'You', b: 'Player H', sa: 2, sb: 0 },
      { a: 'Player I', b: 'Player J', sa: 2, sb: 1 },
      { a: 'Player K', b: 'Player L', sa: 2, sb: 0 },
      { a: 'Player M', b: 'Player N', sa: 0, sb: 2 },
    ],
  },
  {
    round: 'Round 2',
    sets: [
      { a: 'You', b: 'Player I', next: true },
      { a: 'Player K', b: 'Player N' },
    ],
  },
  { round: 'Winners final', sets: [{ a: 'TBD', b: 'TBD' }] },
]

export type FriendStatus = 'idle' | 'queue' | 'match' | 'offline'
export interface Friend {
  playerId: string
  status: FriendStatus
  game?: GameId
}

export const FRIENDS: Friend[] = [
  { playerId: 'player-b', status: 'idle', game: 'nt' },
  { playerId: 'player-c', status: 'queue', game: '012' },
  { playerId: 'player-d', status: 'match', game: 'nt' },
  { playerId: 'player-o', status: 'idle', game: 'nt' },
  { playerId: 'player-p', status: 'offline' },
]

export const DISCORD_SUGGESTIONS = ['player-e', 'player-i']
