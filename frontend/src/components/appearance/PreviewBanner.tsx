import { useAppearance } from '../../state/Appearance'

/** Above the Classic header while a locked player previews it. Saves nothing. */
export default function PreviewBanner() {
  const { previewing, endPreview, appearance } = useAppearance()
  if (!previewing) return null
  const goal = appearance.rewards.find((r) => r.key === 'classic_interface')?.goal ?? 10
  const need = Math.max(0, goal - appearance.ranked_wins)
  return (
    <div role="status" className="da-window da-preview-banner flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <span>
        <span className="text-[var(--win-cursor)]">PREVIEW</span>&nbsp; Win {need} more ranked {need === 1 ? 'battle' : 'battles'} to keep
        the Classic interface.
      </span>
      <button type="button" onClick={endPreview} className="da-btn min-h-11 px-4 py-2">
        Back to Rift
      </button>
    </div>
  )
}
