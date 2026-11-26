import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CHARACTERS, GAMES, HELPERS, STAGES, type GameId } from '../data/mock'
import { useApp } from '../state/AppState'
import type { GameDetails, Match, RulingOutcome, Side } from '../lib/api'
import { Avatar, Btn, Card, Pill, Select, SideGlyph, Sub } from '../components/ui'
import VictoryReward from '../components/appearance/VictoryReward'
import { PendingMatchRoom } from '../components/rift/MatchStatus'
import { useAppearance } from '../state/Appearance'
import AskAdmin from '../components/AskAdmin'
import { ScreenshotList, ScreenshotUpload } from '../components/Screenshots'
import { FIELD, cx } from '../lib/format'

const RULING_NOTES: Record<RulingOutcome, string> = {
  uphold: 'An Admin upheld the reported result.',
  overturn: 'An Admin overturned the reported result.',
  replay: 'An Admin ruled that this match is replayed.',
  void: 'An Admin voided the match.',
}

/** 1p — match room: connect info + report on the left, opponent-only chat on the right. */
export default function MatchRoom() {
  const {
    live: current, pending, viewed, matchError, sendChat, reportGame, confirmResult, disputeResult, saveStatement, askAdmin, uploadScreenshot, openMatch,
    abandonMatch, closeMatch, startQueue,
  } = useApp()
  const { ui } = useAppearance()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [disputing, setDisputing] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)

  // ?match=<id> (links from DMs and the dispute notice) shows that match. If it isn't your current
  // match, such as an old Disputed one, it's loaded separately so queue polling can't swap it out.
  const [params] = useSearchParams()
  const linkedId = Number(params.get('match')) || null
  const showViewed = linkedId !== null && linkedId !== current?.id && !(ui === 'rift' && linkedId === pending?.id)
  const live = showViewed ? (viewed?.id === linkedId ? viewed : null) : current
  useEffect(() => {
    if (showViewed) openMatch(linkedId)
  }, [showViewed, linkedId, openMatch])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [live?.messages.length])

  if (ui === 'rift' && pending && !showViewed) return <PendingMatchRoom />

  if (!live)
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Sub>{linkedId ? 'Loading match…' : 'No active match.'}</Sub>
        <Link to="/queue" className="text-gold-note hover:text-crystal-soft">
          Go to queue →
        </Link>
      </div>
    )

  const opp = live.opponent
  const info = GAMES[live.game]
  const host = live[live.host]
  const hostId = host.gameId ?? '(no ID set)'
  const canChat = live.status === 'active' || live.status === 'reported'
  const scoreLine = `${live.score.you}–${live.score.opponent}`

  const done = (then: string, requeue = false) => {
    closeMatch()
    navigate(then)
    if (requeue) startQueue()
  }

  return (
    <div className="flex flex-col gap-4">
      <VictoryReward match={live} />
      <ScoreBar match={live} />
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-3">
          <Card>
            <Sub>host</Sub>
            <b>{live.host === 'you' ? 'You' : host.displayName}</b>
            <Sub>
              {info.idLabel}: {hostId}
            </Sub>
            {host.gameId && (
              <Pill
                className="self-start"
                onClick={() => {
                  void navigator.clipboard?.writeText(host.gameId!)
                  setCopied(true)
                }}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </Pill>
            )}
          </Card>

          {matchError && <span className="text-xs text-chaos-soft">{matchError}</span>}

          {canChat && live.ruling?.outcome === 'replay' && live.replayDeadline && (
            <ReplayNotice match={live} deadline={live.replayDeadline} />
          )}

          {live.status === 'active' && (
            <ReportGame key={live.games.length} gameNo={live.games.length + 1} game={live.game} onReport={reportGame} />
          )}

          {live.status === 'reported' && live.reportedBy === 'you' && (
            <Card tone="gold">
              <Sub>waiting for confirmation</Sub>
              <b>
                You reported {scoreLine} · {live.winner === 'you' ? 'you win' : `${opp.displayName} wins`}
              </b>
              <Sub>{opp.displayName} needs to confirm or dispute.</Sub>
              <ConfirmCountdown deadline={live.confirmDeadline} />
            </Card>
          )}

          {live.status === 'reported' && live.reportedBy === 'opponent' && (
            <Card tone="gold">
              <Sub>confirm result</Sub>
              <b>
                {opp.displayName} says: {scoreLine} · {live.winner === 'you' ? 'you win' : 'they win'}
              </b>
              <ConfirmCountdown deadline={live.confirmDeadline} />
              {disputing ? (
                <DisputeForm
                  match={live}
                  onSubmit={(games, reason) => disputeResult(games, reason)}
                  onCancel={() => setDisputing(false)}
                />
              ) : (
                <div className="flex gap-2">
                  <Btn onClick={confirmResult}>Confirm</Btn>
                  <Pill onClick={() => setDisputing(true)}>Dispute</Pill>
                </div>
              )}
            </Card>
          )}

          {live.dispute && (
            // keyed so a new dispute after a Replay starts your side afresh
            <DisputePanel
              key={`${live.id}-${live.dispute.round}`}
              match={live}
              onSave={(text) => saveStatement(live.id, text)}
              onUpload={(file) => uploadScreenshot(live.id, file)}
            />
          )}

          {!canChat && <Finished match={live} onDone={() => done(`/${live.game}`)} onAgain={() => done('/queue', true)} />}

          {live.games.length > 0 && <GameList match={live} />}

          {/* keyed so the form starts empty (and closed) on another match */}
          <AskAdmin key={live.id} match={live} onAsk={(message) => askAdmin(live.id, message)} />

          {live.status === 'active' && (
            <button
              type="button"
              className="self-start text-xs text-muted hover:text-chaos-soft"
              onClick={() => {
                const warning = live.replayDeadline
                  ? 'Leave this Replay? It goes back to the Admins, who rule on it.'
                  : 'Leave this match? It will count as abandoned.'
                if (window.confirm(warning)) abandonMatch()
              }}
            >
              Leave match
            </button>
          )}
        </div>

        <Card className="min-h-[420px]">
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {live.messages.map((m) =>
              m.from === 'system' ? (
                <div key={m.id} className="text-center text-xs text-muted">
                  — {m.text} —
                </div>
              ) : (
                <div key={m.id} className={cx('flex items-start gap-2', m.from === 'you' && 'flex-row-reverse')}>
                  <Avatar
                    name={live[m.from].displayName}
                    src={live[m.from].avatarUrl}
                    ring={m.from === 'you' ? 'crystal' : 'chaos'}
                  />
                  <div
                    className={cx(
                      'max-w-[70%] rounded-lg border-[1.5px] px-2.5 py-1.5 text-sm',
                      m.from === 'you' ? 'border-crystal-line bg-crystal-bg' : 'border-chaos-line bg-chaos-bg',
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ),
            )}
            <div ref={chatEnd} />
          </div>
          {canChat && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {['gg', 'rematch?', 'lag', 'ready'].map((q) => (
                  <Pill key={q} onClick={() => sendChat(q)}>
                    {q}
                  </Pill>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendChat(text)
                  setText('')
                }}
              >
                <input
                  value={text}
                  maxLength={500}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`message ${opp.displayName}…`}
                  className={FIELD}
                />
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

/** Both sides with a glyph and name (you are Cosmos, your opponent Chaos), score as filled pips toward the win. */
function ScoreBar({ match }: { match: Match }) {
  const info = GAMES[match.game]
  const side = (who: Side) => {
    const p = match[who]
    const cosmos = who === 'you'
    const won = match.score[who]
    return (
      <div data-side={cosmos ? 'cosmos' : 'chaos'} className={cx('flex min-w-0 flex-1 items-center gap-3', !cosmos && 'flex-row-reverse text-right')}>
        <Avatar name={p.displayName} src={p.avatarUrl} size={40} ring={cosmos ? 'crystal' : 'chaos'} />
        <div className={cx('flex min-w-0 flex-col gap-1', !cosmos && 'items-end')}>
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-[var(--side)]">
            {cosmos && <SideGlyph side="cosmos" />}
            {cosmos ? 'COSMOS' : 'CHAOS'}
            {!cosmos && <SideGlyph side="chaos" />}
          </span>
          <span className="truncate font-semibold">{cosmos ? `${p.displayName} (you)` : p.displayName}</span>
          <span role="img" aria-label={`${won} of ${match.winsNeeded} games won`} className="flex gap-1">
            {Array.from({ length: match.winsNeeded }, (_, i) => (
              <span key={i} className={cx('h-2 w-6 rounded-sm border border-[var(--side)]', i < won && 'bg-[var(--side)]')} />
            ))}
          </span>
        </div>
      </div>
    )
  }
  return (
    <Card className="flex-row flex-wrap items-center gap-4 px-5 py-4">
      {side('you')}
      <div className="flex flex-col items-center px-2">
        <span className="font-display text-3xl font-bold tabular-nums">
          {match.score.you}–{match.score.opponent}
        </span>
        <Sub>
          {info.short} {match.mode} · Bo{match.bestOf} · {match.platform}
          {match.status === 'active' && ` · game ${match.games.length + 1}`}
        </Sub>
      </div>
      {side('opponent')}
    </Card>
  )
}

function Finished({ match, onDone, onAgain }: { match: Match; onDone: () => void; onAgain: () => void }) {
  const opp = match.opponent.displayName
  const [tone, title, note] =
    match.status === 'completed'
      ? match.winner === 'you'
        ? (['cosmos', `You won ${match.score.you}–${match.score.opponent}`, 'Result confirmed. Ratings are coming soon.'] as const)
        : (['chaos', `You lost ${match.score.you}–${match.score.opponent}`, 'Result confirmed. Ratings are coming soon.'] as const)
      : match.status === 'disputed'
        ? (['gold', 'Result disputed', 'An Admin will review this match.'] as const)
        : match.status === 'voided'
          ? (['gold', 'Match void', 'It counts for no one.'] as const)
        : match.status === 'abandoned'
          ? (['chaos', match.endedBy === 'you' ? 'You left the match' : `${opp} left the match`, 'The match was abandoned.'] as const)
          : (['gold', 'Match cancelled', 'Not everyone accepted in time.'] as const)
  const ruling = match.ruling
  return (
    <Card tone={tone}>
      <Sub>{match.status}</Sub>
      <b className={tone === 'cosmos' ? 'text-crystal-soft' : tone === 'chaos' ? 'text-chaos-soft' : undefined}>{title}</b>
      {ruling ? (
        <div role="region" aria-label="Ruling" className="flex flex-col gap-1">
          <Sub>{RULING_NOTES[ruling.outcome]}</Sub>
          <span className="whitespace-pre-wrap text-sm">
            Reason: <q>{ruling.reason}</q>
          </span>
        </div>
      ) : (
        <Sub>{note}</Sub>
      )}
      <div className="flex gap-2">
        <Btn onClick={onAgain}>Queue again</Btn>
        <Pill onClick={onDone}>Done</Pill>
      </div>
    </Card>
  )
}

function GameList({ match }: { match: Match }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {match.games.map((g) => (
        <div key={g.n} className="flex gap-2">
          <span className="text-muted">G{g.n}</span>
          <span className={g.winner === 'you' ? 'text-crystal-soft' : 'text-chaos-soft'}>
            {g.winner === 'you' ? 'you' : match.opponent.displayName}
          </span>
          {g.details.character && <span className="text-muted">· {g.details.character}</span>}
        </div>
      ))}
    </div>
  )
}

function ReportGame({
  gameNo,
  game,
  onReport,
}: {
  gameNo: number
  game: GameId
  onReport: (w: Side, details: GameDetails) => void
}) {
  const [character, setChar] = useState(CHARACTERS[game][0])
  const [helper, setHelper] = useState(HELPERS[game][0])
  const [stage, setStage] = useState(STAGES[game][0])
  const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))
  const details = { character, helper, stage }
  return (
    <Card tone="gold">
      <Sub>report per game</Sub>
      <b>Game {gameNo} winner?</b>
      <div className="flex flex-wrap gap-1.5">
        <Select label="Your character" value={character} onChange={setChar} options={opts(CHARACTERS[game])} />
        <Select label={GAMES[game].helperLabel} value={helper} onChange={setHelper} options={opts(HELPERS[game])} />
        <Select label="Stage" value={stage} onChange={setStage} options={opts(STAGES[game])} />
      </div>
      <div className="flex gap-2">
        <Btn onClick={() => onReport('you', details)}>Me</Btn>
        <Pill onClick={() => onReport('opponent', details)}>Them</Pill>
      </div>
    </Card>
  )
}

const MAX_STATEMENT = 2000

/** Time left until a reported result confirms itself. */
function ConfirmCountdown({ deadline }: { deadline: string | null }) {
  return (
    <Countdown deadline={deadline} running={(left) => `Confirms automatically in ${left}`} done="Confirming automatically…" />
  )
}

/** A Replay Ruling: the match is being played again from one game, until the Replay deadline. */
function ReplayNotice({ match, deadline }: { match: Match; deadline: string }) {
  return (
    <Card tone="gold" role="region" aria-label="Replay">
      <Sub>replay</Sub>
      <b className="text-sm">An Admin ruled that this match is replayed. Earlier games stand.</b>
      <span className="whitespace-pre-wrap text-sm">
        Reason: <q>{match.ruling!.reason}</q>
      </span>
      <Countdown
        deadline={deadline}
        running={(left) => `Back to the Admins in ${left} unless the match is settled`}
        done="Going back to the Admins…"
      />
    </Card>
  )
}

/** Time left until a deadline (H:MM:SS, ticking). */
function Countdown({ deadline, running, done }: { deadline: string | null; running: (left: string) => string; done: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!deadline) return null
  const left = Math.max(0, Math.floor((Date.parse(deadline) - now) / 1000))
  const h = Math.floor(left / 3600)
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return (
    <span className="text-xs text-muted" role="timer" aria-live="off">
      {left > 0 ? running(`${h}:${mm}:${ss}`) : done}
    </span>
  )
}

/** Which games you dispute, and why. Both are required. */
function DisputeForm({
  match,
  onSubmit,
  onCancel,
}: {
  match: Match
  onSubmit: (games: number[], reason: string) => void
  onCancel: () => void
}) {
  const [games, setGames] = useState<number[]>([])
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reasonId = useId()
  const errorId = useId()
  const toggle = (n: number) => setGames((gs) => (gs.includes(n) ? gs.filter((g) => g !== n) : [...gs, n].sort((x, y) => x - y)))

  return (
    <form
      aria-label="Dispute the result"
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!games.length) return setError('Tick the games you dispute.')
        if (!reason.trim()) return setError('Say why you are disputing.')
        setError(null)
        onSubmit(games, reason.trim())
      }}
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-muted">Which games do you dispute?</legend>
        {match.games.map((g) => (
          <label key={g.n} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={games.includes(g.n)} onChange={() => toggle(g.n)} />
            Game {g.n} · reported as {g.winner === 'you' ? 'your win' : `${match.opponent.displayName}'s win`}
          </label>
        ))}
      </fieldset>
      <label htmlFor={reasonId} className="text-xs text-muted">
        Why are you disputing?
      </label>
      <textarea
        id={reasonId}
        value={reason}
        maxLength={MAX_STATEMENT}
        rows={3}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What really happened in those games"
        className={FIELD}
      />
      {error && (
        <span id={errorId} role="alert" className="text-xs text-chaos-soft">
          {error}
        </span>
      )}
      <div className="flex gap-2">
        <Btn type="submit">Submit dispute</Btn>
        <Pill onClick={onCancel}>Cancel</Pill>
      </div>
    </form>
  )
}

