/*
 * Lab, round 3 (#70): the Admins tab's new sections for the Master. Reopen a settled match (#13) and
 * Start Season 1 for each game (#14). Prototypes for sign-off.
 */
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Btn, Sub } from '../components/ui'
import { GAMES, type GameId } from '../data/mock'
import { api, errorMessage, type Season, type SettledMatchInfo } from '../lib/api'
import { FIELD } from '../lib/format'
import { seasonEnds } from '../state/useSeasons'
import { ROW, ReasonAction } from './MasterPanel'

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Season 1 would end one calendar month from today, at 00:00 UTC. */
function wouldEnd(): Season {
  const d = new Date()
  const endsAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate() + 1)).toISOString()
  return { game: '012', number: 1, startedAt: d.toISOString(), endsAt }
}

const LADDERS: Record<GameId, string> = {
  '012': 'One Ladder: 012 on PPSSPP.',
  nt: 'One Season for both NT Ladders: PS4 and PC.',
}

/** The one-off Start Season 1 buttons, one per game. */
export function Seasons() {
  const [seasons, setSeasons] = useState<Record<GameId, Season | null> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  useEffect(() => {
    let current = true
    api.seasons().then(
      (r) => current && setSeasons(r.seasons),
      (e) => current && setError(errorMessage(e)),
    )
    return () => {
      current = false
    }
  }, [])

  return (
    <section aria-labelledby={`${id}-title`} className="da-card">
      <h2 id={`${id}-title`} className="m-0 text-base font-semibold">
        Seasons
      </h2>
      <p className="m-0 max-w-2xl text-sm text-muted">
        Starting Season 1 can't be undone. It runs for one calendar month and ends at 00:00 UTC. From then on, settled matches
        move Ratings. The bot announces it in the game's queue channel.
      </p>
      {error && (
        <p role="alert" className="m-0 text-sm text-chaos-soft">
          {error}
        </p>
      )}
      {seasons === null ? (
        !error && <Sub>Loading…</Sub>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {(['012', 'nt'] as GameId[]).map((g) => {
            const s = seasons[g]
            return (
              <li key={g} className={ROW}>
                <div className="flex flex-col">
                  <span className="font-semibold">{GAMES[g].name}</span>
                  <Sub>{LADDERS[g]}</Sub>
                  {s ? (
                    <span className="text-sm">
                      <b className="text-crystal-soft">Season {s.number} · live</b> · started {day(s.startedAt)} · ends {seasonEnds(s)}
                    </span>
                  ) : (
                    <span className="text-sm">
                      <b>Pre-season</b> · if started now, Season 1 ends {seasonEnds(wouldEnd())}
                    </span>
                  )}
                </div>
                {!s && (
                  <ReasonAction
                    open="Start Season 1"
                    label={`Why are you starting Season 1 for ${GAMES[g].short}?`}
                    confirm={`Start Season 1 for ${GAMES[g].short}`}
                    onConfirm={async (reason) => setSeasons((await api.startSeason(g, reason)).seasons)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function settledLine(m: SettledMatchInfo) {
  const when = m.settledAt ? day(m.settledAt) : ''
  switch (m.settledBy) {
    case 'confirmed':
      return `${m.winner} won · confirmed ${when}`
    case 'auto-confirmed':
      return `${m.winner} won · auto-confirmed ${when}`
    case 'forfeit':
      return `${m.winner} won by Forfeit · ${when}`
    case 'void':
      return `Voided by a Ruling · ${when}`
    case null:
      return m.status === 'disputed' ? 'Disputed, waiting for a Ruling' : 'Still being played'
    default:
      return `${m.winner} won · Ruling: ${m.settledBy[0].toUpperCase()}${m.settledBy.slice(1)}, ${when}`
  }
}

/** The Master looks a match up by number and reopens it, within 90 days of its last settlement. */
export function Reopen() {
  const [q, setQ] = useState('')
  const [match, setMatch] = useState<SettledMatchInfo | null>(null)
  const [expired, setExpired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  const find = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(q.trim().replace(/^#/, ''))
    if (!Number.isInteger(n) || n <= 0) return setError('Type a match number, such as 212.')
    try {
      const found = await api.findMatch(n)
      setMatch(found)
      setExpired(found.reopenUntil ? Date.parse(found.reopenUntil) < Date.now() : false)
      setError(null)
    } catch (err) {
      setMatch(null)
      setError(errorMessage(err))
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="da-card">
      <h2 id={`${id}-title`} className="m-0 text-base font-semibold">
        Reopen a settled match
      </h2>
      <p className="m-0 max-w-2xl text-sm text-muted">
        The only way to fix a wrong Ruling or a wrong auto-confirm. A reopened match goes back to Disputed for a fresh Ruling, and
        any ranked win from it is taken back. Unlocks stay. Up to 90 days after it was settled.
      </p>
      <form onSubmit={find} aria-label="Find a match to reopen" className="flex max-w-md items-end gap-2" noValidate>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`${id}-q`} className="text-sm font-semibold">
            Match number
          </label>
          <input id={`${id}-q`} inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} className={FIELD} />
        </div>
        <Btn type="submit" size="lg">
          Find
        </Btn>
      </form>
      {error && (
        <p role="alert" className="m-0 text-sm text-chaos-soft">
          {error}
        </p>
      )}
      {match && (
        <div role="region" aria-label={`Match #${match.id}`} className={ROW}>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">
              Match #{match.id} · {GAMES[match.game].short} {match.platform}
            </span>
            <span className="text-sm">
              {match.players[0]} {match.score[0]}–{match.score[1]} {match.players[1]}
            </span>
            <Sub>{settledLine(match)}</Sub>
            {match.reopened ? (
              <span className="text-sm">
                <b className="text-gold-soft">Reopened {day(match.reopened.at)}.</b> It's in the{' '}
                <Link to="/admin" className="underline">
                  Cases list
                </Link>{' '}
                for a fresh Ruling.
              </span>
            ) : !match.settledAt ? (
              <span className="text-sm">Only a settled match can be reopened.</span>
            ) : expired ? (
              <span className="text-sm">The 90 days to reopen it ended on {day(match.reopenUntil!)}.</span>
            ) : (
              <span className="text-sm">
                Can be reopened until {day(match.reopenUntil!)}.
                {match.winner && ` ${match.winner}'s ranked win is taken back.`} Both players are told in the match room and by DM.
              </span>
            )}
          </div>
          {match.settledAt && !match.reopened && !expired && (
            <ReasonAction
              key={match.id}
              open="Reopen"
              label={`Why are you reopening match #${match.id}?`}
              confirm={`Reopen match #${match.id}`}
              variant="chaos"
              onConfirm={async (reason) => setMatch(await api.reopenMatch(match.id, reason))}
            />
          )}
        </div>
      )}
    </section>
  )
}
