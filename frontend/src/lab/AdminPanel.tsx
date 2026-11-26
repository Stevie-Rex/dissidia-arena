import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { Avatar } from '../components/ui'
import './lab-admin.css'

const ADMIN = 'Aster Vale'
const MASTER = 'Rook'
const CASES = [
  { id: 'DA-2841', type: 'Dispute', players: ['LimitBreak', 'Nightfall'], game: '012', age: '12 min ago', claim: '' },
  { id: 'DA-2840', type: 'Help', players: ['Morrow', 'Vesper'], game: 'NT', age: '27 min ago', claim: ADMIN },
  { id: 'DA-2838', type: 'Dispute', players: ['ArcLight', 'Northwind'], game: 'NT', age: '48 min ago', claim: 'Iris' },
  { id: 'DA-2834', type: 'Help', players: ['Sable', 'Lumen'], game: '012', age: '1 hr ago', claim: '' },
  { id: 'DA-2831', type: 'Dispute', players: ['Kestrel', 'Solstice'], game: '012', age: '2 hr ago', claim: MASTER },
  { id: 'DA-2828', type: 'Help', players: ['Moonrise', 'Ember'], game: 'NT', age: '3 hr ago', claim: 'Iris' },
] as const

type Case = (typeof CASES)[number]
type Action = 'Claim' | 'Ruling' | 'Close' | 'Void' | 'Appoint' | 'Remove'
type Resolution = 'Ruling' | 'Close' | 'Void'
type Entry = { time: string; actor: string; action: Action; target: string }
type Tab = 'Cases' | 'Log' | 'Admins'
const ACTIONS: Action[] = ['Claim', 'Ruling', 'Close', 'Void', 'Appoint', 'Remove']
const FILTERS = ['All', 'Disputes', 'Help', 'Unclaimed', 'Mine'] as const
const ADMINS = [ADMIN, 'Iris', 'Wren']
const CANDIDATES = ['Sable', 'Vesper', 'Lumen']
const LOG: Entry[] = [
  { time: '18:42', actor: ADMIN, action: 'Claim', target: 'DA-2840' },
  { time: '18:21', actor: 'Iris', action: 'Claim', target: 'DA-2838' },
  { time: '18:08', actor: MASTER, action: 'Ruling', target: 'DA-2831' },
  { time: '17:56', actor: 'Iris', action: 'Void', target: 'DA-2828' },
  { time: '17:44', actor: MASTER, action: 'Appoint', target: 'Wren' },
  { time: '17:13', actor: MASTER, action: 'Claim', target: 'DA-2831' },
  { time: '16:48', actor: ADMIN, action: 'Close', target: 'DA-2834' },
  { time: '16:32', actor: MASTER, action: 'Remove', target: 'Meridian' },
  { time: '16:05', actor: 'Iris', action: 'Claim', target: 'DA-2828' },
]

function Badge({ children }: { children: Action | Case['type'] }) {
  return <span className="lab-admin-badge" data-action={children}>{children}</span>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="lab-admin-section"><h2>{title}</h2>{children}</section>
}

