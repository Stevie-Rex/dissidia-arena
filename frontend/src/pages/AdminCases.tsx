import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import {
  BackToCases,
  CaseBadge,
  CaseSection,
  CaseSide,
  CaseSummary,
  ClaimButtons,
  ClaimText,
  GamesTable,
  MatchChat,
  PlayedInNote,
} from '../components/admin/CaseLayout'
import RoleGate from '../components/RoleGate'
import { ScreenshotList } from '../components/Screenshots'
import { Btn, Card, Select, Sub } from '../components/ui'
import { GAMES } from '../data/mock'
import {
  MAX_REASON,
  api,
  errorMessage,
  type Case,
  type CasePlayer,
  type CaseListRow,
  type DisputeRecord,
  type RulingExtra,
  type RulingOutcome,
} from '../lib/api'
import { FIELD, cx, since } from '../lib/format'
import { useDraft } from '../lib/useDraft'
import { useApp } from '../state/AppState'

/** How long a Replay has to settle before it comes back as a case (lifecycle.REPLAY_HOURS). */
const REPLAY_HOURS = 48

const OUTCOMES: { value: RulingOutcome; label: string; help: string }[] = [
  { value: 'uphold', label: 'Uphold', help: 'The reported result stands. The winner gets the ranked win and any unlocks.' },
  {
    value: 'overturn',
    label: 'Overturn',
    help: 'Correct the winner of any reported game. Whoever the corrected games make the winner gets the ranked win and any unlocks.',
  },
  {
    value: 'replay',
    label: 'Replay',
    help: `Games before the one you pick stand; that game and the ones after are played again in the same match room. If the match isn't settled within ${REPLAY_HOURS} hours, it comes back here.`,
  },
  { value: 'void', label: 'Void', help: 'No one wins and nothing counts against anyone.' },
]
const OUTCOME_NAMES: Record<RulingOutcome, string> = {
  uphold: 'Upheld',
  overturn: 'Overturned',
  replay: 'Replayed',
  void: 'Voided',
}

export function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="m-0 text-sm text-chaos-soft">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------- the case list

/** The Admin panel's Cases tab: open Disputed matches and Help requests, and whether each is claimed. */
export default function AdminCases() {
  return (
    <RoleGate allow={['admin', 'master']} who="Admins">
      <CaseList />
    </RoleGate>
  )
}

const FILTERS = ['All', 'Disputes', 'Help', 'Unclaimed', 'Mine'] as const
export type CaseFilter = (typeof FILTERS)[number]
/** The picked chip, held by the Admin panel so it outlasts the case list. */
export type CaseFilterState = { filter: CaseFilter; setFilter: (filter: CaseFilter) => void }

/** Whether a case shows under a filter chip. The chips filter in the browser; nothing is fetched again. */
function shows(c: CaseListRow, filter: CaseFilter) {
  if (filter === 'Disputes') return c.kind === 'dispute'
  if (filter === 'Help') return c.kind === 'help'
  if (filter === 'Unclaimed') return !c.claim
  if (filter === 'Mine') return !!c.claim?.byYou
  return true
}

