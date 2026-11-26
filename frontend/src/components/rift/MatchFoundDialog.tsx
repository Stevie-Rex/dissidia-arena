import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { Match } from '../../lib/api'
import { fmtTime, queueSummary } from '../../lib/format'
import { Btn } from '../ui'
import { GameCrest } from './crests'
import './match-found.css'

/** Shards of the crystal: angle, distance, size and spin, fixed so every replay matches. Ported from lab round 1. */
const SHARDS = Array.from({ length: 14 }, (_, i) => ({
  a: i * (360 / 14) + (i % 2 ? 9 : -6),
  d: 180 + ((i * 47) % 130),
  s: 0.55 + ((i * 29) % 50) / 100,
  r: (i % 2 ? 1 : -1) * (90 + ((i * 61) % 180)),
}))

// The last match that shattered, kept for the tab, so a reload or a remount shows the dialog without replaying it.
const SHATTERED_KEY = 'da-shattered-match'

function hasShattered(id: number) {
  try {
    return sessionStorage.getItem(SHATTERED_KEY) === String(id)
  } catch {
    return false
  }
}

function markShattered(id: number) {
  try {
    sessionStorage.setItem(SHATTERED_KEY, String(id))
  } catch {
    /* storage blocked: it may play again after a reload */
  }
}

/**
 * The Match found dialog in Rift: a Crystal shatter the first time a match is found, then Accept or Decline.
 * Accept is focused and usable from the first frame; the effect layer never takes a pointer. Escape declines.
 * Under prefers-reduced-motion the effect layer is hidden and nothing moves, but the dialog shows the same way.
 */
export default function MatchFoundDialog({
  match,
  acceptLeft,
  onAccept,
  onDecline,
}: {
  match: Match
  acceptLeft: number
  onAccept: () => void
  onDecline: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const accepted = useRef(false)
  const [shatter] = useState(() => !hasShattered(match.id))
  const waiting = match.you.accepted

  useEffect(() => markShattered(match.id), [match.id])

  // Focus moves into the dialog on open. On close it goes back where it came from, or to the match room's heading
  // once the match starts.
  useEffect(() => {
    const dialog = ref.current
    const active = document.activeElement
    const opener = active instanceof HTMLElement && active !== document.body && !dialog?.contains(active) ? active : null
    return () => {
      // After Accept the app moves to the match room; wait (up to about half a second) for its heading to replace
      // the page's.
      const previous = document.querySelector('main h1')
      let frames = 0
      const restore = () => {
        // Still on the page: a dev-mode effect re-run, not a real close.
        if (dialog?.isConnected) return
        const heading = document.querySelector<HTMLElement>('main h1')
        if (accepted.current && (location.pathname !== '/match/live' || heading === previous) && frames++ < 30) {
          requestAnimationFrame(restore)
          return
        }
        const target = accepted.current || !opener?.isConnected ? heading : opener
        if (target === heading) heading?.setAttribute('tabindex', '-1')
        target?.focus()
      }
      requestAnimationFrame(restore)
    }
  }, [])

  // Accept first; after it, the dialog itself holds focus while it waits.
  useEffect(() => {
    const dialog = ref.current
    if (waiting) accepted.current = true
    if (waiting) dialog?.focus()
    else dialog?.querySelector<HTMLElement>('.da-btn--main')?.focus()
  }, [waiting])

  // Tab and Shift+Tab stay inside the dialog. Escape declines, the same as the Decline key.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (!waiting) onDecline()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const keys = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled])')]
    if (keys.length === 0) {
      e.preventDefault()
      return
    }
    const first = keys[0]
    const last = keys[keys.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="rift-found" data-shatter={shatter || undefined}>
      <div className="rift-found__fx" aria-hidden>
        {shatter && (
          <>
            <span className="rift-found__glow" />
            <span className="rift-found__crystal">
              <span className="rift-found__crack" />
            </span>
            <span className="rift-found__ring" />
            {SHARDS.map((s, i) => (
              <span
                key={i}
                className="rift-found__shard"
                style={{ '--a': `${s.a}deg`, '--d': `${s.d}px`, '--s': s.s, '--r': `${s.r}deg` } as CSSProperties}
              />
            ))}
          </>
        )}
      </div>
      <div
        ref={ref}
        className="rift-found__card"
        role="dialog"
        aria-modal="true"
        aria-label="Match found"
        aria-describedby="rift-found-meta"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <span className="rift-found__crest">
          <GameCrest game={match.game} size={72} />
        </span>
        <p className="rift-found__kicker">Match found</p>
        <p className="rift-found__title">
          <span className="rift-found__you">{match.you.displayName}</span>
          <span className="rift-found__vs">vs</span>
          <span className="rift-found__them">{match.opponent.displayName}</span>
        </p>
        <p id="rift-found-meta" className="rift-found__meta">
          {queueSummary(match, match.region)}
        </p>
        <p className="rift-found__time">Time left to accept · {fmtTime(acceptLeft)}</p>
        {waiting ? (
          <p className="rift-found__waiting" role="status">
            Waiting for {match.opponent.displayName}
          </p>
        ) : (
          <div className="rift-found__actions">
            <Btn
              main
              size="lg"
              disabled={acceptLeft === 0}
              onClick={() => {
                accepted.current = true
                onAccept()
              }}
            >
              Accept
            </Btn>
            <Btn variant="ghost" size="lg" onClick={onDecline}>
              Decline
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}
