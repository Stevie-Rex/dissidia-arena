import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import {
  BackToCases,
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
import { Btn, Sub } from '../components/ui'
import { MAX_REASON, api, errorMessage, type HelpRequestCase } from '../lib/api'
import { FIELD, cx } from '../lib/format'
import { useDraft } from '../lib/useDraft'
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
    <div className="flex flex-col gap-4">
      <BackToCases />
      {!data && <h2 className="m-0 text-xl font-semibold">Help request</h2>}
      {error && !data && <Alert>{error}</Alert>}
      {!data && !error && <Sub>Loading…</Sub>}
      {/* keyed so moving to another request starts its forms afresh */}
      {data && <HelpRequestView key={data.helpRequestId} data={data} onChange={accept} reload={reload} />}
    </div>
  )
}

/** The request in the order an Admin reads it: summary, the match, what was asked and the chat, with the forms beside them. */
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
  const [error, setError] = useState<{ from: 'claim' | 'close' | 'void'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const summaryHeading = useRef<HTMLHeadingElement>(null)
  const isMaster = user?.role === 'master'
  const { match, claim } = data
  const name = (uid: number) => match.players.find((p) => p.id === uid)?.displayName ?? 'Unknown player'
  const open = data.closed === null
  const showClose = open && (!data.playedIn || isMaster)
  const canClose = showClose && data.canAct
  const failure = (from: 'close' | 'void') => (error?.from === from ? error.text : null)

  const run = async (from: 'claim' | 'close' | 'void', call: () => Promise<unknown>, then?: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await call()
      await then?.()
      return true
    } catch (e) {
      setError({ from, text: errorMessage(e) })
      return false
    } finally {
      setBusy(false)
    }
  }
  const act = (action: 'claim' | 'release' | 'takeover') => {
    setPanelOpen(false)
    run('claim', () => api.helpRequestAction(data.helpRequestId, action).then(onChange))
  }
  /** Puts the panel away and goes to the summary, where the result shows and which may be scrolled away. */
  const showResult = () => {
    setPanelOpen(false)
    summaryHeading.current?.focus()
  }
  const close = async (reason: string, sent: () => void) => {
    const saved = await run('close', () =>
      api.closeHelpRequest(data.helpRequestId, reason).then((d) => (sent(), onChange(d))),
    )
    if (saved) showResult()
  }
  const voidMatch = async (reason: string, sent: () => void) => {
    const saved = await run('void', () => api.voidMatch(match.id, reason).then(sent), reload)
    // With the request still to close, the panel stays open for its reason.
    if (saved && !canClose) showResult()
  }

  return (
    <div className="case-page">
      <CaseSummary
        label="Request status"
        kind="help"
        game={data.game}
        platform={data.platform}
        title={`Help request: Match #${match.id}`}
        players={[match.players[0].displayName, match.players[1].displayName]}
        headingRef={summaryHeading}
        status={open ? 'Help requested' : 'Closed'}
        claim={open && <ClaimText claim={claim} noun="request" />}
        actions={
          open && <ClaimButtons claim={claim} playedIn={data.playedIn} isMaster={isMaster} busy={busy} onAct={act} />
        }
      >
        {data.closed && (
          <div className="flex flex-col gap-1">
            <span className="wrap-anywhere whitespace-pre-wrap text-sm">{data.closed.reason}</span>
            <Sub>
              By {data.closed.by?.displayName ?? 'an Admin'} ·{' '}
              <time dateTime={data.closed.at}>{new Date(data.closed.at).toLocaleString()}</time>
            </Sub>
          </div>
        )}
        {open && data.playedIn && <PlayedInNote isMaster={isMaster} />}
        {error?.from === 'claim' && <Alert>{error.text}</Alert>}
      </CaseSummary>

      <div className="case-evidence">
        <CaseSection title="Match">
          <b className="text-sm">
            {match.status === 'voided' ? 'Voided' : match.status[0].toUpperCase() + match.status.slice(1)}
            {match.games.length > 0 && ` · ${match.score[0]}–${match.score[1]} (first to ${match.winsNeeded})`}
          </b>
          <GamesTable games={match.games} name={name} />
        </CaseSection>

        <CaseSection title="Request">
          <b className="text-sm">{data.askedBy.displayName} asked for help</b>
          <span className="wrap-anywhere whitespace-pre-wrap text-sm">
            <q>{data.message}</q>
          </span>
          <Sub>
            <time dateTime={data.askedAt}>{new Date(data.askedAt).toLocaleString()}</time>
          </Sub>
        </CaseSection>

        <MatchChat messages={match.messages} name={name} />
      </div>

      {(showClose || match.canVoid || !open) && (
        <CaseSide title="Close or void" ready={canClose || match.canVoid} open={panelOpen} onOpenChange={setPanelOpen}>
          {!open && <p className="m-0 text-sm">Action recorded in the Admin log.</p>}
          {showClose && (
            <ReasonForm
              draftKey={`help:${data.helpRequestId}:close`}
              title="Close request"
              note={
                canClose ? undefined : claim ? `Claimed by ${claim.by.displayName}.` : 'Claim this request to close it.'
              }
              disabled={!canClose}
              label="Reason (pass it to the Master here if it needs them; the player doesn't see it)"
              submit="Close request"
              busy={busy}
              failure={failure('close')}
              onSubmit={close}
            />
          )}
          {match.canVoid && (
            <ReasonForm
              draftKey={`help:${data.helpRequestId}:void`}
              title="Void this match"
              label="Reason (goes in the Admin log)"
              help="Both players can queue again and nothing counts against anyone."
              submit="Void match"
              busy={busy}
              failure={failure('void')}
              onSubmit={voidMatch}
            />
          )}
        </CaseSide>
      )}
    </div>
  )
}

/** A form with one required reason, for closing a request and for Voiding a match. */
function ReasonForm({
  draftKey,
  title,
  note,
  disabled,
  label,
  help,
  submit,
  busy,
  failure,
  onSubmit,
}: {
  draftKey: string
  title: string
  /** Why the form can't be used yet. */
  note?: string
  disabled?: boolean
  label: string
  help?: string
  submit: string
  busy: boolean
  /** Why the server refused the last reason sent. */
  failure: string | null
  /** Call `sent` once the server has taken the reason, which forgets the draft. */
  onSubmit: (reason: string, sent: () => void) => void
}) {
  const reason = useDraft(draftKey)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const send = (e: FormEvent) => {
    e.preventDefault()
    if (!reason.text.trim()) return setError('Give a reason.')
    onSubmit(reason.text.trim(), reason.clear)
  }
  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-2 border-line [&+form]:border-t [&+form]:pt-3" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="m-0 text-base font-semibold">
        {title}
      </h3>
      {note && <p className="m-0 text-sm font-semibold">{note}</p>}
      <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        {help && <p className="m-0 text-sm text-muted">{help}</p>}
        <label htmlFor={`${id}-reason`} className="text-sm font-semibold">
          {label}
        </label>
        <textarea
          id={`${id}-reason`}
          value={reason.text}
          onChange={(e) => {
            reason.set(e.target.value)
            setError(null)
          }}
          rows={3}
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
            {submit}
          </Btn>
        </div>
      </fieldset>
    </form>
  )
}
