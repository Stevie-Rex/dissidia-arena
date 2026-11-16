import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAMES, playerById, type GameId, type Region } from '../data/mock'

export interface QueueSettings {
  game: GameId
  mode: '1v1' | '3v3'
  bestOf: number
  platform: string
}

export type QueuePhase = 'idle' | 'searching' | 'found' | 'match'

export interface ChatMessage {
  from: 'me' | 'them' | 'system'
  text: string
}

export interface LiveMatch {
  opponentId: string
  settings: QueueSettings
  region: Region
  gameNo: number
  reports: ('me' | 'them')[]
  confirmed: boolean
  ratingBefore: number
  ratingAfter?: number
  chat: ChatMessage[]
}

export interface PartyMember {
  playerId: string
  ready: boolean
}

interface AppState {
  signedIn: boolean
  onboarded: boolean
  signIn: () => void
  signOut: () => void
  finishOnboarding: (opts: { games: GameId[]; region: Region; ids: Partial<Record<GameId, string>> }) => void
  myGames: GameId[]
  region: Region
  setRegion: (r: Region) => void
  ids: Partial<Record<GameId, string>>

  game: GameId
  setGame: (g: GameId) => void

  signInPrompt: string | null
  requireSignIn: (reason: string) => boolean
  closeSignIn: () => void

  queue: QueueSettings
  setQueue: (q: Partial<QueueSettings>) => void
  phase: QueuePhase
  elapsed: number
  acceptLeft: number
  opponentId: string | null
  startQueue: () => void
  cancelQueue: () => void
  acceptMatch: () => void
  declineMatch: () => void

  live: LiveMatch | null
  sendChat: (text: string) => void
  reportGame: (winner: 'me' | 'them') => void
  confirmResult: () => void
  leaveMatch: () => void

  party: PartyMember[]
  inviteToParty: (playerId: string) => void
  removeFromParty: (playerId: string) => void
  toggleReady: () => void

  invite: { fromId: string } | null
  dismissInvite: () => void
  acceptInvite: () => void
}

const Ctx = createContext<AppState | null>(null)

function useStored<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(v))
  }, [key, v])
  return [v, setV] as const
}

const SEARCH_SECONDS = 6
const ACCEPT_SECONDS = 15

