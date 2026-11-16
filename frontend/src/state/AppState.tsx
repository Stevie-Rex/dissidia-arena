import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAMES, type GameId, type Region } from '../data/mock'
import {
  api,
  errorCode,
  errorMessage,
  OPEN_STATUSES,
  type GameDetails,
  type Match,
  type Me,
  type QueueSettings,
  type QueueState,
  type Side,
} from '../lib/api'

export type { QueueSettings }

export type QueuePhase = 'idle' | 'searching' | 'found' | 'match'

export interface PartyMember {
  playerId: string
  ready: boolean
}

interface AppState {
  /** Signed-in Discord user, null when signed out, undefined while loading. */
  user: Me | null | undefined
  signedIn: boolean
  onboarded: boolean
  signIn: () => void
  signOut: () => Promise<void>
  finishOnboarding: (opts: { games: GameId[]; region: Region; ids: Partial<Record<GameId, string>> }) => Promise<void>
  myGames: GameId[]
  region: Region
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
  /** Players searching per game in your region. */
  searching: Record<GameId, number>
  queueError: { message: string; code?: string } | null
  /** Match waiting for both players to accept. */
  pending: Match | null
  startQueue: () => void
  cancelQueue: () => void
  acceptMatch: () => void
  declineMatch: () => void

  /** Match being played, or the one that just finished until closeMatch(). */
  live: Match | null
  matchError: string | null
  sendChat: (text: string) => void
  reportGame: (winner: Side, details: GameDetails) => void
  confirmResult: () => void
  disputeResult: () => void
  abandonMatch: () => void
  closeMatch: () => void

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

const POLL_ACTIVE_MS = 2000
const POLL_IDLE_MS = 10000

const normalizeQueue = (q: QueueSettings): QueueSettings => {
  const info = GAMES[q.game]
  return {
    game: q.game,
    mode: info.modes.includes(q.mode) ? q.mode : '1v1',
    bestOf: info.bestOf.includes(q.bestOf) ? q.bestOf : info.bestOf[info.bestOf.length - 1],
    platform: info.platforms.includes(q.platform) ? q.platform : info.platforms[0],
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<Me | null | undefined>(undefined)
  const signedIn = !!user
  const onboarded = !!user?.onboarded
  const myGames = useMemo<GameId[]>(() => user?.games ?? ['012', 'nt'], [user])
  const region: Region = user?.region ?? 'NA'
  const ids = useMemo(() => user?.gameIds ?? {}, [user])

  useEffect(() => {
    api.me().then(setUser, () => setUser(null))
  }, [])
  const [game, setGameRaw] = useStored<GameId>('dc.game', 'nt')

  const [signInPrompt, setSignInPrompt] = useState<string | null>(null)

  const [queue, setQueueRaw] = useState<QueueSettings>(() => normalizeQueue({ game, mode: '1v1', bestOf: 3, platform: 'PS4' }))
  // Mirrors `queue` synchronously so setQueue(...) then startQueue() in one handler uses the new settings.
  const queueRef = useRef(queue)
  const [server, setServer] = useState<QueueState | null>(null)
  const [live, setLive] = useState<Match | null>(null)
  const liveRef = useRef(live)
  useEffect(() => {
    liveRef.current = live
  }, [live])
  const [queueError, setQueueError] = useState<AppState['queueError']>(null)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [party, setParty] = useState<PartyMember[]>([{ playerId: 'me', ready: false }])
  const [invite, setInvite] = useState<{ fromId: string } | null>(null)
  const inviteShown = useRef(false)

  const setQueue = useCallback(
    (q: Partial<QueueSettings>) => {
      const next = normalizeQueue({ ...queueRef.current, ...q })
      queueRef.current = next
      setQueueRaw(next)
      if (q.game) setGameRaw(q.game)
    },
    [setGameRaw],
  )
  const setGame = useCallback((g: GameId) => setQueue({ game: g }), [setQueue])

  const requireSignIn = useCallback(
    (reason: string) => {
      if (signedIn) return true
      setSignInPrompt(reason)
      return false
    },
    [signedIn],
  )

  const signIn = useCallback(() => {
    // Full-page redirect: backend -> Discord consent -> backend callback -> back here.
    const { pathname, search } = window.location
    window.location.assign(api.discordLoginUrl(pathname + search))
  }, [])

  const signOut = useCallback(async () => {
    await api.logout()
    setUser(null)
    setServer(null)
    setLive(null)
    navigate('/')
  }, [navigate])

  const finishOnboarding: AppState['finishOnboarding'] = useCallback(
    async ({ games, region: r, ids: newIds }) => {
      setUser(await api.updateMe({ games, region: r, gameIds: newIds, onboarded: true }))
      if (games.length === 1) setGame(games[0])
    },
    [setGame],
  )

  // ---- server-driven queue / match state

  const applyState = useCallback((st: QueueState) => {
    setServer(st)
    if (st.match && st.match.status !== 'pending') {
      setLive(st.match)
    } else if (!st.match) {
      const prev = liveRef.current
      // Our match closed on the other player's action (confirm, dispute, leave): fetch the final state.
      if (prev && OPEN_STATUSES.includes(prev.status)) api.match(prev.id).then(setLive, () => setLive(null))
    }
  }, [])

  const refresh = useCallback(() => api.queueState().then(applyState, () => {}), [applyState])

  const phase: QueuePhase =
    live && OPEN_STATUSES.includes(live.status)
      ? 'match'
      : server?.match?.status === 'pending'
        ? 'found'
        : server?.queue
          ? 'searching'
          : 'idle'
  const pending = phase === 'found' ? server!.match : null

  useEffect(() => {
    if (!signedIn) return
    void refresh()
    const t = setInterval(refresh, phase === 'idle' ? POLL_IDLE_MS : POLL_ACTIVE_MS)
    return () => clearInterval(t)
  }, [signedIn, phase, refresh])

  // Clock for the search timer and accept countdown.
  useEffect(() => {
    if (phase !== 'searching' && phase !== 'found') return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0) // `now` may be stale from the last time the clock ran
    const t = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [phase])

  const joinedAt = server?.queue?.joinedAt
  const elapsed = joinedAt ? Math.max(0, Math.floor((now - Date.parse(joinedAt)) / 1000)) : 0
  const acceptLeft = pending ? Math.max(0, Math.ceil((Date.parse(pending.acceptDeadline) - now) / 1000)) : 0

  // Both accepted: open the match room.
  const prevPhase = useRef(phase)
  useEffect(() => {
    if (prevPhase.current === 'found' && phase === 'match') navigate('/match/live')
    prevPhase.current = phase
  }, [phase, navigate])

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
    setQueueError(null)
    api.joinQueue(queueRef.current).then(applyState, (e) => {
      setQueueError({ message: errorMessage(e), code: errorCode(e) })
      navigate('/queue')
    })
  }, [requireSignIn, applyState, navigate])

