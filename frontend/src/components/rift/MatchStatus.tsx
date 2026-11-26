import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GAMES } from '../../data/mock'
import { OPEN_STATUSES } from '../../lib/api'
import { fmtTime } from '../../lib/format'
import { playMatchFound, unlockAudio } from '../../lib/sound'
import { useApp } from '../../state/AppState'
import { Btn, Card, Sub } from '../ui'
import { GameCrest } from './crests'
import './match-status.css'

export default function MatchStatus() {
  const { pathname, search } = useLocation()
  const { pending, live, searchEntry, phase, elapsed, acceptLeft, searching, cancelQueue } = useApp()
  const announced = useRef<number | null>(null)
  const pendingId = pending?.id

  useEffect(() => {
    const unlock = (event: Event) => {
      if (!event.isTrusted || navigator.userActivation?.isActive === false) return
      unlockAudio()
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('click', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (pendingId === undefined || announced.current === pendingId) return
    announced.current = pendingId
    playMatchFound()
  }, [pendingId])

  const match = pending ?? (live && OPEN_STATUSES.includes(live.status) ? live : null)
  const linkedId = new URLSearchParams(search).get('match')
  if (match && pathname === '/match/live' && (!linkedId || linkedId === String(match.id))) return null

  const entry = phase === 'searching' ? searchEntry : null
  const detail = match ?? entry
  if (!detail) return null

  const title = pending ? 'Match found' : match?.status === 'reported' ? 'Result reported' : match ? 'Match in progress' : 'Searching'
  return (
    <section aria-label="Match status" className="rift-status">
      <div key={pendingId ?? 'status'} className={pending ? 'rift-status__ready' : undefined}>
        {pending && (
          <span className="rift-status__shatter" aria-hidden>
            <i /><i /><i /><i /><i /><i />
          </span>
        )}
        <div className="rift-status__body">
          <GameCrest game={detail.game} size={38} />
          <div className="min-w-0">
            <div className="font-heading font-bold" role="status">{title}</div>
            <div className="text-sm text-muted">
              {GAMES[detail.game].short} · {detail.mode} Bo{detail.bestOf} · {detail.region}
            </div>
            {entry && <div className="text-sm text-muted">{searching[entry.game]} in queue</div>}
            {match && <div className="truncate text-sm text-muted">vs {match.opponent.displayName}</div>}
          </div>
          {(entry || pending) && (
            <span className="ml-auto self-start font-heading tabular-nums">{fmtTime(pending ? acceptLeft : elapsed)}</span>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          {match ? (
            <Link to="/match/live" className="da-btn da-btn--main min-h-11 px-4">Go to match</Link>
          ) : (
            <Btn variant="ghost" className="min-h-11" onClick={cancelQueue}>Cancel</Btn>
          )}
        </div>
      </div>
    </section>
  )
}

export function PendingMatchRoom() {
  const { pending, acceptLeft, acceptMatch, declineMatch } = useApp()
  if (!pending) return null

  return (
    <Card className="mx-auto w-full max-w-md">
      <GameCrest game={pending.game} size={48} />
      <h1 className="m-0 font-display text-2xl">Match found</h1>
      <Sub>{GAMES[pending.game].short} · {pending.mode} Bo{pending.bestOf} · {pending.platform}</Sub>
      <p className="m-0">vs {pending.opponent.displayName}</p>
      <p className="m-0 font-heading tabular-nums">Time left to accept · {fmtTime(acceptLeft)}</p>
      {pending.you.accepted ? (
        <p className="m-0" role="status">Waiting for {pending.opponent.displayName}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Btn main className="min-h-11" disabled={acceptLeft === 0} onClick={acceptMatch}>Accept</Btn>
          <Btn variant="ghost" className="min-h-11" onClick={declineMatch}>Decline</Btn>
        </div>
      )}
    </Card>
  )
}