function CaseEvidence({ item }: { item: Case }) {
  const [first, second] = item.players
  const dispute = item.type === 'Dispute'
  return (
    <div className="lab-admin-evidence">
      <Section title="Reported games">
        <table className="lab-admin-games">
          <thead><tr><th>Game</th><th>Reported winner</th><th>Response</th></tr></thead>
          <tbody>
            <tr><th scope="row">1</th><td>{first}</td><td>Confirmed</td></tr>
            <tr><th scope="row">2</th><td>{second}</td><td>{dispute ? 'Disputed' : 'Confirmed'}</td></tr>
            <tr><th scope="row">3</th><td>{dispute ? first : '—'}</td><td>{dispute ? 'Disputed' : 'Not reported'}</td></tr>
          </tbody>
        </table>
      </Section>
      <Section title="Statements">
        <div className="lab-admin-statements">
          <div><h3>{first}</h3><p>{dispute ? 'Game 2 ended after a disconnect. The screenshot shows the result before the lobby closed.' : 'We finished two games. The room closed before game 3 and we cannot rejoin.'}</p></div>
          <div><h3>{second}</h3><p>{dispute ? 'The disconnect happened before the final hit. We played another game, but it was entered as game 3.' : 'I can replay game 3 if the match room is reopened.'}</p></div>
        </div>
      </Section>
      <Section title="Screenshots">
        {dispute ? (
          <details className="lab-admin-screenshot">
            <summary>game-2-result.png · {first}</summary>
            <figure>
              <div className="lab-admin-capture" role="img" aria-label={`Sample result screen showing ${second} as the game 2 winner`}>
                <span>Game 2 result</span><strong>{second}</strong><span>Winner</span>
              </div>
              <figcaption>Sample attachment</figcaption>
            </figure>
          </details>
        ) : <p className="lab-admin-muted">No Screenshots attached.</p>}
      </Section>
      <Section title="Match chat">
        <ul className="lab-admin-history">
          <li><time>18:24</time><strong>{first}</strong><span>{dispute ? 'Did that result count?' : 'I lost the room. Can you still see it?'}</span></li>
          <li><time>18:25</time><strong>{second}</strong><span>{dispute ? 'I only saw the disconnect.' : 'No, it closed on my side too.'}</span></li>
        </ul>
      </Section>
      <Section title={dispute ? 'Dispute records' : 'Help request records'}>
        <ul className="lab-admin-history">
          <li><time>18:27</time><strong>{first}</strong><span>{dispute ? 'Disputed games 2 and 3.' : 'Requested help with the match room.'}</span></li>
          {dispute && <li><time>18:29</time><strong>{second}</strong><span>Added a statement.</span></li>}
        </ul>
      </Section>
    </div>
  )
}

function CaseWorkspace({ item, claim, actor, master, resolved, onClaim, onResolve }: {
  item: Case
  claim: string
  actor: string
  master: boolean
  resolved?: Resolution
  onClaim: (owner: string) => void
  onResolve: (action: Resolution) => void
}) {
  const key = `lab-admin-draft-${item.id}`
  const [reason, setReason] = useState(() => {
    try { return localStorage.getItem(key) ?? '' } catch { return '' }
  })
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState('')
  const scroll = useRef<HTMLDivElement>(null)
  const drawerButton = useRef<HTMLButtonElement>(null)
  const formTitle = useRef<HTMLHeadingElement>(null)
  const dispute = item.type === 'Dispute'
  const formTitleText = dispute ? 'Write ruling' : 'Close or void'
  const canResolve = claim === actor && !resolved

  useEffect(() => {
    if (open && drawerButton.current?.getClientRects().length) formTitle.current?.focus()
  }, [open])

  function editReason(value: string) {
    setReason(value)
    try { localStorage.setItem(key, value) } catch { /* The current session still has the draft. */ }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canResolve || !reason.trim() || !outcome) return
    onResolve(dispute ? 'Ruling' : outcome === 'void' ? 'Void' : 'Close')
    editReason('')
    setOpen(false)
    scroll.current?.scrollTo({ top: 0 })
  }

  return (
    <div className="lab-admin-workspace" data-drawer={open && canResolve}>
      <div className="lab-admin-case-scroll" ref={scroll}>
        <header className="lab-admin-summary">
          <div><Badge>{item.type}</Badge> <span className="lab-admin-muted">{item.id} · {item.game}</span><h2>{item.players.join(' vs ')}</h2></div>
          <div><span className="lab-admin-muted">Status</span><strong>{resolved ? { Ruling: 'Ruled', Close: 'Closed', Void: 'Voided' }[resolved] : dispute ? 'Disputed' : 'Help requested'}</strong></div>
          <div><span className="lab-admin-muted">Claim</span><strong>{claim || 'Unclaimed'}</strong></div>
          {!resolved && (!claim || claim === actor || master) && (
            <button type="button" onClick={() => { setOpen(false); onClaim(claim === actor ? '' : actor) }}>
              {claim === actor ? 'Release claim' : claim ? 'Take over claim' : 'Claim case'}
            </button>
          )}
        </header>
        <div className="lab-admin-case-grid">
          <CaseEvidence item={item} />
          <aside className="lab-admin-form" aria-label={formTitleText}>
            <div className="lab-admin-form-heading">
              <h2 ref={formTitle} tabIndex={-1}>{formTitleText}</h2>
              <button className="lab-admin-drawer-dismiss" type="button" onClick={() => { setOpen(false); requestAnimationFrame(() => drawerButton.current?.focus()) }}>Hide panel</button>
            </div>
            {resolved ? <p>Action recorded in the Admin log.</p> : (
              <form onSubmit={submit}>
                <fieldset disabled={!canResolve}>
                  <label>Outcome<select required value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                    <option value="">Select an outcome</option>
                    {dispute ? <>
                      {item.players.map((player) => <option key={player} value={player}>Award match to {player}</option>)}
                      <option value="replay">Replay disputed games</option>
                    </> : <option value="close">Close Help request</option>}
                    <option value="void">Void match</option>
                  </select></label>
                  <label>Reason<textarea rows={4} required value={reason} onChange={(event) => editReason(event.target.value)} /></label>
                  <button type="submit" className="lab-admin-primary" disabled={!outcome || !reason.trim()}>
                    {dispute ? 'Submit ruling' : outcome === 'void' ? 'Void match' : 'Close Help request'}
                  </button>
                </fieldset>
                {!canResolve && <p className="lab-admin-muted">{claim ? `Claimed by ${claim}.` : 'Claim this case to start.'}</p>}
              </form>
            )}
          </aside>
        </div>
      </div>
      {canResolve && !open && <button ref={drawerButton} type="button" className="lab-admin-drawer-toggle lab-admin-primary" onClick={() => setOpen(true)}>{formTitleText}</button>}
    </div>
  )
}

