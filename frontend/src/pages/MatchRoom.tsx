import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CHARACTERS, GAMES, HELPERS, STAGES, type GameId } from '../data/mock'
import { useApp } from '../state/AppState'
import type { GameDetails, Match, Side } from '../lib/api'
import { Avatar, Btn, Card, Pill, Select, SideGlyph, Sub } from '../components/ui'
import VictoryReward from '../components/appearance/VictoryReward'
import { cx } from '../lib/format'

/** 1p — match room: connect info + report on the left, opponent-only chat on the right. */
export default function MatchRoom() {
  const { live, matchError, sendChat, reportGame, confirmResult, disputeResult, abandonMatch, closeMatch, startQueue } =
    useApp()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [live?.messages.length])

  if (!live)
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Sub>No active match.</Sub>
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
            </Card>
          )}

          {live.status === 'reported' && live.reportedBy === 'opponent' && (
            <Card tone="gold">
              <Sub>confirm result</Sub>
              <b>
                {opp.displayName} says: {scoreLine} · {live.winner === 'you' ? 'you win' : 'they win'}
              </b>
              <div className="flex gap-2">
                <Btn onClick={confirmResult}>Confirm</Btn>
                <Pill onClick={disputeResult}>Dispute</Pill>
              </div>
            </Card>
          )}

          {!canChat && <Finished match={live} onDone={() => done(`/${live.game}`)} onAgain={() => done('/queue', true)} />}

          {live.games.length > 0 && <GameList match={live} />}

          {live.status === 'active' && (
            <button
              type="button"
              className="self-start text-xs text-muted hover:text-chaos-soft"
              onClick={() => {
                if (window.confirm('Leave this match? It will count as abandoned.')) abandonMatch()
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
                  className="w-full rounded-md border-[1.5px] border-line-strong bg-panel px-3 py-2 text-sm placeholder:text-muted focus:border-crystal focus:outline-none"
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
        <span className="font-brand text-3xl font-bold tabular-nums">
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
        ? (['gold', 'Result disputed', 'A moderator will review this match.'] as const)
        : match.status === 'abandoned'
          ? (['chaos', match.endedBy === 'you' ? 'You left the match' : `${opp} left the match`, 'The match was abandoned.'] as const)
          : (['gold', 'Match cancelled', 'Not everyone accepted in time.'] as const)
  return (
    <Card tone={tone}>
      <Sub>{match.status}</Sub>
      <b className={tone === 'cosmos' ? 'text-crystal-soft' : tone === 'chaos' ? 'text-chaos-soft' : undefined}>{title}</b>
      <Sub>{note}</Sub>
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
