/*
 * Rift's 012 panel patterns (#50), ported from lab round 1: the slanted title tab, the tabbed panel and the
 * ◀ value ▶ pickers for short option lists (about 8 options or fewer).
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cx } from '../../lib/format'
import { useAppearance } from '../../state/Appearance'
import { Card } from '../ui'
import { ShardCursor } from './crests'
import { hinted } from './hints'

/** A panel header: a slanted, bevelled tab in the display face (a dark name plate in Cosmos mode). */
export function TabTitle({ children, as: Tag = 'h2', id }: { children: ReactNode; as?: 'h2' | 'h3'; id?: string }) {
  return (
    <Tag className="rift-tabtitle" id={id}>
      <span>{children}</span>
    </Tag>
  )
}

/** A plain Rift panel with its title tab pinned to the top-left corner. */
export function Panel({ title, children, className, as }: { title: ReactNode; children: ReactNode; className?: string; as?: 'h2' | 'h3' }) {
  const { ui } = useAppearance()
  if (ui === 'classic') return <Card className={className}><b>{title}</b>{children}</Card>
  return (
    <section className={cx('rift-panel', className)}>
      <TabTitle as={as}>{title}</TabTitle>
      {children}
    </section>
  )
}

export type PickerOption<T extends string> = { value: T; label: string }
export type PickerSpec<T extends string = string> = {
  key: string
  label: string
  hint: string
  options: PickerOption<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * One ◀ value ▶ row. The value is a spinbutton: Left/Down and Right/Up step it, Home and End jump to the ends, and
 * it wraps round, like 012. The arrows step it with the pointer.
 */
function Picker<T extends string>({ spec, selected, onSelect }: { spec: PickerSpec<T>; selected: boolean; onSelect: () => void }) {
  const n = spec.options.length
  const at = Math.max(0, spec.options.findIndex((o) => o.value === spec.value))
  const go = (i: number) => spec.onChange(spec.options[(i + n) % n].value)
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowLeft: () => go(at - 1),
      ArrowDown: () => go(at - 1),
      ArrowRight: () => go(at + 1),
      ArrowUp: () => go(at + 1),
      Home: () => go(0),
      End: () => go(n - 1),
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
    <div className={cx('rift-picker', selected && 'is-selected')} onMouseEnter={onSelect}>
      <span className="rift-bar__cursor">{selected && <ShardCursor size={18} />}</span>
      <span className="rift-picker__label" id={labelId}>
        {spec.label}
      </span>
      <button type="button" className="rift-picker__arrow" tabIndex={-1} aria-label={`Previous ${spec.label}`} onClick={() => go(at - 1)}>
        <span aria-hidden>◀</span>
      </button>
      <span
        className="rift-picker__value"
        role="spinbutton"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={at + 1}
        aria-valuetext={spec.options[at].label}
        onKeyDown={onKey}
        onFocus={onSelect}
        {...h.props}
      >
        {spec.options[at].label}
        {h.node}
      </span>
      <button type="button" className="rift-picker__arrow" tabIndex={-1} aria-label={`Next ${spec.label}`} onClick={() => go(at + 1)}>
        <span aria-hidden>▶</span>
      </button>
      <span className="rift-picker__count" aria-hidden>
        {at + 1}/{n}
      </span>
    </div>
  )
}

/** A stack of pickers sharing one selection (selection blue and the shard cursor), which follows pointer and focus. */
export function PickerList<T extends string>({ specs, className }: { specs: PickerSpec<T>[]; className?: string }) {
  const [sel, setSel] = useState(specs[0]?.key)
  return (
    <div className={cx('rift-pickers', className)}>
      {specs.map((s) => (
        <Picker key={s.key} spec={s} selected={sel === s.key} onSelect={() => setSel(s.key)} />
      ))}
    </div>
  )
}
