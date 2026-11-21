import { useAppearance } from '../../state/Appearance'
import { WORLDS } from '../../theme/appearance'

/** Six crystal swatches. Each swatch scopes its own data-world, so it shows that world's colours. */
export default function WorldsPicker() {
  const { prefs, save } = useAppearance()
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
      {WORLDS.map((w) => {
        const on = prefs.world === w.key
        return (
          <button
            key={w.key}
            type="button"
            aria-pressed={on}
            onClick={() => void save({ world: w.key })}
            className={
              'flex flex-col items-center gap-3.5 border bg-card px-3 pb-4 pt-5 text-fg transition-shadow ' +
              (on ? 'border-fg shadow-[0_0_0_1px_var(--ui-fg)]' : 'border-line hover:border-fg')
            }
          >
            <span
              data-world={w.key}
              aria-hidden
              className="flex h-[104px] w-[60px] [clip-path:polygon(50%_0,100%_20%,100%_80%,50%_100%,0_80%,0_20%)]"
            >
              <span className="flex flex-1 items-center justify-end bg-[var(--rift-cosmos-bg)]">
                <span className="h-10 w-2 bg-[var(--rift-cosmos-accent)]" />
              </span>
              <span className="flex flex-1 items-center bg-[var(--rift-chaos-bg)]">
                <span className="h-10 w-2 bg-[var(--rift-chaos-accent)]" />
              </span>
            </span>
            <span className="font-brand text-[22px] font-bold text-gold" aria-hidden>
              {w.numeral}
            </span>
            <span className="flex flex-col gap-0.5 text-center">
              <span className="font-heading text-base font-semibold">{w.name}</span>
              <span className="text-[13px] text-muted">{w.after ? `After ${w.after}` : 'Cosmos and Chaos'}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
