/*
 * Dissidia 012 menu patterns, redrawn for the dark theme (reference for feel only; no art copied):
 * slanted title tabs, stacked bars with a silver top edge, a selection-blue row with a crystal-shard cursor,
 * ◀ value ▶ pickers, and hint text for the desktop help strip.
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cx } from '../lib/format'
import { ShardCursor } from './crests'
import { hinted } from './hints'

/* ---------- hints ---------- */

export function HelpStrip({ text }: { text: string }) {
  return (
    <div className="lab-helpstrip" aria-hidden>
      <span className="lab-helpstrip__text">{text}</span>
    </div>
  )
}

/* ---------- panel title tab ---------- */

export function TabTitle({ children, as: Tag = 'h2' }: { children: ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <Tag className="lab-tabtitle">
      <span>{children}</span>
    </Tag>
  )
}

/* ---------- stacked menu bars ---------- */

export type MenuItem = {
  key: string
  label: string
  hint: string
  icon?: ReactNode
  badge?: string
  children?: MenuItem[]
}

/**
 * Stacked bars. The selection follows the pointer and keyboard focus, like the 012 menus. When the pointer
 * leaves, it returns to the current page (marked with aria-current and a gold edge).
 */
export function MenuBars({
  label,
  items,
  current,
  onPick,
  compact,
}: {
  label: string
  items: MenuItem[]
  current?: string
  onPick?: (key: string) => void
  compact?: boolean
}) {
  const [hover, setHover] = useState<string | null>(null)
  // Navigation (onPick) shows no selection when no page of its own is open; a plain menu starts on its first item.
  const sel = hover ?? current ?? (onPick ? null : items[0].key)
  const bar = (item: MenuItem, sub: boolean) => {
    const h = hinted(`${label}-${item.key}`, item.hint)
    const selected = sel === item.key
    return (
      <li key={item.key}>
        <button
          type="button"
          className={cx('lab-bar-item', sub && 'lab-bar-item--sub', selected && 'is-selected', current === item.key && 'is-current')}
          aria-current={current === item.key ? 'page' : undefined}
          onMouseEnter={() => setHover(item.key)}
          onFocus={() => setHover(item.key)}
          onClick={() => onPick?.(item.key)}
          {...h.props}
        >
          <span className="lab-bar-item__cursor">{selected && <ShardCursor size={compact ? 18 : 22} />}</span>
          {item.icon && <span className="lab-bar-item__icon">{item.icon}</span>}
          <span>{item.label}</span>
          {item.badge && <span className="lab-bar-item__badge">{item.badge}</span>}
          {h.node}
        </button>
        {item.children && <ul className="lab-bars lab-bars--sub">{item.children.map((c) => bar(c, true))}</ul>}
      </li>
    )
  }
  return (
    <nav aria-label={label} className={cx(compact && 'lab-bars--compact')} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)}>
      <ul className="lab-bars">{items.map((i) => bar(i, false))}</ul>
    </nav>
  )
}

/* ---------- ◀ value ▶ pickers ---------- */

export type PickerSpec = { key: string; label: string; options: string[]; hint: string }

/**
 * A ◀ value ▶ picker for a short list (about 8 options or fewer). The value is a spinbutton, so the left and
 * right (or up and down) arrow keys change it, and Home and End jump to the ends. It wraps round, like 012.
 */
export function Picker({
  spec,
  value,
  onChange,
  selected,
  onSelect,
}: {
  spec: PickerSpec
  value: number
  onChange: (i: number) => void
  selected: boolean
  onSelect: () => void
}) {
  const n = spec.options.length
  const step = (d: number) => onChange((value + d + n) % n)
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowDown: () => step(-1),
      ArrowRight: () => step(1),
      ArrowUp: () => step(1),
      Home: () => onChange(0),
      End: () => onChange(n - 1),
    }
    const act = map[e.key]
    if (act) {
      e.preventDefault()
      act()
    }
  }
  const labelId = `picker-${spec.key}-label`
  const h = hinted(`picker-${spec.key}`, spec.hint)
  return (
    <div className={cx('lab-picker', selected && 'is-selected')} onMouseEnter={onSelect}>
      <span className="lab-bar-item__cursor">{selected && <ShardCursor />}</span>
      <span className="lab-picker__label" id={labelId}>
        {spec.label}
      </span>
      <button type="button" className="lab-picker__arrow" tabIndex={-1} aria-hidden onClick={() => step(-1)}>
        ◀
      </button>
      <span
        className="lab-picker__value"
        role="spinbutton"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={value + 1}
        aria-valuetext={spec.options[value]}
        onKeyDown={onKey}
        onFocus={onSelect}
        {...h.props}
      >
        {spec.options[value]}
        {h.node}
      </span>
      <button type="button" className="lab-picker__arrow" tabIndex={-1} aria-hidden onClick={() => step(1)}>
        ▶
      </button>
      <span className="lab-picker__count">
        {value + 1} / {n}
      </span>
    </div>
  )
}

/** A panel of pickers sharing one selection. */
export function PickerList({
  specs,
  values,
  onChange,
}: {
  specs: PickerSpec[]
  values: Record<string, number>
  onChange: (key: string, i: number) => void
}) {
  const [sel, setSel] = useState(specs[0].key)
  return (
    <div className="lab-pickers">
      {specs.map((s) => (
        <Picker
          key={s.key}
          spec={s}
          value={values[s.key] ?? 0}
          onChange={(i) => onChange(s.key, i)}
          selected={sel === s.key}
          onSelect={() => setSel(s.key)}
        />
      ))}
    </div>
  )
}
