import { useEffect, useId, useState, type FormEvent } from 'react'
import AdminTabs from '../components/AdminTabs'
import RoleGate from '../components/RoleGate'
import { Avatar, Btn, Card, PageTitle, Sub } from '../components/ui'
import { MAX_REASON, api, errorMessage, type AdminInfo, type PlayerResult } from '../lib/api'
import { FIELD } from '../lib/format'

/** The Admin panel's Admins tab: the Master appoints and removes Admins. */
export default function MasterPanel() {
  return (
    <RoleGate allow={['master']} who="the Master">
      <Panel />
    </RoleGate>
  )
}

function Panel() {
  const [admins, setAdmins] = useState<AdminInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    api.admins().then(
      (r) => current && setAdmins(r.admins),
      (e) => current && setError(errorMessage(e)),
    )
    return () => {
      current = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <PageTitle>Admins</PageTitle>
      <AdminTabs />
      <Appoint onAppointed={setAdmins} />
      <section aria-labelledby="admins-title" className="flex flex-col gap-3">
        <h2 id="admins-title" className="m-0 text-lg font-semibold">
          Admins
        </h2>
        {error && (
          <p role="alert" className="m-0 text-sm text-chaos-soft">
            {error}
          </p>
        )}
        {admins === null ? (
          !error && <Sub>Loading…</Sub>
        ) : admins.length === 0 ? (
          <Card>
            <p className="m-0 text-sm">No Admins yet. Appoint one above, so you aren't the only one handling disputes.</p>
          </Card>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {admins.map((a) => (
              <li key={a.id}>
                <Card className="flex flex-col gap-2">
                  <PlayerLine player={a} extra={`Admin since ${new Date(a.since).toLocaleDateString()}`} />
                  <ReasonAction
                    open="Remove"
                    label={`Why are you removing ${a.displayName}?`}
                    confirm={`Remove ${a.displayName}`}
                    variant="chaos"
                    onConfirm={async (reason) => setAdmins((await api.removeAdmin(a.id, reason)).admins)}
                  />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Appoint({ onAppointed }: { onAppointed: (admins: AdminInfo[]) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PlayerResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  const search = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setResults((await api.searchPlayers(q)).players)
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const appoint = async (player: PlayerResult, reason: string) => {
    const { admins } = await api.appointAdmin(player.id, reason)
    onAppointed(admins)
    setResults((rs) => rs?.map((r) => (r.id === player.id ? { ...r, role: 'admin' } : r)) ?? null)
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className="m-0 text-lg font-semibold">
        Appoint an Admin
      </h2>
      <p className="m-0 max-w-2xl text-sm text-muted">
        Only players who have signed in to the site or used the bot can be appointed. Admin powers cover both games.
      </p>
      <form role="search" onSubmit={search} className="flex max-w-xl items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`${id}-q`} className="text-sm font-semibold">
            Search players by Discord name
          </label>
          <input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} className={FIELD} />
        </div>
        <Btn type="submit" size="lg">
          Search
        </Btn>
      </form>
      {error && (
        <p role="alert" className="m-0 text-sm text-chaos-soft">
          {error}
        </p>
      )}
      {results &&
        (results.length === 0 ? (
          <Sub>No players found.</Sub>
        ) : (
          <ul aria-label="Search results" className="m-0 flex list-none flex-col gap-2 p-0">
            {results.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-col gap-2">
                  <PlayerLine player={p} />
                  {p.role === 'player' ? (
                    <ReasonAction
                      open="Appoint"
                      label={`Why are you appointing ${p.displayName}?`}
                      confirm={`Appoint ${p.displayName}`}
                      onConfirm={(reason) => appoint(p, reason)}
                    />
                  ) : (
                    <Sub>{p.role === 'master' ? 'The Master' : 'Already an Admin'}</Sub>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}

function PlayerLine({ player, extra }: { player: PlayerResult; extra?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={player.displayName} src={player.avatarUrl || undefined} size={32} />
      <div className="flex flex-col">
        <span className="font-semibold">{player.displayName}</span>
        <Sub>
          @{player.username}
          {extra && ` · ${extra}`}
        </Sub>
      </div>
    </div>
  )
}

/** A button that opens a required-reason form before acting. */
function ReasonAction({
  open,
  label,
  confirm,
  variant,
  onConfirm,
}: {
  open: string
  label: string
  confirm: string
  variant?: 'chaos'
  onConfirm: (reason: string) => Promise<unknown>
}) {
  const [shown, setShown] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = useId()

  if (!shown)
    return (
      <div>
        <Btn variant="ghost" onClick={() => setShown(true)} aria-label={confirm}>
          {open}
        </Btn>
      </div>
    )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setError('Give a reason. It goes in the Admin log.')
    setBusy(true)
    try {
      await onConfirm(reason.trim())
      setShown(false)
      setReason('')
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} aria-label={confirm} className="flex flex-col gap-2" noValidate>
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
        rows={2}
        maxLength={MAX_REASON}
        autoFocus
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className={FIELD}
      />
      {error && (
        <span id={`${id}-error`} role="alert" className="text-xs text-chaos-soft">
          {error}
        </span>
      )}
      <div className="flex gap-2">
        <Btn type="submit" variant={variant} disabled={busy}>
          {confirm}
        </Btn>
        <Btn variant="ghost" onClick={() => setShown(false)}>
          Cancel
        </Btn>
      </div>
    </form>
  )
}
