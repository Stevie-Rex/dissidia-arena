import { GAMES, type GameId } from '../data/mock'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** A text input or textarea. */
export const FIELD =
  'w-full rounded-md border-[1.5px] border-line-strong bg-panel px-3 py-2 text-sm placeholder:text-muted focus:border-crystal focus:outline-none'

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** How long ago, roughly: minutes, then hours, then days. */
export const since = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return mins < 60 ? `${mins} min` : mins < 48 * 60 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`
}

/** One line for a search or a match: "012 · 1v1 Bo3 · EU". `where` is the region or the platform. */
export const queueSummary = ({ game, mode, bestOf }: { game: GameId; mode: string; bestOf: number }, where: string) =>
  `${GAMES[game].short} · ${mode} Bo${bestOf} · ${where}`
