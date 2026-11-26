import { Link } from 'react-router-dom'
import { GAMES, type GameId } from '../data/mock'
import { useApp } from '../state/AppState'
import { Note, Pill, Sub } from '../components/ui'
import { cx, fmtTime } from '../lib/format'

function Group<T extends string | number>({
  items,
  value,
  set,
  fmt,
  disabled,
  unavailable = [],
}: {
  items: T[]
  value: T
  set: (v: T) => void
  fmt?: (v: T) => string
  disabled?: boolean
  unavailable?: T[]
}) {
  return (
    <div className="flex gap-1.5">
      {items.map((it) => (
        <Pill key={String(it)} active={value === it} disabled={disabled || unavailable.includes(it)} onClick={() => set(it)}>
          {fmt ? fmt(it) : String(it)}
          {unavailable.includes(it) && ' · soon'}
        </Pill>
      ))}
    </div>
  )
}

/** 1j — single queue page: settings + big button. Searching continues in the queue bar if you leave. */
export default function Queue() {
  const { queue, setQueue, phase, elapsed, startQueue, cancelQueue, region, searching: counts, queueError } = useApp()
  const info = GAMES[queue.game]
  const searching = phase === 'searching'

  if (phase === 'match')
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Sub>You're already in a match.</Sub>
        <Link to="/match/live" className="text-gold-note hover:text-crystal-soft">
          Back to match room →
        </Link>
      </div>
    )

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Queue · {info.name}</h1>
        <span className="flex-1" />
        <Sub>
          {counts[queue.game]} searching in {region}
        </Sub>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Group disabled={searching} items={['012', 'nt'] as GameId[]} value={queue.game} set={(g) => setQueue({ game: g })} fmt={(g) => GAMES[g].short} />
        <span className="text-muted">·</span>
        <Group
          disabled={searching}
          items={info.modes}
          value={queue.mode}
          set={(m) => setQueue({ mode: m })}
          unavailable={['3v3']}
        />
        <span className="text-muted">·</span>
        <Group disabled={searching} items={info.bestOf} value={queue.bestOf} set={(b) => setQueue({ bestOf: b })} fmt={(b) => `Bo${b}`} />
        {info.platforms.length > 1 && (
          <>
            <span className="text-muted">·</span>
            <Group disabled={searching} items={info.platforms} value={queue.platform} set={(p) => setQueue({ platform: p })} />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={searching ? cancelQueue : startQueue}
        className={cx(
          'my-4 flex h-44 w-44 flex-col items-center justify-center gap-1 rounded-full border-2 border-gold outline-1 outline-offset-[6px] outline-dashed outline-crystal transition-shadow',
          'shadow-[0_0_28px_color-mix(in_srgb,var(--ui-gold)_28%,transparent)] hover:shadow-[0_0_40px_color-mix(in_srgb,var(--ui-gold)_45%,transparent)]',
        )}
      >
        {searching ? (
          <>
            <span className="font-heading text-2xl tabular-nums">{fmtTime(elapsed)}</span>
            <Sub>searching · click to cancel</Sub>
          </>
        ) : (
          <>
            <span className="text-lg font-semibold">Find match</span>
            <Sub>{queue.platform}</Sub>
          </>
        )}
      </button>

      {queueError && (
        <span className="text-sm text-chaos-soft">
          {queueError.message}
          {(queueError.code === 'game_id_required' || queueError.code === 'not_onboarded') && (
            <>
              {' '}
              <Link to={queueError.code === 'not_onboarded' ? '/welcome' : '/players/me/edit'} className="text-gold-note hover:text-crystal-soft">
                {queueError.code === 'not_onboarded' ? 'Finish setup →' : 'Add it to your profile →'}
              </Link>
            </>
          )}
        </span>
      )}
      {queue.mode === '3v3' && <Sub>3v3 and party queue are coming soon. Pick 1v1 to play now.</Sub>}
      <Note>While you search, a timer and cancel button stay on screen, so you can leave this page</Note>
    </div>
  )
}
