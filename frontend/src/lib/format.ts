export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** A text input or textarea. */
export const FIELD =
  'w-full rounded-md border-[1.5px] border-line-strong bg-panel px-3 py-2 text-sm placeholder:text-muted focus:border-crystal focus:outline-none'

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
