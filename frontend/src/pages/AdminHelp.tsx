import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import AdminTabs from '../components/AdminTabs'
import RoleGate from '../components/RoleGate'
import { Btn, Card, PageTitle, Sub } from '../components/ui'
import { GAMES } from '../data/mock'
import { MAX_REASON, api, errorMessage, type HelpRequestCase } from '../lib/api'
import { FIELD, cx, since } from '../lib/format'
import { useApp } from '../state/AppState'
import { Alert } from './AdminCases'

/** A Help request: what the player asked, the match, and the Admin's controls (Claim, close, Void). */
export function HelpRequestPage() {
  return (
    <RoleGate allow={['admin', 'master']} who="Admins">
      <HelpRequestLoader />
    </RoleGate>
  )
}

function HelpRequestLoader() {
  const id = Number(useParams().id)
  const [data, setData] = useState<HelpRequestCase | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The route keeps this mounted when :id changes, so a response for the request we left must not replace the new one.
  const currentId = useRef(id)
  useEffect(() => {
    currentId.current = id
  }, [id])
  const accept = useCallback((d: HelpRequestCase) => {
    if (d.helpRequestId === currentId.current) setData(d)
  }, [])

  useEffect(() => {
    let current = true
    api.helpRequest(id).then(
      (d) => current && (setData(d), setError(null)),
      (e) => current && setError(errorMessage(e)),
    )
    return () => {
      current = false
    }
  }, [id])

  // A failed reload rejects, so the action that asked for it shows the error (see run in HelpRequestView).
  const reload = useCallback(() => api.helpRequest(id).then(accept), [id, accept])

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Help request</PageTitle>
      <AdminTabs />
      {error && !data && <Alert>{error}</Alert>}
      {!data && !error && <Sub>Loading…</Sub>}
      {/* keyed so moving to another request starts its forms afresh */}
      {data && <HelpRequestView key={data.helpRequestId} data={data} onChange={accept} reload={reload} />}
    </div>
  )
}

function HelpRequestView({
  data,
  onChange,
  reload,
}: {
  data: HelpRequestCase
  onChange: (d: HelpRequestCase) => void
  reload: () => Promise<unknown>
}) {
  const { user } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isMaster = user?.role === 'master'
  const { match, claim } = data
  const name = (uid: number | null) => match.players.find((p) => p.id === uid)?.displayName ?? 'Unknown player'
  const heldByOther = claim !== null && !claim.byYou
  const open = data.closed === null

  const run = async (call: () => Promise<unknown>, then: () => Promise<unknown> | void) => {
    setBusy(true)
    setError(null)
    try {
      await call()
      await then()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const act = (action: 'claim' | 'release' | 'takeover') =>
    run(() => api.helpRequestAction(data.helpRequestId, action).then(onChange), () => {})

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2" role="region" aria-label="Request">
          <Sub>
            {GAMES[data.game].name} · {data.platform} · Match #{match.id}: {match.players[0].displayName} vs{' '}
            {match.players[1].displayName}
          </Sub>
          <b className="text-sm">{data.askedBy.displayName} asked for help</b>
          <span className="whitespace-pre-wrap text-sm">
            <q>{data.message}</q>
          </span>
          <Sub>
            <time dateTime={data.askedAt}>{new Date(data.askedAt).toLocaleString()}</time>
          </Sub>
        </Card>

        <Card className="flex flex-col gap-2" role="region" aria-label="Request status">
          {data.closed ? (
            <>
              <b>Closed</b>
              <span className="whitespace-pre-wrap text-sm">{data.closed.reason}</span>
              <Sub>
                By {data.closed.by?.displayName ?? 'an Admin'} ·{' '}
                <time dateTime={data.closed.at}>{new Date(data.closed.at).toLocaleString()}</time>
              </Sub>
            </>
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
                <p className="m-0 text-sm">You hold the Claim on this request.</p>
              ) : (
                <p className="m-0 text-sm">Unclaimed.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {!claim && (!data.playedIn || isMaster) && (
                  <Btn disabled={busy} onClick={() => act('claim')}>
                    Claim
                  </Btn>
                )}
                {isMaster && heldByOther && (
                  <Btn disabled={busy} onClick={() => act('takeover')}>
                    Take over
                  </Btn>
                )}
                {claim && (claim.byYou || isMaster) && (
                  <Btn variant="ghost" disabled={busy} onClick={() => act('release')}>
                    Release
                  </Btn>
                )}
              </div>
            </>
          )}
          {error && <Alert>{error}</Alert>}
        </Card>

        {open && data.canAct && (
          <ReasonForm
            title="Close request"
            label="Reason (pass it to the Master here if it needs them; the player doesn't see it)"
            submit="Close request"
            busy={busy}
            onSubmit={(reason) =>
              run(() => api.closeHelpRequest(data.helpRequestId, reason).then(onChange), () => {})
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2" role="region" aria-label="Match">
          <Sub>match</Sub>
          <b className="text-sm">
            {match.status === 'voided' ? 'Voided' : match.status[0].toUpperCase() + match.status.slice(1)}
            {match.games.length > 0 && ` · ${match.score[0]}–${match.score[1]} (first to ${match.winsNeeded})`}
          </b>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {match.games.map((g) => (
              <li key={g.n} className="text-sm">
                Game {g.n}: {name(g.winner)} wins (reported by {name(g.reportedBy)})
              </li>
            ))}
          </ol>
        </Card>

        {match.canVoid && (
          <ReasonForm
            title="Void this match"
            label="Reason (goes in the Admin log)"
            help="Both players can queue again and nothing counts against anyone."
            submit="Void match"
            busy={busy}
            onSubmit={(reason) => run(() => api.voidMatch(match.id, reason), reload)}
          />
        )}

        <Card className="flex flex-col gap-2" role="region" aria-label="Match chat">
          <Sub>match chat</Sub>
          {match.messages.length === 0 ? (
            <span className="text-sm text-muted">No messages.</span>
          ) : (
            <ol className="m-0 flex max-h-96 list-none flex-col gap-1 overflow-y-auto p-0">
              {match.messages.map((m) => (
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

/** A form with one required reason, for closing a request and for Voiding a match. */
function ReasonForm({
  title,
  label,
  help,
  submit,
  busy,
  onSubmit,
}: {
  title: string
  label: string
  help?: string
  submit: string
  busy: boolean
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const send = (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setError('Give a reason.')
    onSubmit(reason.trim())
  }
  return (
    <form onSubmit={send} noValidate className="da-card flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="m-0 text-lg font-semibold">
        {title}
      </h2>
      {help && <p className="m-0 text-sm text-muted">{help}</p>}
      <label htmlFor={`${id}-reason`} className="text-sm font-semibold">
        {label}
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
          {submit}
        </Btn>
      </div>
    </form>
  )
}
