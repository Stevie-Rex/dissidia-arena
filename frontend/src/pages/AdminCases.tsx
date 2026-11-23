import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import AdminTabs from '../components/AdminTabs'
import RoleGate from '../components/RoleGate'
import { Btn, Card, PageTitle, Select, Sub } from '../components/ui'
import { GAMES } from '../data/mock'
import {
  MAX_REASON,
  api,
  errorMessage,
  type Case,
  type CasePlayer,
  type CaseSummary,
  type DisputeRecord,
  type GameCorrection,
  type RulingOutcome,
} from '../lib/api'
import { FIELD, cx } from '../lib/format'
import { useApp } from '../state/AppState'

const OUTCOMES: { value: RulingOutcome; label: string; help: string }[] = [
  { value: 'uphold', label: 'Uphold', help: 'The reported result stands. The winner gets the ranked win and any unlocks.' },
  {
    value: 'overturn',
    label: 'Overturn',
    help: 'Correct the winner of any reported game. Whoever the corrected games make the winner gets the ranked win and any unlocks.',
  },
  { value: 'void', label: 'Void', help: 'No one wins and nothing counts against anyone.' },
]
const OUTCOME_NAMES: Record<RulingOutcome, string> = { uphold: 'Upheld', overturn: 'Overturned', void: 'Voided' }

const since = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return mins < 60 ? `${mins} min` : mins < 48 * 60 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`
}

function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="m-0 text-sm text-chaos-soft">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------- the case list

/** The Admin area's front page: open Disputed matches, and whether each is claimed. */
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

function CaseList() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        <p className="m-0 text-sm">No Disputed matches are waiting for a Ruling.</p>
      </Card>
    )
  return (
    <section aria-label="Open cases">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {cases.map((c) => (
          <li key={c.matchId}>
            <Card className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-1">
                <Link to={`/admin/cases/${c.matchId}`} className="font-semibold text-gold-note hover:text-crystal-soft">
                  Match #{c.matchId}: {c.players[0]} vs {c.players[1]}
                </Link>
                <Sub>
                  {GAMES[c.game].name} · {c.platform}
                  {c.disputedAt && <> · disputed {since(c.disputedAt)} ago</>}
                </Sub>
              </div>
              <span className={cx('text-sm', c.claim ? 'text-fg-dim' : 'text-gold-note')}>
                {c.claim ? `Claimed by ${c.claim.byYou ? 'you' : c.claim.by.displayName}` : 'Unclaimed'}
              </span>
            </Card>
          </li>
        ))}
      </ul>
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
      {data && <CaseView data={data} onChange={setData} />}
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
            onRule={(outcome, reason, games) => run(() => api.rule(data.matchId, outcome, reason, games))}
          />
        )}

        <Card className="flex flex-col gap-2" role="region" aria-label="Reported games">
          <Sub>reported games</Sub>
          <b className="text-sm">
            {name(data.reportedBy)} reported {data.score[0]}–{data.score[1]} ({name(data.winner)} wins, first to {data.winsNeeded})
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
            </div>
          ))}
        </Card>
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
  onRule: (outcome: RulingOutcome, reason: string, games?: GameCorrection[]) => void
}) {
  const [outcome, setOutcome] = useState<RulingOutcome | null>(null)
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
    onRule(outcome, reason.trim(), outcome === 'overturn' ? corrections : undefined)
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
