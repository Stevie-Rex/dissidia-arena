/*
 * The desktop help strip: one line of hint text for the hovered or focused control (lab round 1). A control opts in
 * with hinted(); screen readers get the same text through aria-describedby, so the strip itself is aria-hidden.
 */
import { useState, type FocusEvent, type MouseEvent } from 'react'

export const DEFAULT_HINT = 'Point at or focus an item to see what it does.'

/** Hint text for one control. Spread `props` on the control and render `node` inside it. */
export function hinted(id: string, text: string) {
  return {
    props: { 'data-hint': text, 'aria-describedby': `hint-${id}` },
    node: (
      <span id={`hint-${id}`} hidden>
        {text}
      </span>
    ),
  }
}

/** The hint under the pointer or focus. Spread `handlers` on the element that holds the hinted controls. */
export function useHelpText() {
  const [text, setText] = useState(DEFAULT_HINT)
  const read = (e: MouseEvent | FocusEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-hint]')
    setText(el?.dataset.hint ?? DEFAULT_HINT)
  }
  return { text, handlers: { onMouseOver: read, onFocus: read } }
}
