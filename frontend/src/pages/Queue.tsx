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
}: {
  items: T[]
  value: T
  set: (v: T) => void
  fmt?: (v: T) => string
  disabled?: boolean
}) {
  return (
    <div className="flex gap-1.5">
      {items.map((it) => (
        <Pill key={String(it)} active={value === it} disabled={disabled} onClick={() => set(it)}>
          {fmt ? fmt(it) : String(it)}
        </Pill>
      ))}
    </div>
  )
}

/** 1j — single queue page: settings + big button. Searching continues in the queue bar if you leave. */
export default function Queue() {
  const { queue, setQueue, phase, elapsed, startQueue, cancelQueue, region, live, party } = useApp()
  const info = GAMES[queue.game]
  const searching = phase === 'searching'

  if (live)
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
          {info.searching} searching in {region}
        </Sub>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Group disabled={searching} items={['012', 'nt'] as GameId[]} value={queue.game} set={(g) => setQueue({ game: g })} fmt={(g) => GAMES[g].short} />
        <span className="text-muted">·</span>
        <Group disabled={searching} items={info.modes} value={queue.mode} set={(m) => setQueue({ mode: m })} />
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
          'shadow-[0_0_28px_rgba(220,182,94,.28)] hover:shadow-[0_0_40px_rgba(220,182,94,.45)]',
        )}
      >
        {searching ? (
          <>
            <span className="font-mono text-2xl">{fmtTime(elapsed)}</span>
            <Sub>searching · click to cancel</Sub>
          </>
        ) : (
          <>
            <span className="text-lg font-semibold">Find match</span>
            <Sub>~1:30 est.</Sub>
          </>
        )}
      </button>

      {queue.mode === '3v3' && (
        <Sub>
          3v3: queue solo or{' '}
          <Link to="/party" className="text-gold-note hover:text-crystal-soft">
            invite 2 friends as a party
          </Link>{' '}
          ({party.length}/3 in party)
        </Sub>
      )}
      <Note>While you search, a timer and cancel button stay on screen, so you can leave this page</Note>
    </div>
  )
}
