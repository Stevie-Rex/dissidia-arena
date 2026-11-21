import type { ReactNode } from 'react'
import { cx } from '../../lib/format'
import type { MenuFont, WindowTheme } from '../../theme/appearance'

/** The cursor for the current Config choice: CSS shows the glove or the arrow from data-cursor. */
export function MenuCursor() {
  return (
    <>
      <span className="da-cursor-glove" aria-hidden />
      <span className="da-cursor-arrow" aria-hidden />
    </>
  )
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.5" role="img" aria-label="Locked" className={className}>
      <rect x="1" y="6" width="10" height="7" rx="1" />
      <path d="M3 6V4a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

/** Progress toward a goal, announced as "N of goal ranked wins". */
export function Progress({ done, goal, label, className }: { done: number; goal: number; label?: string; className?: string }) {
  const pct = Math.min(100, Math.round((done / goal) * 100))
  return (
    <div role="img" aria-label={label ?? `${Math.min(done, goal)} of ${goal} ranked wins`} className={cx('da-progress', className)}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

/** A mini menu window in a given window theme (and font), for previews and swatches. */
export function WindowSwatch({
  window,
  font,
  children,
  className,
}: {
  window: WindowTheme
  font?: MenuFont
  children?: ReactNode
  className?: string
}) {
  const win = (
    <div data-window={window} className={cx('da-window flex items-center justify-center', className)}>
      {children}
    </div>
  )
  return font && font !== 'auto' ? <div data-menu-font={font}>{win}</div> : win
}
