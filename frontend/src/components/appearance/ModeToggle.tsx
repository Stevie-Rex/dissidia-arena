import { cx } from '../../lib/format'
import { useAppearance } from '../../state/Appearance'
import { MoonGlyph, SunGlyph } from '../rift/crests'

/** Switches Rift between Chaos mode (dark, the default) and Cosmos mode (light). Free for everyone. */
export default function ModeToggle({ className }: { className?: string }) {
  const { prefs, save } = useAppearance()
  const cosmos = prefs.rift_mode === 'cosmos'
  return (
    <button
      type="button"
      className={cx('da-mode-toggle', className)}
      aria-label={cosmos ? 'Switch to Chaos mode' : 'Switch to Cosmos mode'}
      onClick={() => void save({ rift_mode: cosmos ? 'chaos' : 'cosmos' })}
    >
      {cosmos ? <MoonGlyph /> : <SunGlyph />}
      <span className="hidden lg:inline">{cosmos ? 'Chaos mode' : 'Cosmos mode'}</span>
    </button>
  )
}
