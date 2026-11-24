import { useId, useState } from 'react'
import { MAX_SCREENSHOT_MB, MAX_SCREENSHOTS, SCREENSHOT_TYPES, type Screenshot } from '../lib/api'

/** One player's screenshots as thumbnails that open full size. Deleted ones show a placeholder. */
export function ScreenshotList({ shots, owner, currentRound }: { shots: Screenshot[]; owner: string; currentRound?: number }) {
  if (shots.length === 0) return <span className="text-sm text-muted">No screenshots.</span>
  return (
    <ul className="flex flex-wrap gap-3">
      {shots.map((s, i) => (
        <li key={s.id} className="flex flex-col gap-1">
          {s.url ? (
            <a href={s.url} target="_blank" rel="noreferrer">
              <img
                src={s.url}
                alt={`Screenshot ${i + 1} from ${owner}`}
                loading="lazy"
                className="h-24 w-auto max-w-44 rounded border border-line object-cover"
              />
            </a>
          ) : (
            <span className="text-sm text-muted">Screenshot removed after 90 days</span>
          )}
          {currentRound !== undefined && s.round < currentRound && <span className="text-xs text-muted">Earlier dispute</span>}
        </li>
      ))}
    </ul>
  )
}

/** Picks a file and hands it over. Checks the size here too, so a huge file isn't sent just to be refused. */
export function ScreenshotUpload({ count, onUpload }: { count: number; onUpload: (file: File) => void }) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  if (count >= MAX_SCREENSHOTS) {
    return <span className="text-sm text-muted">You have added all {MAX_SCREENSHOTS} screenshots.</span>
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm">
        Add a screenshot ({count} of {MAX_SCREENSHOTS})
      </label>
      <input
        id={id}
        type="file"
        accept={SCREENSHOT_TYPES}
        className="text-sm text-muted file:mr-2 file:rounded file:border file:border-line file:bg-transparent file:px-2 file:py-1 file:text-sm file:text-fg"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // so choosing the same file again still fires
          if (!file) return
          if (file.size > MAX_SCREENSHOT_MB * 1024 * 1024) {
            return setError(`Each screenshot can be up to ${MAX_SCREENSHOT_MB} MB.`)
          }
          setError(null)
          onUpload(file)
        }}
      />
      <span className="text-xs text-muted">PNG, JPEG or WebP, up to {MAX_SCREENSHOT_MB} MB each.</span>
      {error && (
        <span role="alert" className="text-xs text-chaos-soft">
          {error}
        </span>
      )}
    </div>
  )
}