function CaseList() {
  const [cases, setCases] = useState<CaseListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { filter, setFilter } = useOutletContext<CaseFilterState>()

  useEffect(() => {
    let current = true
    api.cases().then(
      (d) => current && setCases(d.cases),
      (e) => current && setError(errorMessage(e)),
    )
    return () => {
      current = false
    }
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!cases) return <Sub>Loading…</Sub>
  if (cases.length === 0)
    return (
      <Card>
        <p className="m-0 text-sm">No Disputed matches or Help requests are waiting for an Admin.</p>
      </Card>
    )
  const shown = cases.filter((c) => shows(c, filter))
  return (
    <section aria-label="Open cases" className="@container flex flex-col gap-3">
      <div role="group" aria-label="Filter cases" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="da-pill rounded-full px-3 py-1 text-xs">
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Sub>No cases match this filter.</Sub>
      ) : (
        // When the table doesn't fit, each row stacks as a card. The explicit roles keep the table
        // semantics that changing `display` would otherwise drop.
        <div className="overflow-x-auto rounded border border-line @max-xl:border-0">
          <table role="table" className="w-full border-collapse text-left text-sm @max-xl:block">
            <thead role="rowgroup" className="text-xs uppercase tracking-wide text-muted @max-xl:sr-only">
              <tr role="row">
                {['Type', 'Match', 'Players', 'Game', 'Age', 'Claim'].map((h) => (
                  <th key={h} scope="col" role="columnheader" className="border-b border-line px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup" className="@max-xl:grid @max-xl:gap-2">
              {shown.map((c) => {
                const at = c.kind === 'help' ? c.askedAt : c.disputedAt
                return (
                  <tr
                    key={c.kind === 'help' ? `help-${c.helpRequestId}` : `dispute-${c.matchId}`}
                    role="row"
                    className="border-b border-line align-top last:border-b-0 @max-xl:grid @max-xl:grid-cols-[auto_minmax(0,1fr)_auto] @max-xl:items-start @max-xl:gap-x-2 @max-xl:gap-y-1.5 @max-xl:rounded @max-xl:border @max-xl:bg-card @max-xl:px-3 @max-xl:py-2.5 @max-xl:last:border-b"
                  >
                    <td role="cell" className="px-3 py-2 @max-xl:p-0">
                      <CaseBadge kind={c.kind} />
                    </td>
                    <td role="cell" className="px-3 py-2 @max-xl:p-0">
                      <Link
                        to={c.kind === 'help' ? `/admin/help-requests/${c.helpRequestId}` : `/admin/cases/${c.matchId}`}
                        className="whitespace-nowrap font-semibold text-gold-note hover:text-crystal-soft"
                      >
                        Match #{c.matchId}
                      </Link>
                      {c.kind === 'help' && <span className="mt-1 line-clamp-2 min-w-48 whitespace-pre-wrap text-fg-dim @max-xl:min-w-0">{c.message}</span>}
                      {c.kind === 'dispute' && c.replayNotFinished && (
                        <span className="mt-1 block whitespace-nowrap font-semibold text-gold-note @max-xl:whitespace-normal">Replay not finished</span>
                      )}
                    </td>
                    <td role="cell" className="wrap-anywhere px-3 py-2 @max-xl:col-span-full @max-xl:row-start-2 @max-xl:p-0 @max-xl:font-semibold">
                      {c.players[0]} vs {c.players[1]}
                    </td>
                    <td role="cell" className="whitespace-nowrap px-3 py-2 @max-xl:p-0 @max-xl:text-right">{GAMES[c.game].short}</td>
                    <td role="cell" className="whitespace-nowrap px-3 py-2 text-muted @max-xl:p-0">{at ? `${since(at)} ago` : '—'}</td>
                    <td
                      role="cell"
                      className={cx(
                        'px-3 py-2 @max-xl:col-start-2 @max-xl:col-end-[-1] @max-xl:p-0 @max-xl:text-right',
                        !c.claim && 'text-muted',
                      )}
                    >
                      <span className="hidden text-muted @max-xl:inline">Claim · </span>
                      {c.claim ? <span className="wrap-anywhere">{c.claim.by.displayName}</span> : 'Unclaimed'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- the case page

export function CasePage() {
  return (
    <RoleGate allow={['admin', 'master']} who="Admins">
      <CaseLoader />
    </RoleGate>
  )
}

function CaseLoader() {
  const id = Number(useParams().id)
  const [data, setData] = useState<Case | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    api.case(id).then(
      (d) => current && (setData(d), setError(null)),
      (e) => current && setError(errorMessage(e)),
    )
    return () => {
      current = false
    }
  }, [id])

  return (
    <div className="flex flex-col gap-4">
      <BackToCases />
      {!data && <h2 className="m-0 text-xl font-semibold">Case: Match #{id}</h2>}
      {error && !data && <Alert>{error}</Alert>}
      {!data && !error && <Sub>Loading…</Sub>}
      {/* keyed so following a dispute record to another case starts its Ruling form afresh */}
      {data && <CaseView key={data.matchId} data={data} onChange={setData} />}
    </div>
  )
}

/** The case in the order an Admin decides it: summary, evidence, chat and records, with the Ruling beside them. */
function CaseView({ data, onChange }: { data: Case; onChange: (c: Case) => void }) {
  const { user } = useApp()
  const [error, setError] = useState<{ from: 'claim' | 'ruling'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const summaryHeading = useRef<HTMLHeadingElement>(null)
  const isMaster = user?.role === 'master'
  const name = (uid: number | null) => data.players.find((p) => p.id === uid)?.displayName ?? 'Unknown player'

  const run = useCallback(
    async (from: 'claim' | 'ruling', call: () => Promise<Case>) => {
      setBusy(true)
      setError(null)
      try {
        onChange(await call())
        return true
      } catch (e) {
        setError({ from, text: errorMessage(e) })
        return false
      } finally {
        setBusy(false)
      }
    },
    [onChange],
  )
  const act = (action: 'claim' | 'release' | 'takeover') => {
    setPanelOpen(false)
    run('claim', () => api.caseAction(data.matchId, action))
  }
  const rule = async (outcome: RulingOutcome, reason: string, extra?: RulingExtra) => {
    const saved = await run('ruling', () => api.rule(data.matchId, outcome, reason, extra))
    if (saved) {
      setPanelOpen(false)
      summaryHeading.current?.focus() // the result is in the summary, which may be scrolled away
    }
    return saved
  }

  const waiting = data.status === 'disputed' && !data.ruling // for a Ruling
  const showForm = waiting && (!data.playedIn || isMaster)

  return (
    <div className="case-page">
      <CaseSummary
        label="Case status"
        kind="dispute"
        game={data.game}
        platform={data.platform}
        title={`Case: Match #${data.matchId}`}
        players={[data.players[0].displayName, data.players[1].displayName]}
        headingRef={summaryHeading}
        status={data.ruling ? `Ruling: ${OUTCOME_NAMES[data.ruling.outcome]}` : waiting ? 'Disputed' : `This match is ${data.status}.`}
        claim={waiting && <ClaimText claim={data.claim} noun="case" />}
        actions={
          waiting && <ClaimButtons claim={data.claim} playedIn={data.playedIn} isMaster={isMaster} busy={busy} onAct={act} />
        }
      >
        {data.ruling && (
          <div className="flex flex-col gap-1">
            <span className="wrap-anywhere whitespace-pre-wrap text-sm">{data.ruling.reason}</span>
            <Sub>
              By {data.ruling.by?.displayName ?? 'an Admin'} ·{' '}
              <time dateTime={data.ruling.at}>{new Date(data.ruling.at).toLocaleString()}</time>
            </Sub>
          </div>
        )}
        {waiting && data.replayNotFinished && (
          <p className="m-0 text-sm font-semibold text-gold-note">
            Replay not finished: the players didn't settle the Replay within {REPLAY_HOURS} hours. Rule again.
          </p>
        )}
        {waiting && data.playedIn && <PlayedInNote isMaster={isMaster} />}
        {error?.from === 'claim' && <Alert>{error.text}</Alert>}
      </CaseSummary>

      <div className="case-evidence">
        <CaseSection title="Reported games">
          <b className="text-sm">
            {data.winner === null
              ? `${data.score[0]}–${data.score[1]} so far: nobody has won yet (first to ${data.winsNeeded})`
              : `${name(data.reportedBy)} reported ${data.score[0]}–${data.score[1]} (${name(data.winner)} wins, first to ${data.winsNeeded})`}
          </b>
          <GamesTable games={data.games} name={name} disputed={data.dispute.games} />
        </CaseSection>

        <CaseSection title="Statements">
          {data.dispute.reason === null ? (
            <span className="text-sm text-muted">No details (filed before the dispute form)</span>
          ) : (
            <>
              <b className="text-sm">Disputed games: {data.dispute.games.join(', ')}</b>
              <span className="wrap-anywhere whitespace-pre-wrap text-sm">
                {name(data.dispute.by)} wrote: <q>{data.dispute.reason}</q>
              </span>
            </>
          )}
          <div className="@container">
            <div className="grid gap-3 @lg:grid-cols-2">
              {data.players.map((p) => (
                <div key={p.id} className="flex min-w-0 flex-col gap-1 border-l-2 border-line-strong pl-3">
                  <h3 className="wrap-anywhere m-0 text-sm font-semibold">{p.displayName}'s side</h3>
                  <span className="wrap-anywhere whitespace-pre-wrap text-sm">
                    {data.dispute.statements[p.id]?.text ?? `${p.displayName} has not added their side.`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CaseSection>

        <CaseSection title="Screenshots">
          {data.players.map((p) => (
            <div key={p.id} className="flex flex-col gap-1">
              <h3 className="wrap-anywhere m-0 text-sm font-semibold">{p.displayName}</h3>
              <ScreenshotList
                shots={data.dispute.screenshots[p.id] ?? []}
                owner={p.displayName}
                currentRound={data.dispute.round}
              />
            </div>
          ))}
        </CaseSection>

        <MatchChat messages={data.messages} name={name} />

        <CaseSection title="Dispute records">
          {data.players.map((p) => (
            <Record key={p.id} player={p} record={data.records[p.id]} current={data.matchId} />
          ))}
        </CaseSection>

        {data.earlierDisputes.length > 0 && (
          <CaseSection title="Earlier disputes" note="Players can't see these.">
            {data.earlierDisputes.map((d, i) => (
              <div key={i} className="flex flex-col gap-1 border-t border-line pt-2">
                {d.reason === null ? (
                  <span className="text-sm text-muted">No details (filed before the dispute form)</span>
                ) : (
                  <>
                    <b className="text-sm">Disputed games: {d.games.join(', ')}</b>
                    <span className="wrap-anywhere whitespace-pre-wrap text-sm">
                      {name(d.by)} wrote: <q>{d.reason}</q>
                    </span>
                  </>
                )}
                {data.players.map((p) => (
                  <span key={p.id} className="wrap-anywhere whitespace-pre-wrap text-sm">
                    <b>{p.displayName}'s side: </b>
                    {d.statements[p.id]?.text ?? `${p.displayName} did not add their side.`}
                  </span>
                ))}
                {d.ruling && (
                  <span className="wrap-anywhere whitespace-pre-wrap text-sm">
                    Ruling: {OUTCOME_NAMES[d.ruling.outcome]} by {d.ruling.by?.displayName ?? 'an Admin'}: {d.ruling.reason}
                  </span>
                )}
              </div>
            ))}
          </CaseSection>
        )}
      </div>

      {(showForm || data.ruling) && (
        <CaseSide title="Write ruling" ready={showForm && data.canAct} open={panelOpen} onOpenChange={setPanelOpen}>
          {showForm ? (
            <RulingForm key={data.disputedAt} data={data} busy={busy} failure={error?.from === 'ruling' ? error.text : null} onRule={rule} />
          ) : (
            <p className="m-0 text-sm">Action recorded in the Admin log.</p>
          )}
        </CaseSide>
      )}
    </div>
  )
}

function Record({ player, record, current }: { player: CasePlayer; record: DisputeRecord; current: number }) {
  const ruled = (Object.entries(record.outcomes) as [RulingOutcome | 'pending', number][])
    .filter(([k]) => k !== 'pending')
    .map(([k, n]) => `${n} ${OUTCOME_NAMES[k as RulingOutcome].toLowerCase()}`)
  return (
    <div className="flex flex-col gap-1">
      <b className="text-sm">{player.displayName}</b>
      <span className="text-sm">
        {record.filed === 0
          ? 'Has never filed a dispute.'
          : `Filed ${record.filed} ${record.filed === 1 ? 'dispute' : 'disputes'}${ruled.length ? `: ${ruled.join(', ')}` : ''}${
              record.outcomes.pending ? `, ${record.outcomes.pending} waiting` : ''
            }.`}
      </span>
      {record.disputes.some((d) => d.matchId !== current) && (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {record.disputes
            .filter((d) => d.matchId !== current)
            .map((d) => (
              <li key={d.matchId} className="text-xs text-fg-dim">
                <Link to={`/admin/cases/${d.matchId}`} className="hover:text-crystal-soft">
                  Match #{d.matchId}
                </Link>{' '}
                · {GAMES[d.game].name} · {d.outcome ? OUTCOME_NAMES[d.outcome] : 'Waiting for a Ruling'}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

/** Each game's winner, with the disputed games pre-set to the other player: the usual Overturn. */
const proposedWinners = (data: Case) => {
  const [a, b] = data.players.map((p) => p.id)
  return Object.fromEntries(
    data.games.map((g) => [g.n, data.dispute.games.includes(g.n) ? (g.winner === a ? b : a) : g.winner]),
  ) as Record<number, number>
}

function RulingForm({
  data,
  busy,
  failure,
  onRule,
}: {
  data: Case
  busy: boolean
  /** Why the server refused the last Ruling sent. */
  failure: string | null
  /** Resolves to whether the Ruling was saved. */
  onRule: (outcome: RulingOutcome, reason: string, extra?: RulingExtra) => Promise<boolean>
}) {
  const [outcome, setOutcome] = useState<RulingOutcome | null>(null)
  const [fromGame, setFromGame] = useState(data.replayFrom.default)
  // A match Disputed again after a Replay is a new case, so its draft is keyed by when it was Disputed too.
  const reason = useDraft(`case:${data.matchId}:${data.disputedAt}`)
  const [winners, setWinners] = useState(() => proposedWinners(data))
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  const corrections = data.games.filter((g) => winners[g.n] !== g.winner).map((g) => ({ n: g.n, winner: winners[g.n] }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!outcome) return setError('Pick a Ruling.')
    if (outcome === 'overturn' && corrections.length === 0) return setError('Correct the winner of at least one game.')
    if (!reason.text.trim()) return setError('Give a reason. Both players will see it.')
    const saved = await onRule(
      outcome,
      reason.text.trim(),
      outcome === 'overturn' ? { games: corrections } : outcome === 'replay' ? { fromGame } : undefined,
    )
    if (saved) reason.clear()
  }

  return (
    <form onSubmit={submit} noValidate>
      {!data.canAct && (
        <p className="m-0 mb-3 text-sm font-semibold">
          {data.claim ? `Claimed by ${data.claim.by.displayName}.` : 'Claim this case to start.'}
        </p>
      )}
      <fieldset disabled={!data.canAct} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-sm font-semibold">Outcome</legend>
          {OUTCOMES.map((o) => (
            <label key={o.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name={`${id}-outcome`}
                value={o.value}
                checked={outcome === o.value}
                onChange={() => {
                  setOutcome(o.value)
                  setError(null)
                }}
                className="mt-1"
              />
              <span className="text-xs leading-5">
                <b className="text-sm">{o.label}</b>. {o.help}
              </span>
            </label>
          ))}
        </fieldset>
        {outcome === 'replay' && (
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden="true">Replay from</span>
            <Select
              label="Replay from"
              value={String(fromGame)}
              options={data.replayFrom.games.map((n) => ({
                value: String(n),
                label: `Game ${n}${data.dispute.games.includes(n) ? ' (disputed)' : ''}`,
              }))}
              onChange={(v) => setFromGame(Number(v))}
            />
          </div>
        )}
        {outcome === 'overturn' && (
          <Corrections
            data={data}
            winners={winners}
            onChange={(n, winner) => {
              setWinners((w) => ({ ...w, [n]: winner }))
              setError(null)
            }}
          />
        )}
        <label htmlFor={`${id}-reason`} className="text-sm font-semibold">
          Reason (both players see this, but not your name)
        </label>
        <textarea
          id={`${id}-reason`}
          value={reason.text}
          onChange={(e) => {
            reason.set(e.target.value)
            setError(null)
          }}
          rows={4}
          maxLength={MAX_REASON}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
          className={cx(FIELD, 'disabled:opacity-60')}
        />
        {error && (
          <span id={`${id}-error`} role="alert" className="text-xs text-chaos-soft">
            {error}
          </span>
        )}
        {failure && <Alert>{failure}</Alert>}
        <div>
          <Btn type="submit" disabled={busy}>
            Give Ruling
          </Btn>
        </div>
      </fieldset>
    </form>
  )
}

/** The Overturn's per-game controls, and the result they add up to. */
function Corrections({
  data,
  winners,
  onChange,
}: {
  data: Case
  winners: Record<number, number>
  onChange: (n: number, winner: number) => void
}) {
  const options = data.players.map((p) => ({ value: String(p.id), label: p.displayName }))
  const won = data.players.map((p) => data.games.filter((g) => winners[g.n] === p.id).length)
  const leader = won[0] >= data.winsNeeded ? 0 : won[1] >= data.winsNeeded ? 1 : null
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-semibold">Corrected games</legend>
      {data.games.map((g) => {
        const disputed = data.dispute.games.includes(g.n)
        const label = `Game ${g.n} winner${disputed ? ' (disputed)' : ''}`
        return (
          <div key={g.n} className={cx('flex flex-wrap items-center gap-2 text-sm', disputed && 'font-semibold text-gold-note')}>
            <span aria-hidden="true" className="w-36">
              {label}
            </span>
            <Select label={label} value={String(winners[g.n])} options={options} onChange={(v) => onChange(g.n, Number(v))} />
          </div>
        )
      })}
      <p className="m-0 text-sm" aria-live="polite">
        {leader === null
          ? `Nobody wins at ${won[0]}–${won[1]}, so this can't be an Overturn.`
          : `${data.players[leader].displayName} wins ${won[leader]}–${won[1 - leader]}${
              data.players[leader].id === data.winner ? ': the reported winner still wins, so this is an Uphold.' : '.'
            }`}
      </p>
    </fieldset>
  )
}
