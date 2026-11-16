import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CHARACTERS, GAMES, HELPERS, STAGES, playerById } from '../data/mock'
import { useApp } from '../state/AppState'
import { Avatar, Btn, Card, Gem, Pill, Select, Sub } from '../components/ui'
import { cx } from '../lib/format'

/** 1p — match room: connect info + report on the left, opponent-only chat on the right. */
export default function MatchRoom() {
  const { live, sendChat, reportGame, confirmResult, leaveMatch, startQueue } = useApp()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [live?.chat.length])

  if (!live)
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Sub>No active match.</Sub>
        <Link to="/queue" className="text-gold-note hover:text-crystal-soft">
          Go to queue →
        </Link>
      </div>
    )

  const opp = playerById(live.opponentId)!
  const info = GAMES[live.settings.game]
  const hostId = opp.ids[live.settings.game] ?? opp.discord
  const need = Math.ceil(live.settings.bestOf / 2)
  const mine = live.reports.filter((r) => r === 'me').length
  const theirs = live.reports.filter((r) => r === 'them').length
  const finished = mine >= need || theirs >= need

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Avatar name="You" ring="crystal" />
          <Gem />
          <Avatar name={opp.name} ring="chaos" />
          <b>
            vs <span className="text-chaos-soft">{opp.name}</span>
          </b>
        </div>
        <Sub>
          {info.short} {live.settings.mode} · Bo{live.settings.bestOf} · game {live.gameNo} ·{' '}
          <span className="text-fg">
            {mine}–{theirs}
          </span>
        </Sub>

        <Card>
          <Sub>host</Sub>
          <b>{opp.name}</b>
          <Sub>
            {info.idLabel}: {hostId}
          </Sub>
          <Pill
            className="self-start"
            onClick={() => {
              void navigator.clipboard?.writeText(hostId)
              setCopied(true)
            }}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </Pill>
        </Card>

        {!finished && <ReportGame gameNo={live.gameNo} game={live.settings.game} onReport={reportGame} />}

        {finished && !live.confirmed && (
          <Card tone="gold">
            <Sub>confirm result</Sub>
            <b>
              {opp.name} says: {mine}–{theirs} {mine > theirs ? 'you' : 'them'}
            </b>
            <div className="flex gap-2">
              <Btn onClick={confirmResult}>Confirm</Btn>
              <Pill>Dispute</Pill>
            </div>
          </Card>
        )}

        {live.confirmed && live.ratingAfter !== undefined && (
          <Card tone={live.ratingAfter > live.ratingBefore ? 'cosmos' : 'chaos'}>
            <Sub>posted</Sub>
            <b className={live.ratingAfter > live.ratingBefore ? 'text-crystal-soft' : 'text-chaos-soft'}>
              {live.ratingBefore} → {live.ratingAfter}
            </b>
            <Sub>result card posted in #results</Sub>
            <div className="flex gap-2">
              <Btn
                onClick={() => {
                  leaveMatch()
                  navigate('/queue')
                  startQueue()
                }}
              >
                Queue again
              </Btn>
              <Pill
                onClick={() => {
                  leaveMatch()
                  navigate(`/${live.settings.game}`)
                }}
              >
                Done
              </Pill>
            </div>
          </Card>
        )}

        {!finished && <Sub>no-show? claim after 10:00</Sub>}
      </div>

      <Card className="min-h-[420px]">
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {live.chat.map((m, i) =>
            m.from === 'system' ? (
              <div key={i} className="text-center text-xs text-muted">
                — {m.text} —
              </div>
            ) : (
              <div key={i} className={cx('flex items-start gap-2', m.from === 'me' && 'flex-row-reverse')}>
                <Avatar name={m.from === 'me' ? 'You' : opp.name} ring={m.from === 'me' ? 'crystal' : 'chaos'} />
                <div
                  className={cx(
                    'max-w-[70%] rounded-lg border-[1.5px] px-2.5 py-1.5 text-sm',
                    m.from === 'me' ? 'border-crystal-line bg-crystal-bg' : 'border-chaos-line bg-chaos-bg',
                  )}
                >
                  {m.text}
                </div>
              </div>
            ),
          )}
          <div ref={chatEnd} />
        </div>
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
            onChange={(e) => setText(e.target.value)}
            placeholder={`message ${opp.name}…`}
            className="w-full rounded-md border-[1.5px] border-line-strong bg-panel px-3 py-2 text-sm placeholder:text-muted focus:border-crystal focus:outline-none"
          />
        </form>
      </Card>
    </div>
  )
}

function ReportGame({ gameNo, game, onReport }: { gameNo: number; game: '012' | 'nt'; onReport: (w: 'me' | 'them') => void }) {
  const [char, setChar] = useState(CHARACTERS[game][0])
  const [helper, setHelper] = useState(HELPERS[game][0])
  const [stage, setStage] = useState(STAGES[game][0])
  const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))
  return (
    <Card tone="gold">
      <Sub>report per game</Sub>
      <b>Game {gameNo} winner?</b>
      <div className="flex flex-wrap gap-1.5">
        <Select label="Your character" value={char} onChange={setChar} options={opts(CHARACTERS[game])} />
        <Select label={GAMES[game].helperLabel} value={helper} onChange={setHelper} options={opts(HELPERS[game])} />
        <Select label="Stage" value={stage} onChange={setStage} options={opts(STAGES[game])} />
      </div>
      <div className="flex gap-2">
        <Btn onClick={() => onReport('me')}>Me</Btn>
        <Pill onClick={() => onReport('them')}>Them</Pill>
      </div>
    </Card>
  )
}
