import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { DISCORD_SUGGESTIONS, FRIENDS, GAMES, playerById, type FriendStatus, type GameId } from '../data/mock'
import { useApp } from '../state/AppState'
import { usePickGame } from '../usePickGame'
import { GameCrest } from './rift/crests'
import { Avatar, Btn, Card, DiscordButton, Gem, Modal, Pill, Sub } from './ui'
import { cx, fmtTime } from '../lib/format'

/** The current-game toggle. `crests` (Rift) shows each game's emblem in a diamond crest. */
export function GameSwitcher({ className, crests }: { className?: string; crests?: boolean }) {
  const { game } = useApp()
  const pick = usePickGame()
  return (
    <div className={cx('flex gap-1.5', className)}>
      {(['012', 'nt'] as GameId[]).map((g) => (
        <Pill key={g} active={game === g} onClick={() => pick(g)} className={crests ? 'da-pill--crest' : undefined}>
          {crests && <GameCrest game={g} size={26} />}
          {GAMES[g].short}
        </Pill>
      ))}
    </div>
  )
}

const statusText: Record<FriendStatus, string> = {
  idle: 'idle',
  queue: 'in queue',
  match: 'in match · spectate',
  offline: 'offline',
}
const statusRing = { idle: 'crystal', queue: 'you', match: 'violet', offline: 'default' } as const

export function FriendsList({ compact }: { compact?: boolean }) {
  const { inviteToParty, party } = useApp()
  const navigate = useNavigate()
  const [added, setAdded] = useState<string[]>([])
  const online = FRIENDS.filter((f) => f.status !== 'offline')
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center">
        <b>Friends</b>
        <span className="flex-1" />
        <Pill>+ Add</Pill>
      </div>
      <Sub>Online · {online.length}</Sub>
      {online.map((f) => {
        const pl = playerById(f.playerId)!
        const inParty = party.some((m) => m.playerId === f.playerId)
        return (
          <div key={f.playerId} className="flex items-center gap-2">
            <Avatar name={pl.name} ring={statusRing[f.status]} />
            <Link to={`/players/${pl.id}`} className="flex min-w-0 flex-col leading-tight hover:text-crystal-soft">
              <span className="truncate text-sm">{pl.name}</span>
              <Sub>
                {statusText[f.status]}
                {f.game && ` · ${GAMES[f.game].short}`}
              </Sub>
            </Link>
            <span className="flex-1" />
            {f.status === 'idle' && !compact && (
              <Pill
                active={inParty}
                onClick={() => {
                  inviteToParty(f.playerId)
                  navigate('/party')
                }}
              >
                {inParty ? 'In party' : 'Invite'}
              </Pill>
            )}
          </div>
        )
      })}
      <Sub className="mt-2">From your Discord server · {DISCORD_SUGGESTIONS.length}</Sub>
      {DISCORD_SUGGESTIONS.map((id) => {
        const pl = playerById(id)!
        return (
          <div key={id} className="flex items-center gap-2">
            <Avatar name={pl.name} />
            <span className="text-sm text-muted">{pl.name}</span>
            <span className="flex-1" />
            <Pill active={added.includes(id)} onClick={() => setAdded((a) => [...a, id])}>
              {added.includes(id) ? 'Sent' : 'Add'}
            </Pill>
          </div>
        )
      })}
    </div>
  )
}

export function FriendsSidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-5rem)] w-56 flex-none overflow-y-auto border-l-[1.5px] border-line pl-4 xl:block">
      <FriendsList />
    </aside>
  )
}

/** 1l — persistent queue bar while searching, on any page. */
export function QueueBar() {
  const { phase, elapsed, queue, cancelQueue, region, searching } = useApp()
  if (phase !== 'searching') return null
  const info = GAMES[queue.game]
  return (
    <div className="fixed inset-x-0 bottom-[max(3.5rem,calc(var(--rift-phone-bar)+1rem))] z-40 px-3 md:bottom-4">
      <Card tone="gold" className="mx-auto max-w-md shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
          <b className="text-sm">
            Searching · {info.short} {queue.mode} Bo{queue.bestOf}
          </b>
          <span className="flex-1" />
          <span className="font-heading text-sm tabular-nums">{fmtTime(elapsed)}</span>
        </div>
        <div className="flex items-center">
          <Sub>
            {searching[queue.game]} in queue · {region}
          </Sub>
          <span className="flex-1" />
          <Pill onClick={cancelQueue}>Cancel</Pill>
        </div>
      </Card>
    </div>
  )
}

/** Match-found takeover with accept countdown. */
export function MatchFound() {
  const { pending, acceptLeft, acceptMatch, declineMatch } = useApp()
  if (!pending) return null
  const waiting = pending.you.accepted
  return (
    <Modal className="max-w-md border-chaos">
      <div className="flex flex-col items-center gap-4 text-center">
        <Sub>
          Match found · {GAMES[pending.game].short} {pending.mode} Bo{pending.bestOf} · {pending.platform}
        </Sub>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <Avatar name={pending.you.displayName} src={pending.you.avatarUrl} size={52} ring="crystal" />
            <span className="text-crystal-soft">you{pending.you.accepted && ' ✓'}</span>
          </div>
          <Gem size={16} />
          <div className="flex flex-col items-center gap-1">
            <Avatar name={pending.opponent.displayName} src={pending.opponent.avatarUrl} size={52} ring="chaos" />
            <span className="text-chaos-soft">
              {pending.opponent.displayName}
              {pending.opponent.accepted && ' ✓'}
            </span>
          </div>
        </div>
        {waiting ? (
          <Sub>Waiting for {pending.opponent.displayName} · 0:{String(acceptLeft).padStart(2, '0')}</Sub>
        ) : (
          <>
            <Btn size="lg" className="w-full" onClick={acceptMatch}>
              Accept · 0:{String(acceptLeft).padStart(2, '0')}
            </Btn>
            <Pill onClick={declineMatch}>Decline</Pill>
          </>
        )}
      </div>
    </Modal>
  )
}

