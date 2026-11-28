/*
 * Lab, round 3 (#70): the match-room pieces for Leave and Forfeit (#64), "My opponent's gone" (#72)
 * and the Rating change on the result (#71). Prototypes for sign-off.
 */
import { useEffect, useId, useRef } from 'react'
import { PLACEMENT_MATCHES, type Match, type RatingChange, type Side } from '../../lib/api'
import { cx } from '../../lib/format'
import { leftUntil, useNow } from '../../lib/matchEnding'
import { Btn, Card, Sub } from '../ui'

/** Leave's confirm dialog. In a Replay, Leave sends the match back to the Admins instead of a Forfeit. */
export function LeaveDialog({ open, replay, onLeave, onStay }: { open: boolean; replay: boolean; onLeave: () => void; onStay: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  const body = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="da-card leave-dialog"
      aria-labelledby={title}
      aria-describedby={body}
      onCancel={(e) => {
        e.preventDefault()
        onStay()
      }}
    >
      <h2 id={title} className="m-0">{replay ? 'Leave this Replay?' : 'Leave?'}</h2>
      <p id={body} className="m-0">
        {replay ? 'It goes back to the Admins, who rule on it.' : 'Your opponent wins the match.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Btn variant="chaos" size="lg" onClick={onLeave}>
          Leave
        </Btn>
        <Btn variant="ghost" size="lg" autoFocus onClick={onStay}>
          Stay
        </Btn>
      </div>
    </dialog>
  )
}

/**
 * "My opponent's gone", in the left column while the match is active: disabled with the time until it can be pressed,
 * then a button. Once pressed, the countdown shows at the top of the room instead (GoneCountdown).
 */
export function OpponentGone({ match, onGone }: { match: Match; onGone: () => void }) {
  const now = useNow()
  const hint = useId()
  const g = match.gone
  const opp = match.opponent.displayName
  if (!g || match.status !== 'active' || g.countdown) return null
  const wait = leftUntil(g.availableAt, now)
  return (
    <div className="flex flex-col items-start gap-1">
      <Btn variant="ghost" disabled={wait.seconds > 0} aria-describedby={hint} onClick={onGone}>
        My opponent's gone
      </Btn>
      <span id={hint} className="text-xs text-muted">
        {wait.seconds > 0
          ? g.waitingFor === 'here'
            ? `Available again in ${wait.text}, 5 minutes after the last "I'm here".`
            : `Available in ${wait.text}, once you've had 2 minutes to play.`
          : `Starts a 5-minute countdown. If ${opp} doesn't come back, you win by Forfeit.`}
      </span>
    </div>
  )
}

/**
 * The running countdown, at the top of the match room. The absent player gets an alert with "I'm here";
 * the player who stayed sees the time left.
 */
export function GoneCountdown({ match, onHere }: { match: Match; onHere: () => void }) {
  const now = useNow()
  const c = match.gone?.countdown
  if (match.status !== 'active' || !c) return null
  const left = leftUntil(c.endsAt, now)
  const opp = match.opponent.displayName
  if (c.absent === 'opponent')
    return (
      <Card tone="gold" role="region" aria-label="Opponent's gone" className="gone-alert">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0">Waiting for {opp}</h2>
          <span className="text-sm">
            {opp} has been told here and by Discord DM. If they don't press <q>I'm here</q> in time, you win by Forfeit.
          </span>
        </div>
        <span role="timer" aria-live="off" aria-label={`${left.text} left`} className="font-display text-4xl tabular-nums">
          {left.text}
        </span>
      </Card>
    )
  return (
    <Card tone="chaos" role="alert" className="gone-alert">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="m-0">{opp} says you're gone</h2>
        <span className="text-sm">
          Press <q>I'm here</q> within <b role="timer" aria-live="off" className="tabular-nums">{left.text}</b>, or you forfeit the match.
        </span>
      </div>
      <Btn main size="lg" onClick={onHere}>
        I'm here
      </Btn>
    </Card>
  )
}

/** Each player's Rating change, on the match result. */
export function RatingChanges({ match }: { match: Match }) {
  const r = match.ratingChanges
  if (!r) return null
  const row = (who: Side) => {
    const c: RatingChange = r[who]
    const up = c.change >= 0
    return (
      <li key={who} className="rating-change">
        <span className="min-w-0 truncate font-semibold">{who === 'you' ? 'You' : match.opponent.displayName}</span>
        <span className="tabular-nums text-muted">
          {c.before} → <b className="text-fg">{c.after}</b>
        </span>
        <b className={cx('tabular-nums', up ? 'text-crystal-soft' : 'text-chaos-soft')}>
          {up ? '+' : '−'}
          {Math.abs(c.change)}
        </b>
        <span className="text-xs text-muted">{c.placed ? '' : `Placement ${c.placements}/${PLACEMENT_MATCHES}`}</span>
      </li>
    )
  }
  return (
    <div role="region" aria-label="Rating change" className="flex flex-col gap-1">
      <Sub>Rating · {match.game === 'nt' ? `NT ${match.platform}` : '012'} Ladder</Sub>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">{(['you', 'opponent'] as const).map(row)}</ul>
    </div>
  )
}
