import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cx } from '../lib/format'

type Tone = 'default' | 'cosmos' | 'chaos' | 'gold' | 'dashed'

/** A panel: a bordered card in Rift, a menu window in Classic (styles in index.css). */
export function Card({ tone = 'default', className, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={cx('da-card', tone !== 'default' && `da-card--${tone}`, className)} {...rest} />
}

export function Pill({
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active === undefined ? undefined : active}
      className={cx('da-pill rounded-full transition-colors', className)}
      {...rest}
    />
  )
}

/** `main` marks the one action on a screen that gets the player into a game: the Cosmos blue key in Cosmos mode. */
export function Btn({
  className,
  size = 'md',
  variant = 'primary',
  main,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'md' | 'lg'; variant?: 'primary' | 'chaos' | 'ghost'; main?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'da-btn transition-colors',
        variant !== 'primary' && `da-btn--${variant}`,
        main && 'da-btn--main',
        size === 'lg' ? 'min-h-11 px-6 py-3 text-sm' : 'px-3 py-1 text-xs',
        className,
      )}
      {...rest}
    />
  )
}

export function DiscordButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-fg-dim px-4 py-2 font-medium text-fg transition-colors hover:bg-white/5',
        className,
      )}
      {...rest}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.5 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a12.9 12.9 0 0 1-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
      </svg>
      Continue with Discord
    </button>
  )
}

/** Crystal diamond mark */
export function Gem({ size = 9, gold, className }: { size?: number; gold?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block flex-none rotate-45 border-[1.5px]', gold ? 'border-gold bg-gold/15' : 'border-crystal bg-crystal-bg', className)}
      style={{ width: size, height: size }}
    />
  )
}

/** The Rift crystal mark (gold outline hexagon). */
export function CrystalMark({ className }: { className?: string }) {
  return (
    <svg width="18" height="32" viewBox="0 0 18 32" fill="none" strokeWidth="1.3" aria-hidden className={className}>
      <path d="M9 1 L17 7 L17 25 L9 31 L1 25 L1 7 Z" style={{ stroke: 'var(--ui-gold)' }} />
      <path d="M9 1 L9 31 M1 7 L9 12 L17 7" style={{ stroke: 'var(--ui-gold)' }} />
    </svg>
  )
}

/** Side glyph (sun for Cosmos, cracked diamond for Chaos), drawn in the current colour. */
export function SideGlyph({ side, className }: { side: 'cosmos' | 'chaos'; className?: string }) {
  return <span aria-hidden className={cx('da-glyph', `da-glyph--${side}`, className)} />
}

const ringClass = {
  default: 'border-subtle',
  you: 'border-gold',
  crystal: 'border-crystal',
  chaos: 'border-chaos',
  violet: 'border-violet',
} as const

export function Avatar({
  name,
  src,
  size = 24,
  ring = 'default',
  className,
}: {
  name?: string
  src?: string
  size?: number
  ring?: keyof typeof ringClass
  className?: string
}) {
  if (src)
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={cx('inline-block flex-none rounded-full border-[1.5px] bg-raised object-cover', ringClass[ring], className)}
        style={{ width: size, height: size }}
      />
    )
  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : ''
  return (
    <span
      className={cx(
        'inline-flex flex-none items-center justify-center rounded-full border-[1.5px] bg-raised font-semibold text-soft',
        ringClass[ring],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.36) }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

/** Hatched placeholder for art we don't have yet (portraits, banners, icons). */
export function Art({ label, className, style }: { label?: string; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cx(
        'placeholder-art flex items-center justify-center rounded-md border-[1.5px] border-dashed border-line-strong p-1 text-center font-mono text-[10px] text-muted',
        className,
      )}
      style={style}
    >
      {label}
    </div>
  )
}

export function CharIcon({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <Art
      label={name.slice(0, 2)}
      className="uppercase"
      style={{ width: size, height: size }}
    />
  )
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <Card className={cx('flex-1 gap-0.5', className)}>
      <span className="text-xs text-muted">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </Card>
  )
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('font-note text-sm text-gold-note', className)}>{children}</p>
}

export function Sub({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('text-xs text-muted', className)}>{children}</span>
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-2xl font-semibold">{children}</h1>
      <span className="flex-1" />
      {right}
    </div>
  )
}

export function Select({
  value,
  options,
  onChange,
  label,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  label: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border-[1.5px] border-line-strong bg-card px-3 py-0.5 text-xs text-fg-dim focus:border-crystal focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function TextLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx('text-xs text-gold-note hover:text-crystal-soft', className)}>
      {children}
    </Link>
  )
}

export function Logo() {
  return (
    <Link to="/" className="flex min-h-11 items-center gap-3">
      <CrystalMark />
      <span className="font-display text-xl font-bold">Dissidia Arena</span>
    </Link>
  )
}

export function Modal({ children, onClose, className }: { children: ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className={cx('da-card w-full max-w-sm p-5 shadow-2xl', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
