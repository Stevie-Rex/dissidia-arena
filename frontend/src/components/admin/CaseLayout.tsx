/*
 * The pieces both Admin case pages (a Disputed match and a Help request) are built from, in reading order: the
 * summary strip, sections of evidence and records, and the forms in a column or bottom panel beside them (#53,
 * approved in lab round 2).
 */
import { useId, useRef, type ReactNode, type Ref } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import { GAMES, type GameId } from '../../data/mock'
import type { CaseClaim, CaseListRow } from '../../lib/api'
import { cx, since } from '../../lib/format'
import { Btn, Card, Sub } from '../ui'
import './case-layout.css'

export function BackToCases() {
  return (
    <Link to="/admin" className="inline-flex min-h-9 items-center gap-1 self-start text-sm font-semibold text-gold-note hover:text-crystal-soft">
      <span aria-hidden="true">←</span> Back to cases
    </Link>
  )
}

export function CaseBadge({ kind }: { kind: CaseListRow['kind'] }) {
  return (
    <span
      className={cx(
        'inline-block rounded border px-1.5 text-xs font-semibold',
        kind === 'help' ? 'border-crystal-soft text-crystal-soft' : 'border-chaos-soft text-chaos-soft',
      )}
    >
      {kind === 'help' ? 'Help' : 'Dispute'}
    </span>
  )
}

// ---------------------------------------------------------------- the summary strip

/** Who played, which game, where the case stands and who holds it. Notes about the case go in as children. */
export function CaseSummary({
  label,
  kind,
  game,
  platform,
  title,
  players,
  status,
  claim,
  actions,
  headingRef,
  children,
}: {
  label: string
  kind: CaseListRow['kind']
  game: GameId
  platform: string
  /** Which case this is, above the players' names: "Case: Match #42". */
  title: string
  players: [string, string]
  status: ReactNode
  /** Left out once the case is resolved, with its actions. */
  claim?: ReactNode
  actions?: ReactNode
  headingRef: Ref<HTMLHeadingElement>
  children?: ReactNode
}) {
  return (
    <Card role="region" aria-label={label} className="gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-[1_1_14rem]">
          <p className="m-0 mb-1 flex flex-wrap items-center gap-2">
            <CaseBadge kind={kind} />
            <Sub>
              {GAMES[game].short} · {platform}
            </Sub>
          </p>
          <h2 ref={headingRef} tabIndex={-1} className="m-0 scroll-mt-24">
            <span className="block text-xs font-semibold text-muted">{title}</span>
            <span className="wrap-anywhere block text-xl font-semibold">
              {players[0]} vs {players[1]}
            </span>
          </h2>
        </div>
        <dl className="m-0 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Status</dt>
            <dd className="m-0 font-semibold">{status}</dd>
          </div>
          {claim && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Claim</dt>
              <dd className="m-0">{claim}</dd>
            </div>
          )}
        </dl>
        {actions}
      </div>
      {children}
    </Card>
  )
}

export function ClaimText({ claim, noun }: { claim: CaseClaim | null; noun: 'case' | 'request' }) {
  if (!claim) return 'Unclaimed.'
  if (claim.byYou) return `You hold the Claim on this ${noun}.`
  return (
    <>
      <b>Being handled</b> by {claim.by.displayName}, for {since(claim.at)}.
    </>
  )
}

/** Claim, Take over and Release, whichever this Admin may use now. */
export function ClaimButtons({
  claim,
  playedIn,
  isMaster,
  busy,
  onAct,
}: {
  claim: CaseClaim | null
  playedIn: boolean
  isMaster: boolean
  busy: boolean
  onAct: (action: 'claim' | 'release' | 'takeover') => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {!claim && (!playedIn || isMaster) && (
        <Btn disabled={busy} onClick={() => onAct('claim')}>
          Claim
        </Btn>
      )}
      {claim && !claim.byYou && isMaster && (
        <Btn disabled={busy} onClick={() => onAct('takeover')}>
          Take over
        </Btn>
      )}
      {claim && (claim.byYou || isMaster) && (
        <Btn variant="ghost" disabled={busy} onClick={() => onAct('release')}>
          Release
        </Btn>
      )}
    </div>
  )
}

export function PlayedInNote({ isMaster }: { isMaster: boolean }) {
  return (
    <p className="m-0 text-sm font-semibold text-gold-note">
      You played in this match.
      {!isMaster && <span className="font-normal text-fg-dim"> Another Admin has to handle it.</span>}
    </p>
  )
}