export function AppStateProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [signedIn, setSignedIn] = useStored('dc.signedIn', false)
  const [onboarded, setOnboarded] = useStored('dc.onboarded', false)
  const [myGames, setMyGames] = useStored<GameId[]>('dc.games', ['012', 'nt'])
  const [region, setRegion] = useStored<Region>('dc.region', 'NA')
  const [ids, setIds] = useStored<Partial<Record<GameId, string>>>('dc.ids', {})
  const [game, setGameRaw] = useStored<GameId>('dc.game', 'nt')

  const [signInPrompt, setSignInPrompt] = useState<string | null>(null)

  const [queue, setQueueRaw] = useState<QueueSettings>({ game: 'nt', mode: '1v1', bestOf: 3, platform: 'PS4' })
  const [phase, setPhase] = useState<QueuePhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [acceptLeft, setAcceptLeft] = useState(ACCEPT_SECONDS)
  const [opponentId, setOpponentId] = useState<string | null>(null)
  const [live, setLive] = useState<LiveMatch | null>(null)

  const [party, setParty] = useState<PartyMember[]>([{ playerId: 'me', ready: false }])
  const [invite, setInvite] = useState<{ fromId: string } | null>(null)
  const inviteShown = useRef(false)

  const setGame = useCallback(
    (g: GameId) => {
      setGameRaw(g)
      setQueueRaw((q) => {
        const info = GAMES[g]
        return {
          game: g,
          mode: info.modes.includes(q.mode) ? q.mode : '1v1',
          bestOf: info.bestOf.includes(q.bestOf) ? q.bestOf : info.bestOf[info.bestOf.length - 1],
          platform: info.platforms.includes(q.platform) ? q.platform : info.platforms[0],
        }
      })
    },
    [setGameRaw],
  )

  // Keep queue settings in sync with the stored game on first load.
  useEffect(() => {
    setGame(game)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setQueue = useCallback(
    (q: Partial<QueueSettings>) => {
      if (q.game) setGame(q.game)
      setQueueRaw((prev) => ({ ...prev, ...q }))
    },
    [setGame],
  )

  const requireSignIn = useCallback(
    (reason: string) => {
      if (signedIn) return true
      setSignInPrompt(reason)
      return false
    },
    [signedIn],
  )

  const signIn = useCallback(() => {
    // Mock of the Discord OAuth round-trip.
    setSignedIn(true)
    setSignInPrompt(null)
    if (!onboarded) navigate('/welcome')
  }, [navigate, onboarded, setSignedIn])

  const signOut = useCallback(() => {
    setSignedIn(false)
    setPhase('idle')
    setLive(null)
  }, [setSignedIn])

  const finishOnboarding: AppState['finishOnboarding'] = useCallback(
    ({ games, region: r, ids: newIds }) => {
      setMyGames(games)
      setRegion(r)
      setIds(newIds)
      setOnboarded(true)
      if (games.length === 1) setGame(games[0])
    },
    [setGame, setIds, setMyGames, setOnboarded, setRegion],
  )

  // Queue timers
  useEffect(() => {
    if (phase !== 'searching') return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'searching' && elapsed >= SEARCH_SECONDS) {
      setOpponentId(queue.game === 'nt' ? 'player-g' : 'player-h')
      setAcceptLeft(ACCEPT_SECONDS)
      setPhase('found')
    }
  }, [elapsed, phase, queue.game])

  useEffect(() => {
    if (phase !== 'found') return
    if (acceptLeft <= 0) {
      setPhase('idle')
      setOpponentId(null)
      return
    }
    const t = setTimeout(() => setAcceptLeft((a) => a - 1), 1000)
    return () => clearTimeout(t)
  }, [acceptLeft, phase])

  // A friend invites you to their party once, shortly after sign-in.
  useEffect(() => {
    if (!signedIn || inviteShown.current) return
    const t = setTimeout(() => {
      inviteShown.current = true
      setInvite({ fromId: 'player-b' })
    }, 25000)
    return () => clearTimeout(t)
  }, [signedIn])

  const startQueue = useCallback(() => {
    if (!requireSignIn('Sign in to queue')) return
    setElapsed(0)
    setPhase('searching')
  }, [requireSignIn])

  const cancelQueue = useCallback(() => {
    setPhase('idle')
    setElapsed(0)
  }, [])

  const acceptMatch = useCallback(() => {
    if (!opponentId) return
    const me = playerById('me')!
    setLive({
      opponentId,
      settings: queue,
      region,
      gameNo: 1,
      reports: [],
      confirmed: false,
      ratingBefore: me.stats[queue.game].rating,
      chat: [
        { from: 'system', text: `match found ${new Date().toTimeString().slice(0, 5)}` },
        { from: 'them', text: `lobby up, pw ${Math.floor(1000 + Math.random() * 9000)}` },
      ],
    })
    setPhase('match')
    navigate('/match/live')
  }, [navigate, opponentId, queue, region])

  const declineMatch = useCallback(() => {
    setPhase('idle')
    setOpponentId(null)
  }, [])

  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return
    setLive((m) => (m ? { ...m, chat: [...m.chat, { from: 'me', text }] } : m))
    // Canned reply from the opponent so the room feels alive.
    setTimeout(() => {
      const replies = ['ok', 'gg', 'one sec', 'ready when you are', 'nice']
      setLive((m) => (m ? { ...m, chat: [...m.chat, { from: 'them', text: replies[Math.floor(Math.random() * replies.length)] }] } : m))
    }, 1500)
  }, [])

  const reportGame = useCallback((winner: 'me' | 'them') => {
    setLive((m) => {
      if (!m) return m
      const reports = [...m.reports, winner]
      const need = Math.ceil(m.settings.bestOf / 2)
      const done = reports.filter((r) => r === 'me').length >= need || reports.filter((r) => r === 'them').length >= need
      return {
        ...m,
        reports,
        gameNo: done ? m.gameNo : m.gameNo + 1,
        chat: [...m.chat, { from: 'system', text: `G${reports.length} reported: ${winner === 'me' ? 'you' : 'them'}` }],
      }
    })
  }, [])

  const confirmResult = useCallback(() => {
    setLive((m) => {
      if (!m) return m
      const won = m.reports.filter((r) => r === 'me').length > m.reports.filter((r) => r === 'them').length
      return { ...m, confirmed: true, ratingAfter: m.ratingBefore + (won ? 12 : -12) }
    })
  }, [])

  const leaveMatch = useCallback(() => {
    setLive(null)
    setPhase('idle')
    setOpponentId(null)
  }, [])

  const inviteToParty = useCallback((playerId: string) => {
    setParty((p) => (p.length >= 3 || p.some((m) => m.playerId === playerId) ? p : [...p, { playerId, ready: false }]))
    // Invited friends accept after a beat.
    setTimeout(() => setParty((p) => p.map((m) => (m.playerId === playerId ? { ...m, ready: true } : m))), 3000)
  }, [])

  const removeFromParty = useCallback((playerId: string) => setParty((p) => p.filter((m) => m.playerId !== playerId)), [])
  const toggleReady = useCallback(
    () => setParty((p) => p.map((m) => (m.playerId === 'me' ? { ...m, ready: !m.ready } : m))),
    [],
  )

  const dismissInvite = useCallback(() => setInvite(null), [])
  const acceptInvite = useCallback(() => {
    if (!invite) return
    setParty([
      { playerId: invite.fromId, ready: true },
      { playerId: 'me', ready: false },
    ])
    setInvite(null)
    setQueue({ game: 'nt', mode: '3v3' })
    navigate('/party')
  }, [invite, navigate, setQueue])

  const value = useMemo<AppState>(
    () => ({
      signedIn,
      onboarded,
      signIn,
      signOut,
      finishOnboarding,
      myGames,
      region,
      setRegion,
      ids,
      game,
      setGame,
      signInPrompt,
      requireSignIn,
      closeSignIn: () => setSignInPrompt(null),
      queue,
      setQueue,
      phase,
      elapsed,
      acceptLeft,
      opponentId,
      startQueue,
      cancelQueue,
      acceptMatch,
      declineMatch,
      live,
      sendChat,
      reportGame,
      confirmResult,
      leaveMatch,
      party,
      inviteToParty,
      removeFromParty,
      toggleReady,
      invite,
      dismissInvite,
      acceptInvite,
    }),
    [
      signedIn, onboarded, signIn, signOut, finishOnboarding, myGames, region, setRegion, ids, game, setGame,
      signInPrompt, requireSignIn, queue, setQueue, phase, elapsed, acceptLeft, opponentId, startQueue,
      cancelQueue, acceptMatch, declineMatch, live, sendChat, reportGame, confirmResult, leaveMatch, party,
      inviteToParty, removeFromParty, toggleReady, invite, dismissInvite, acceptInvite,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppStateProvider')
  return v
}
