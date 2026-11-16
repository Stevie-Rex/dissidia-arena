import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cx } from '../lib/format'

type Tone = 'default' | 'cosmos' | 'chaos' | 'gold' | 'dashed'

const toneClass: Record<Tone, string> = {
  default: 'border-line-strong bg-card',
  cosmos: 'border-crystal bg-crystal-deep',
  chaos: 'border-chaos bg-chaos-bg',
  gold: 'border-gold bg-card',
  dashed: 'border-dashed border-line-strong bg-card/60',
}

export function Card({ tone = 'default', className, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={cx('flex flex-col gap-2 rounded-lg border-[1.5px] p-3', toneClass[tone], className)} {...rest} />
}

export function Pill({
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'whitespace-nowrap rounded-full border-[1.5px] px-3 py-0.5 text-xs transition-colors',
        active
          ? 'border-crystal bg-crystal-bg text-crystal-soft'
          : 'border-line-strong text-fg-dim hover:border-crystal/60 hover:text-crystal-soft',
        rest.disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...rest}
    />
  )
}

export function Btn({ className, size = 'md', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'md' | 'lg' }) {
  return (
    <button
      type="button"
      className={cx(
        'whitespace-nowrap rounded-lg border-[1.5px] border-gold text-center font-medium text-gold-soft transition-colors hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' ? 'px-5 py-2.5 text-base' : 'px-3 py-1 text-sm',
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
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 ${size}px ${gold ? 'rgba(220,182,94,.5)' : 'rgba(124,200,230,.5)'}`,
      }}
    />
  )
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
  size = 24,
  ring = 'default',
  className,
}: {
  name?: string
  size?: number
  ring?: keyof typeof ringClass
  className?: string
}) {
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
      <h1 className="text-xl font-semibold">{children}</h1>
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
    <Link to="/" className="flex items-center gap-1.5 font-semibold tracking-wide">
      <Gem />
      DISSIDIA//COMP
    </Link>
  )
}

export function Modal({ children, onClose, className }: { children: ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className={cx('w-full max-w-sm rounded-xl border-[1.5px] border-muted bg-card p-5 shadow-[0_16px_40px_rgba(0,0,0,.65)]', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