export function AdminPanel({ master, initialCase, onCaseChange }: {
  master: boolean
  initialCase: string | null
  onCaseChange: (id: string | null) => void
}) {
  const [tab, setTab] = useState<Tab>('Cases')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [selected, setSelected] = useState(initialCase)
  const [claims, setClaims] = useState<Record<string, string>>({})
  const [resolved, setResolved] = useState<Record<string, Resolution>>({})
  const [log, setLog] = useState(LOG)
  const [admins, setAdmins] = useState(ADMINS)
  const [actionFilter, setActionFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [search, setSearch] = useState('')
  const [logPlayer, setLogPlayer] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const actor = master ? MASTER : ADMIN
  const visibleTab = !master && tab === 'Admins' ? 'Cases' : tab
  const item = visibleTab === 'Cases' ? CASES.find((entry) => entry.id === selected) : undefined
  const claimFor = (entry: Case) => claims[entry.id] ?? entry.claim
  const cases = CASES.filter((entry) => !resolved[entry.id] && (
    filter === 'All' ||
    (filter === 'Disputes' && entry.type === 'Dispute') ||
    (filter === 'Help' && entry.type === 'Help') ||
    (filter === 'Unclaimed' && !claimFor(entry)) ||
    (filter === 'Mine' && claimFor(entry) === actor)
  ))
  const entries = log.filter((entry) => (!actionFilter || entry.action === actionFilter) && (!actorFilter || entry.actor === actorFilter))
  const candidates = [...CANDIDATES, ...ADMINS].filter((name) => search.trim() && !admins.includes(name) && name.toLowerCase().includes(search.trim().toLowerCase()))

  function navigate(next: Tab, id: string | null = null) {
    setTab(next)
    setSelected(id)
    onCaseChange(id)
    if (id || selected) heading.current?.focus()
  }

  function record(action: Action, target: string) {
    setLog((previous) => [{ time: 'Now', actor, action, target }, ...previous])
  }

  return (
    <div className="lab-admin-panel">
      <header className="lab-admin-header">
        <div><h1 className="lab-h1" ref={heading} tabIndex={-1}>Admin panel</h1><span className="lab-admin-muted">{actor} · {master ? 'Master' : 'Admin'}</span></div>
        <nav aria-label="Admin panel views">
          {(['Cases', 'Log', ...(master ? ['Admins'] : [])] as Tab[]).map((name) => (
            <button key={name} type="button" aria-current={visibleTab === name ? 'page' : undefined} onClick={() => navigate(name)}>{name}</button>
          ))}
        </nav>
      </header>

      {item ? <>
        <div className="lab-admin-back"><button type="button" onClick={() => navigate('Cases')}><span aria-hidden="true">← </span>Back to cases</button></div>
        <CaseWorkspace key={item.id} item={item} claim={claimFor(item)} actor={actor} master={master} resolved={resolved[item.id]}
          onClaim={(owner) => { setClaims((previous) => ({ ...previous, [item.id]: owner })); if (owner) record('Claim', item.id) }}
          onResolve={(action) => { setResolved((previous) => ({ ...previous, [item.id]: action })); record(action, item.id) }} />
      </> : <div className="lab-admin-list">
        {visibleTab === 'Cases' && <>
          <div className="lab-admin-filters" role="group" aria-label="Case filters">
            {FILTERS.map((name) => <button key={name} type="button" aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}
          </div>
          {cases.length ? <table className="lab-admin-cases" aria-label="Open cases" role="table">
            <thead role="rowgroup"><tr role="row">{['Type', 'Match', 'Players', 'Game', 'Age', 'Claim'].map((name) => <th key={name} scope="col" role="columnheader">{name}</th>)}</tr></thead>
            <tbody role="rowgroup">{cases.map((entry) => (
              <tr key={entry.id} role="row">
                <td role="cell"><Badge>{entry.type}</Badge></td>
                <td role="cell"><button type="button" className="lab-admin-link" onClick={() => navigate('Cases', entry.id)}>{entry.id}</button></td>
                <td role="cell">{entry.players.join(' vs ')}</td>
                <td role="cell">{entry.game}</td>
                <td role="cell" className="lab-admin-muted">{entry.age}</td>
                <td role="cell" className={claimFor(entry) ? '' : 'lab-admin-muted'}>
                  <span className="lab-admin-phone-claim">Claim · </span>{claimFor(entry) || 'Unclaimed'}
                </td>
              </tr>
            ))}</tbody>
          </table> : <p className="lab-admin-empty">No cases match this filter.</p>}
        </>}

        {visibleTab === 'Log' && <>
          <div className="lab-admin-filters">
            <div><label htmlFor="lab-admin-action">Action</label><select id="lab-admin-action" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
              <option value="">All actions</option>{ACTIONS.map((action) => <option key={action}>{action}</option>)}
            </select></div>
            <div><label htmlFor="lab-admin-actor">Admin</label><select id="lab-admin-actor" value={actorFilter} onChange={(event) => setActorFilter(event.target.value)}>
              <option value="">All Admins</option>{[...new Set(log.map((entry) => entry.actor))].map((name) => <option key={name}>{name}</option>)}
            </select></div>
          </div>
          {entries.length ? <ul className="lab-admin-log" aria-label="Admin log">{entries.map((entry, index) => (
            <li key={`${entry.time}-${entry.target}-${index}`}>
              <time>{entry.time}</time>
              <span className="lab-admin-person"><Avatar name={entry.actor} size={24} />{entry.actor}</span>
              <Badge>{entry.action}</Badge>
              {CASES.some((target) => target.id === entry.target)
                ? <a href={`?page=admin&case=${entry.target}`} className="lab-admin-link" onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  navigate('Cases', entry.target)
                }}>{entry.target}</a>
                : <a href="#lab-admin-log-player" className="lab-admin-link" onClick={(event) => {
                  event.preventDefault()
                  setLogPlayer(entry.target)
                  requestAnimationFrame(() => document.getElementById('lab-admin-log-player')?.focus())
                }}>{entry.target}</a>}
            </li>
          ))}</ul> : <p className="lab-admin-empty">No log entries match these filters.</p>}
          {logPlayer && (
            <div className="lab-admin-log-player" id="lab-admin-log-player" tabIndex={-1}>
              <span className="lab-admin-person"><Avatar name={logPlayer} /> <strong>{logPlayer}</strong></span>
              <span>{admins.includes(logPlayer) ? 'Current Admin' : 'Player'}</span>
            </div>
          )}
        </>}

        {visibleTab === 'Admins' && <div className="lab-admin-roster">
          <Section title="Appoint an Admin">
            <label>Find a player<input type="search" value={search} placeholder="Search by player name" onChange={(event) => setSearch(event.target.value)} /></label>
            {search.trim() && (candidates.length ? <ul>{candidates.map((name) => <li key={name}>
              <span className="lab-admin-person"><Avatar name={name} />{name}</span>
              <button type="button" aria-label={`Appoint ${name}`} onClick={() => { setAdmins([...admins, name]); setSearch(''); record('Appoint', name) }}>Appoint</button>
            </li>)}</ul> : <p className="lab-admin-muted">No eligible players found.</p>)}
          </Section>
          <Section title="Current Admins">
            <ul>{admins.map((name) => <li key={name}>
              <span className="lab-admin-person"><Avatar name={name} />{name}</span>
              <button type="button" aria-label={`Remove ${name}`} onClick={() => { setAdmins(admins.filter((entry) => entry !== name)); record('Remove', name) }}>Remove</button>
            </li>)}</ul>
          </Section>
        </div>}
      </div>}
    </div>
  )
}