// ---------------------------------------------------------------- evidence and records

/** A panel of evidence or records, named by its heading. */
export function CaseSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const id = useId()
  return (
    <Card role="region" aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="m-0 text-base font-semibold">
        {title}
      </h2>
      {note && <Sub>{note}</Sub>}
      {children}
    </Card>
  )
}

/** The reported games, one row each. `disputed`, on a dispute, marks the games it is about. */
export function GamesTable({
  games,
  name,
  disputed,
}: {
  games: { n: number; winner: number; reportedBy: number }[]
  name: (userId: number) => string
  disputed?: number[]
}) {
  if (games.length === 0) return <span className="text-sm text-muted">No games reported.</span>
  const columns = ['Game', 'Reported winner', 'Reported by', ...(disputed ? ['Dispute'] : [])]
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead className="text-xs uppercase tracking-wide text-muted">
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className="border-b border-line py-1.5 pr-3 font-semibold last:pr-0">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {games.map((g) => {
          const doubted = disputed?.includes(g.n)
          return (
            <tr key={g.n} className={cx('border-b border-line align-top last:border-b-0', doubted && 'font-semibold text-gold-note')}>
              <th scope="row" className="py-1.5 pr-3 font-semibold">
                {g.n}
              </th>
              <td className="wrap-anywhere py-1.5 pr-3">{name(g.winner)}</td>
              <td className="wrap-anywhere py-1.5 pr-3 last:pr-0">{name(g.reportedBy)}</td>
              {disputed && <td className="py-1.5">{doubted ? 'Disputed' : '—'}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function MatchChat({
  messages,
  name,
}: {
  messages: { id: number; from: number | null; text: string; at: string }[]
  name: (userId: number) => string
}) {
  return (
    <CaseSection title="Match chat">
      {messages.length === 0 ? (
        <span className="text-sm text-muted">No messages.</span>
      ) : (
        // Focusable so a long chat can be scrolled from the keyboard.
        <ol tabIndex={0} aria-label="Messages" className="m-0 flex max-h-96 list-none flex-col gap-1 overflow-y-auto p-0">
          {messages.map((m) => (
            <li key={m.id} className={cx('flex gap-2 text-sm', m.from === null && 'italic text-muted')}>
              <time dateTime={m.at} title={new Date(m.at).toLocaleString()} className="flex-none tabular-nums text-muted">
                {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
              <span className="wrap-anywhere min-w-0">
                {m.from !== null && <b>{name(m.from)}: </b>}
                {m.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </CaseSection>
  )
}

// ---------------------------------------------------------------- the forms beside the evidence

/**
 * The case's forms: a column that stays in view on a wide screen. On a narrow one they are a bar pinned to the
 * bottom that opens a half-height panel, with the evidence scrolling above it. The forms stay mounted while the
 * panel is closed, so nothing typed or picked is lost. It must be the last child of a `.case-page`.
 */
export function CaseSide({
  title,
  ready,
  open,
  onOpenChange,
  children,
}: {
  title: string
  /** Whether any form in here can be used now. Without one, a narrow screen shows no bar. */
  ready: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const id = useId()
  const bar = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  // Focus follows the panel: into it when it opens, back to the bar when it's hidden.
  const show = () => {
    flushSync(() => onOpenChange(true))
    heading.current?.focus()
  }
  const hide = () => {
    flushSync(() => onOpenChange(false))
    bar.current?.focus()
  }
  return (
    <section aria-labelledby={`${id}-title`} className="case-side" data-ready={ready || undefined} data-open={(ready && open) || undefined}>
      {ready && (
        <Card className="case-side__bar">
          <Btn ref={bar} size="lg" aria-expanded={false} aria-controls={`${id}-panel`} onClick={show}>
            {title}
          </Btn>
        </Card>
      )}
      <Card id={`${id}-panel`} className="case-side__panel">
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="m-0 text-lg font-semibold">
            {title}
          </h2>
          <Btn variant="ghost" className="case-side__hide min-h-11" onClick={hide}>
            Hide panel
          </Btn>
        </div>
        {/* With nothing in it to focus, the body itself takes focus so it can still be scrolled from the keyboard. */}
        <div className="case-side__body" tabIndex={ready ? undefined : 0}>
          {children}
        </div>
      </Card>
    </section>
  )
}