  const cancelQueue = useCallback(() => {
    api.leaveQueue().then(applyState, () => {})
  }, [applyState])

  const acceptMatch = useCallback(() => {
    if (!pending) return
    api.matchAction(pending.id, 'accept').then(refresh, refresh)
  }, [pending, refresh])

  const declineMatch = useCallback(() => {
    if (!pending) return
    api.matchAction(pending.id, 'decline').then(refresh, refresh)
  }, [pending, refresh])

  /** Runs an in-room action; on error (e.g. the opponent already reported) shows it and reloads the match. */
  const onLive = useCallback((call: (m: Match) => Promise<Match>) => {
    const m = liveRef.current
    if (!m) return
    setMatchError(null)
    call(m).then(setLive, (e) => {
      setMatchError(errorMessage(e))
      api.match(m.id).then(setLive, () => {})
    })
  }, [])

  const sendChat = useCallback(
    (text: string) => {
      if (text.trim()) onLive((m) => api.sendMessage(m.id, text))
    },
    [onLive],
  )
  const reportGame = useCallback(
    (winner: Side, details: GameDetails) =>
      onLive((m) => api.reportGame(m.id, m.games.length + 1, m[winner].id, details)),
    [onLive],
  )
  const confirmResult = useCallback(() => onLive((m) => api.matchAction(m.id, 'confirm')), [onLive])
  const disputeResult = useCallback(() => onLive((m) => api.matchAction(m.id, 'dispute')), [onLive])
  const abandonMatch = useCallback(() => onLive((m) => api.matchAction(m.id, 'leave')), [onLive])
  const closeMatch = useCallback(() => {
    setLive((m) => (m && OPEN_STATUSES.includes(m.status) ? m : null))
    setMatchError(null)
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
      user,
      signedIn,
      onboarded,
      signIn,
      signOut,
      finishOnboarding,
      myGames,
      region,
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
      searching: server?.searching ?? { '012': 0, nt: 0 },
      queueError,
      pending,
      startQueue,
      cancelQueue,
      acceptMatch,
      declineMatch,
      live,
      matchError,
      sendChat,
      reportGame,
      confirmResult,
      disputeResult,
      abandonMatch,
      closeMatch,
      party,
      inviteToParty,
      removeFromParty,
      toggleReady,
      invite,
      dismissInvite,
      acceptInvite,
    }),
    [
      user, signedIn, onboarded, signIn, signOut, finishOnboarding, myGames, region, ids, game, setGame,
      signInPrompt, requireSignIn, queue, setQueue, phase, elapsed, acceptLeft, server, queueError, pending,
      startQueue, cancelQueue, acceptMatch, declineMatch, live, matchError, sendChat, reportGame, confirmResult,
      disputeResult, abandonMatch, closeMatch, party,
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