/** 1a — sign-in gate. Browsing is open; actions prompt Discord sign-in. */
export function SignInModal() {
  const { signInPrompt, closeSignIn, signIn } = useApp()
  if (!signInPrompt) return null
  return (
    <Modal onClose={closeSignIn}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-lg font-semibold">{signInPrompt}</span>
        <Sub>Browsing ladders and matches is open to everyone</Sub>
        <DiscordButton className="w-full" onClick={signIn} />
        <Sub>We read your username + avatar only</Sub>
      </div>
    </Modal>
  )
}

/** 2i — party invite toast. */
export function InviteToast() {
  const { invite, dismissInvite, acceptInvite } = useApp()
  if (!invite) return null
  const from = playerById(invite.fromId)!
  return (
    <div className="fixed right-4 top-16 z-40 w-72">
      <Card tone="gold" className="shadow-2xl">
        <div className="flex items-center gap-2">
          <Avatar name={from.name} />
          <b className="text-sm">{from.name} invited you</b>
        </div>
        <Sub>NT 3v3 party · 1 slot left</Sub>
        <div className="flex gap-2">
          <Btn className="flex-1" onClick={acceptInvite}>
            Join
          </Btn>
          <Pill onClick={dismissInvite}>Not now</Pill>
        </div>
      </Card>
    </div>
  )
}

/** 1q — chat dock while in a match but browsing elsewhere. */
export function ChatDock() {
  const { live, sendChat } = useApp()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(true)
  const [text, setText] = useState('')
  if (!live || live.status !== 'active' || pathname === '/match/live') return null
  const opp = live.opponent.displayName
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(4rem,calc(var(--rift-phone-bar)+1rem))] right-4 z-40 rounded-full border-[1.5px] border-muted bg-card px-3 py-1.5 text-sm shadow-lg md:bottom-4"
      >
        💬 {opp}
      </button>
    )
  const last = live.messages.slice(-3)
  return (
    <Card className="fixed bottom-[max(4rem,calc(var(--rift-phone-bar)+1rem))] right-4 z-40 w-64 border-muted shadow-2xl md:bottom-4">
      <div className="flex items-center gap-2">
        <Link to="/match/live" className="font-semibold hover:text-crystal-soft">
          {opp}
        </Link>
        <Sub>game {live.games.length + 1}</Sub>
        <span className="flex-1" />
        <button type="button" className="text-muted hover:text-fg" onClick={() => setOpen(false)} aria-label="Minimise">
          —
        </button>
      </div>
      {last.map((m) => (
        <div key={m.id} className="text-xs">
          <span className="text-muted">{m.from === 'you' ? 'you' : m.from === 'opponent' ? opp : '—'}:</span>{' '}
          {m.text}
        </div>
      ))}
      <div className="flex gap-1.5">
        {['gg', 'rematch?', 'lag'].map((q) => (
          <Pill key={q} onClick={() => sendChat(q)}>
            {q}
          </Pill>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          sendChat(text)
          setText('')
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="type…"
          className="w-full rounded-md border-[1.5px] border-line-strong bg-panel px-2 py-1 text-xs focus:border-crystal focus:outline-none"
        />
      </form>
    </Card>
  )
}

/** Your reported result was disputed: ask for your side until you've given it (hidden in that match's room). */
export function DisputeNotice() {
  const { disputes, live, viewed } = useApp()
  const { pathname } = useLocation()
  const waiting = disputes.filter(
    (d) => d.youReported && !d.statementAdded && !(pathname === '/match/live' && (live?.id === d.id || viewed?.id === d.id)),
  )
  if (!waiting.length) return null
  return (
    <div className="mx-auto mt-3 flex w-full max-w-7xl flex-col gap-2 px-4">
      {waiting.map((d) => (
        <Card key={d.id} tone="gold" role="status" className="flex-row flex-wrap items-center">
          <span className="text-sm">
            {d.opponent} disputed your result ({GAMES[d.game].short}). An Admin will look at both sides.
          </span>
          <span className="flex-1" />
          <Link to={`/match/live?match=${d.id}`} className="da-btn px-3 py-1 text-xs">
            Add your side
          </Link>
        </Card>
      ))}
    </div>
  )
}

/** Shown when Discord sign-in bounced back with ?auth_error=… */
export function AuthErrorBanner() {
  const [params, setParams] = useSearchParams()
  const err = params.get('auth_error')
  if (!err) return null
  const dismiss = () => {
    params.delete('auth_error')
    setParams(params, { replace: true })
  }
  return (
    <div className="mx-auto mt-3 max-w-7xl px-4">
      <Card tone="chaos" className="flex-row items-center">
        <span className="text-sm">
          {err === 'denied' ? 'Discord sign-in was cancelled.' : "Couldn't reach Discord to sign you in. Try again in a moment."}
        </span>
        <span className="flex-1" />
        <Pill onClick={dismiss}>Dismiss</Pill>
      </Card>
    </div>
  )
}

/** Floating pieces both layouts render: queue bar, chat dock, match-found and sign-in modals, invites. */
export function Overlays({ rift = false }: { rift?: boolean }) {
  return (
    <>
      {!rift && (
        <>
          <QueueBar />
          <ChatDock />
          <MatchFound />
        </>
      )}
      <SignInModal />
      <InviteToast />
    </>
  )
}
