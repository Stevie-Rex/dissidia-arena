/* Hint text shared by the help strip and screen readers. */

/**
 * Hint text for one control. Spread `props` on the control and render `node` inside it: the help strip reads
 * data-hint on hover or focus, and screen readers get the same text through aria-describedby.
 */
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