/** The dispute as both players see it, with your statement editable until there's a Ruling. */
function DisputePanel({ match, onSave, onUpload }: { match: Match; onSave: (text: string) => void; onUpload: (file: File) => void }) {
  const d = match.dispute!
  const opp = match.opponent.displayName
  const mine = d.statements.you
  const theirs = d.statements.opponent
  const [draft, setDraft] = useState(mine?.text ?? '')
  const [editing, setEditing] = useState(!mine)
  const fieldId = useId()
  const open = match.status === 'disputed'
  const filer = d.by === 'you' ? 'You' : opp
  const replaying = !open && match.ruling?.outcome === 'replay'

  // A newly saved statement came back from the server: show it rather than the editor.
  const [seen, setSeen] = useState(mine?.updatedAt)
  if (mine && mine.updatedAt !== seen) {
    setSeen(mine.updatedAt)
    setDraft(mine.text)
    setEditing(false)
  }

  return (
    <Card tone="gold" role="region" aria-label="Dispute">
      <Sub>dispute</Sub>
      {replaying && <span className="text-sm text-muted">Read-only: this dispute led to a Replay.</span>}
      {d.reason === null ? (
        <span className="text-sm text-muted">No details (filed before the dispute form)</span>
      ) : (
        <>
          <b className="text-sm">Disputed games: {d.games.join(', ')}</b>
          <span className="text-sm">
            {filer} wrote: <q>{d.reason}</q>
          </span>
        </>
      )}

      <Sub>{opp}'s side</Sub>
      <span className="whitespace-pre-wrap text-sm">{theirs ? theirs.text : `${opp} has not added their side yet.`}</span>
      <ScreenshotList shots={d.screenshots.opponent} owner={opp} />

      <Sub>your side</Sub>
      {open && editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.trim()) onSave(draft.trim())
          }}
        >
          <label htmlFor={fieldId} className="sr-only">
            Your side
          </label>
          <textarea
            id={fieldId}
            value={draft}
            maxLength={MAX_STATEMENT}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What happened, for the Admin who reviews this"
            className={FIELD}
          />
          <div className="flex gap-2">
            <Btn type="submit" disabled={!draft.trim()}>
              Save your side
            </Btn>
            {mine && <Pill onClick={() => setEditing(false)}>Cancel</Pill>}
          </div>
        </form>
      ) : (
        <>
          <span className="whitespace-pre-wrap text-sm">{mine ? mine.text : 'You did not add your side.'}</span>
          {open && (
            <Pill className="self-start" onClick={() => setEditing(true)}>
              Edit your side
            </Pill>
          )}
        </>
      )}
      <ScreenshotList shots={d.screenshots.you} owner="you" />
      {open && <ScreenshotUpload count={d.screenshots.you.length} onUpload={onUpload} />}
    </Card>
  )
}
