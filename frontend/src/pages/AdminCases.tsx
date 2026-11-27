import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import AdminTabs from '../components/AdminTabs'
import RoleGate from '../components/RoleGate'
import { ScreenshotList } from '../components/Screenshots'
import { Btn, Card, PageTitle, Select, Sub } from '../components/ui'
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
import { useApp } from '../state/AppState'

/** How long a Replay has to settle before it comes back as a case (matchmaking.REPLAY_HOURS). */
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

/** The Admin area's front page: open Disputed matches and Help requests, and whether each is claimed. */
export default function AdminCases() {
  return (
    <RoleGate allow={['admin', 'master']} who="Admins">
      <div className="flex flex-col gap-6">
        <PageTitle>Cases</PageTitle>
        <AdminTabs />
        <CaseList />
      </div>
    </RoleGate>
  )
}

const FILTERS = ['All', 'Disputes', 'Help', 'Unclaimed', 'Mine'] as const
type Filter = (typeof FILTERS)[number]

/** Whether a case shows under a filter chip. The chips filter in the browser; nothing is fetched again. */
function shows(c: CaseListRow, filter: Filter) {
  if (filter === 'Disputes') return c.kind === 'dispute'
  if (filter === 'Help') return c.kind === 'help'
  if (filter === 'Unclaimed') return !c.claim
  if (filter === 'Mine') return !!c.claim?.byYou
  return true
}

