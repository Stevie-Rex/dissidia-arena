import { cx } from '../../lib/format'

/** The desktop help strip. Its text comes from useHelpText() in hints.tsx. */
export default function HelpStrip({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx('rift-helpstrip', className)} aria-hidden>
      <span className="rift-helpstrip__text">{text}</span>
    </div>
  )
}
