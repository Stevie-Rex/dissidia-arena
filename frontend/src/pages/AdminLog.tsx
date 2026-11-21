import { useEffect, useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import RoleGate from '../components/RoleGate'
import { Btn, Card, PageTitle, Sub } from '../components/ui'
import { MAX_REASON, api, errorMessage, type AdminLogEntry, type AdminLogPage } from '../lib/api'
import { FIELD } from '../lib/format'
import { useApp } from '../state/AppState'

const ACTIONS: Record<string, string> = {
  appoint_admin: 'appointed an Admin',
  remove_admin: 'removed an Admin',
  step_down: 'stepped down as an Admin',
  auto_confirm: 'confirmed a result automatically',
}

/** The Admin area: for now, the Admin log (cases come with the Rulings). */
export default function AdminLog() {
  return (
    <RoleGate allow={['admin', 'master']} who="Admins">
      <AdminArea />
    </RoleGate>
  )
}

function AdminArea() {
  const { user } = useApp()
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Admin log</PageTitle>
      <p className="m-0 max-w-2xl text-sm text-muted">
        Every Admin, Master and system action, with the reason given. Nobody can edit or delete an entry.
      </p>
      <LogList />
      {user?.role === 'admin' && <StepDown />}
    </div>
  )
}

function LogList() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AdminLogPage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    api.adminLog(page).then(
      (d) => current && (setData(d), setError(null)),
      (e) => current && setError(errorMessage(e)),
    )
    return () => {
      current = false
    }
  }, [page])

  if (error)
    return (
      <p role="alert" className="m-0 text-sm text-chaos-soft">
        {error}
      </p>
    )
  if (!data) return <Sub>Loading…</Sub>
  return (
    <section aria-label="Admin log entries" className="flex flex-col gap-3">
      {data.entries.length === 0 ? (
        <Card>
          <p className="m-0 text-sm">Nothing logged yet.</p>
        </Card>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {data.entries.map((e) => (
            <LogItem key={e.id} entry={e} />
          ))}
        </ol>
      )}
      {(data.page > 1 || data.hasMore) && (
        <nav aria-label="Admin log pages" className="flex items-center gap-3">
          <Btn variant="ghost" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
            Newer
          </Btn>
          <Sub>Page {data.page}</Sub>
          <Btn variant="ghost" disabled={!data.hasMore} onClick={() => setPage(data.page + 1)}>
            Older
          </Btn>
        </nav>
      )}
    </section>
  )
}

function LogItem({ entry }: { entry: AdminLogEntry }) {
  const who = entry.actor?.displayName ?? 'System'
  return (
    <li>
      <Card className="flex flex-col gap-1">
        <p className="m-0 text-sm">
          <span className="font-semibold">{who}</span> {ACTIONS[entry.action] ?? entry.action}
          {entry.target && entry.target.id !== entry.actor?.id && <>: {entry.target.displayName}</>}
          {entry.matchId !== null && <> · Match #{entry.matchId}</>}
        </p>
        <p className="m-0 whitespace-pre-wrap text-sm text-fg-dim">{entry.reason}</p>
        <Sub>
          <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
        </Sub>
      </Card>
    </li>
  )
}

function StepDown() {
  const { stepDown } = useApp()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = useId()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setError('Say why you are stepping down.')
    setBusy(true)
    try {
      await stepDown(reason.trim())
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="da-card flex max-w-xl flex-col gap-3">
      <h2 id={`${id}-title`} className="m-0 text-lg font-semibold">
        Step down
      </h2>
      <p className="m-0 text-sm text-muted">
        You lose Admin access straight away. Your past Rulings stand, and the Master can appoint you again later.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <label htmlFor={`${id}-reason`} className="text-sm font-semibold">
          Why are you stepping down?
        </label>
        <textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setError(null)
          }}
          rows={2}
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
          <Btn type="submit" variant="chaos" disabled={busy}>
            Step down
          </Btn>
        </div>
      </form>
    </section>
  )
}