function CaseList() {
  const [cases, setCases] = useState<CaseListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('All')

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
    <section aria-label="Open cases" className="flex flex-col gap-3">
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
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                {['Type', 'Match', 'Players', 'Game', 'Age', 'Claim'].map((h) => (
                  <th key={h} scope="col" className="border-b border-line px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const at = c.kind === 'help' ? c.askedAt : c.disputedAt
                return (
                  <tr key={c.kind === 'help' ? `help-${c.helpRequestId}` : `dispute-${c.matchId}`} className="border-b border-line align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <span
                        className={cx(
                          'inline-block rounded border px-1.5 text-xs font-semibold',
                          c.kind === 'help' ? 'border-crystal-soft text-crystal-soft' : 'border-chaos-soft text-chaos-soft',
                        )}
                      >
                        {c.kind === 'help' ? 'Help' : 'Dispute'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={c.kind === 'help' ? `/admin/help-requests/${c.helpRequestId}` : `/admin/cases/${c.matchId}`}
                        className="font-semibold text-gold-note hover:text-crystal-soft"
                      >
                        Match #{c.matchId}
                      </Link>
                      {c.kind === 'help' && <span className="mt-1 line-clamp-2 whitespace-pre-wrap text-fg-dim">{c.message}</span>}
                      {c.kind === 'dispute' && c.replayNotFinished && (
                        <span className="mt-1 block font-semibold text-gold-note">Replay not finished</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {c.players[0]} vs {c.players[1]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {GAMES[c.game].name} · {c.platform}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{at ? `${since(at)} ago` : '—'}</td>
                    <td className={cx('whitespace-nowrap px-3 py-2', c.claim ? 'text-fg-dim' : 'text-gold-note')}>
                      {c.claim ? `Claimed by ${c.claim.byYou ? 'you' : c.claim.by.displayName}` : 'Unclaimed'}
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
    <div className="flex flex-col gap-6">
      <PageTitle>Case: Match #{id}</PageTitle>
      <AdminTabs />
      {error && !data && <Alert>{error}</Alert>}
      {!data && !error && <Sub>Loading…</Sub>}
      {/* keyed so following a dispute record to another case starts its Ruling form afresh */}
      {data && <CaseView key={data.matchId} data={data} onChange={setData} />}
    </div>
  )
}

function CaseView({ data, onChange }: { data: Case; onChange: (c: Case) => void }) {
  const { user } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isMaster = user?.role === 'master'
  const name = (uid: number | null) => data.players.find((p) => p.id === uid)?.displayName ?? 'Unknown player'

  const run = useCallback(
    async (call: () => Promise<Case>) => {
      setBusy(true)
      setError(null)
      try {
        onChange(await call())
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    },
    [onChange],
  )

  const open = data.status === 'disputed'
  const claim = data.claim
  const heldByOther = claim !== null && !claim.byYou

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2" role="region" aria-label="Case status">
          <Sub>
            {GAMES[data.game].name} · {data.platform}
          </Sub>
          {data.ruling ? (
            <>
              <b>Ruling: {OUTCOME_NAMES[data.ruling.outcome]}</b>
              <span className="whitespace-pre-wrap text-sm">{data.ruling.reason}</span>
              <Sub>
                By {data.ruling.by?.displayName ?? 'an Admin'} ·{' '}
                <time dateTime={data.ruling.at}>{new Date(data.ruling.at).toLocaleString()}</time>
              </Sub>
            </>
          ) : !open ? (
            <b>This match is {data.status}.</b>
          ) : (
            <>
              {data.replayNotFinished && (
                <p className="m-0 text-sm font-semibold text-gold-note">
                  Replay not finished: the players didn't settle the Replay within {REPLAY_HOURS} hours. Rule again.
                </p>
              )}
              {data.playedIn && (
                <p className="m-0 text-sm font-semibold text-gold-note">
                  You played in this match.
                  {!isMaster && <span className="font-normal text-fg-dim"> Another Admin has to handle it.</span>}
                </p>
              )}
              {heldByOther ? (
                <p className="m-0 text-sm">
                  <b>Being handled</b> by {claim.by.displayName}, for {since(claim.at)}.
                </p>
              ) : claim?.byYou ? (
                <p className="m-0 text-sm">You hold the Claim on this case.</p>
              ) : (
                <p className="m-0 text-sm">Unclaimed.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {!claim && (!data.playedIn || isMaster) && (
                  <Btn disabled={busy} onClick={() => run(() => api.caseAction(data.matchId, 'claim'))}>
                    Claim
                  </Btn>
                )}
                {isMaster && heldByOther && (
                  <Btn disabled={busy} onClick={() => run(() => api.caseAction(data.matchId, 'takeover'))}>
                    Take over
                  </Btn>
                )}
                {claim && (claim.byYou || isMaster) && (
                  <Btn variant="ghost" disabled={busy} onClick={() => run(() => api.caseAction(data.matchId, 'release'))}>
                    Release
                  </Btn>
                )}
              </div>
            </>
          )}
          {error && <Alert>{error}</Alert>}
        </Card>

        {open && data.canAct && !data.ruling && (
          <RulingForm
            data={data}
            busy={busy}
            onRule={(outcome, reason, extra) => run(() => api.rule(data.matchId, outcome, reason, extra))}
          />
        )}

        <Card className="flex flex-col gap-2" role="region" aria-label="Reported games">
          <Sub>reported games</Sub>
          <b className="text-sm">
            {data.winner === null
              ? `${data.score[0]}–${data.score[1]} so far: nobody has won yet (first to ${data.winsNeeded})`
              : `${name(data.reportedBy)} reported ${data.score[0]}–${data.score[1]} (${name(data.winner)} wins, first to ${data.winsNeeded})`}
          </b>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {data.games.map((g) => {
              const doubted = data.dispute.games.includes(g.n)
              return (
                <li key={g.n} className={cx('text-sm', doubted && 'font-semibold text-gold-note')}>
                  Game {g.n}: {name(g.winner)} wins (reported by {name(g.reportedBy)}){doubted && ' · disputed'}
                </li>
              )
            })}
          </ol>
        </Card>

        <Card className="flex flex-col gap-2" role="region" aria-label="Dispute">
          <Sub>dispute</Sub>
          {data.dispute.reason === null ? (
            <span className="text-sm text-muted">No details (filed before the dispute form)</span>
          ) : (
            <>
              <b className="text-sm">Disputed games: {data.dispute.games.join(', ')}</b>
              <span className="whitespace-pre-wrap text-sm">
                {name(data.dispute.by)} wrote: <q>{data.dispute.reason}</q>
              </span>
            </>
          )}
          {data.players.map((p) => (
            <div key={p.id} className="flex flex-col gap-1">
              <Sub>{p.displayName}'s side</Sub>
              <span className="whitespace-pre-wrap text-sm">
                {data.dispute.statements[p.id]?.text ?? `${p.displayName} has not added their side.`}
              </span>
              <ScreenshotList
                shots={data.dispute.screenshots[p.id] ?? []}
                owner={p.displayName}
                currentRound={data.dispute.round}
              />
            </div>
          ))}
        </Card>

        {data.earlierDisputes.length > 0 && (
          <Card className="flex flex-col gap-3" role="region" aria-label="Earlier disputes">
            <Sub>earlier disputes (players can't see these)</Sub>
            {data.earlierDisputes.map((d, i) => (
              <div key={i} className="flex flex-col gap-1 border-t border-line pt-2 first:border-t-0 first:pt-0">
                {d.reason === null ? (
                  <span className="text-sm text-muted">No details (filed before the dispute form)</span>
                ) : (
                  <>
                    <b className="text-sm">Disputed games: {d.games.join(', ')}</b>
                    <span className="whitespace-pre-wrap text-sm">
                      {name(d.by)} wrote: <q>{d.reason}</q>
                    </span>
                  </>
                )}
                {data.players.map((p) => (
                  <span key={p.id} className="whitespace-pre-wrap text-sm">
                    <b>{p.displayName}'s side: </b>
                    {d.statements[p.id]?.text ?? `${p.displayName} did not add their side.`}
                  </span>
                ))}
                {d.ruling && (
                  <span className="whitespace-pre-wrap text-sm">
                    Ruling: {OUTCOME_NAMES[d.ruling.outcome]} by {d.ruling.by?.displayName ?? 'an Admin'}: {d.ruling.reason}
                  </span>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3" role="region" aria-label="Dispute records">
          <Sub>dispute records</Sub>
          {data.players.map((p) => (
            <Record key={p.id} player={p} record={data.records[p.id]} current={data.matchId} />
          ))}
        </Card>

        <Card className="flex flex-col gap-2" role="region" aria-label="Match chat">
          <Sub>match chat</Sub>
          {data.messages.length === 0 ? (
            <span className="text-sm text-muted">No messages.</span>
          ) : (
            <ol className="m-0 flex max-h-96 list-none flex-col gap-1 overflow-y-auto p-0">
              {data.messages.map((m) => (
                <li key={m.id} className={cx('text-sm', m.from === null && 'text-muted italic')}>
                  {m.from !== null && <b>{name(m.from)}: </b>}
                  {m.text}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
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
  onRule,
}: {
  data: Case
  busy: boolean
  onRule: (outcome: RulingOutcome, reason: string, extra?: RulingExtra) => void
}) {
  const [outcome, setOutcome] = useState<RulingOutcome | null>(null)
  const [fromGame, setFromGame] = useState(data.replayFrom.default)
  const [reason, setReason] = useState('')
  const [winners, setWinners] = useState(() => proposedWinners(data))
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  const corrections = data.games.filter((g) => winners[g.n] !== g.winner).map((g) => ({ n: g.n, winner: winners[g.n] }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!outcome) return setError('Pick a Ruling.')
    if (outcome === 'overturn' && corrections.length === 0) return setError('Correct the winner of at least one game.')
    if (!reason.trim()) return setError('Give a reason. Both players will see it.')
    onRule(
      outcome,
      reason.trim(),
      outcome === 'overturn' ? { games: corrections } : outcome === 'replay' ? { fromGame } : undefined,
    )
  }

  return (
    <form onSubmit={submit} noValidate className="da-card flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="m-0 text-lg font-semibold">
        Ruling
      </h2>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
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
            <span>
              <b>{o.label}</b>. {o.help}
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
        value={reason}
        onChange={(e) => {
          setReason(e.target.value)
          setError(null)
        }}
        rows={3}
        maxLength={MAX_REASON}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className={FIELD}
      />
      {error && (
        <span id={`${id}-error`} role="alert" className="text-xs text-chaos-soft">
          {error}
        </span>
      )}
      <div>
        <Btn type="submit" disabled={busy}>
          Give Ruling
        </Btn>
      </div>
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
          <div key={g.n} className={cx('flex items-center gap-2 text-sm', disputed && 'font-semibold text-gold-note')}>
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
