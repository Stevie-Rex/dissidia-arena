export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
