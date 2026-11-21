import { cx } from '../../lib/format'
import { useAppearance } from '../../state/Appearance'
import { LockIcon } from './parts'

/**
 * Rift / Classic toggle on every page. A locked Classic opens the lock panel instead of switching;
 * the server still checks the unlock when the choice is saved.
 */
export default function InterfaceSwitcher({ className }: { className?: string }) {
  const { ui, isUnlocked, save, lockPanel, openLock, closeLock, previewing, endPreview } = useAppearance()
  const locked = !isUnlocked('classic_interface')
  const lockOpen = lockPanel?.key === 'classic_interface'

  const chooseRift = () => {
    closeLock()
    if (previewing) endPreview()
    else if (ui !== 'rift') void save({ interface: 'rift' })
  }
  const chooseClassic = () => {
    if (!locked) {
      void save({ interface: 'classic' })
      return
    }
    if (lockOpen) closeLock()
    else openLock('classic_interface')
  }

  return (
    <div className={cx('da-switch flex items-center gap-3', className)}>
      <span className="da-switch__label hidden text-xs font-semibold tracking-[0.14em] lg:inline">INTERFACE</span>
      <div role="group" aria-label="Interface" className="da-switch__group flex">
        <button type="button" aria-pressed={ui === 'rift'} onClick={chooseRift} className="da-switch__btn">
          RIFT
        </button>
        <button
          type="button"
          aria-pressed={ui === 'classic'}
          aria-expanded={locked ? lockOpen : undefined}
          aria-controls={locked ? 'classic-lock-panel' : undefined}
          onClick={chooseClassic}
          className="da-switch__btn flex items-center gap-2"
        >
          {locked && <LockIcon />}
          CLASSIC
        </button>
      </div>
    </div>
  )
}
