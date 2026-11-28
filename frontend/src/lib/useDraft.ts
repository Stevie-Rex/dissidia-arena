import { useState } from 'react'

const storageKey = (key: string) => `da-draft:${key}`

// Browser storage can be blocked or full. A draft is only a convenience, so every storage error is ignored: what
// was typed stays in the form, and nothing is shown to the player.
function read(key: string) {
  try {
    return localStorage.getItem(storageKey(key)) ?? ''
  } catch {
    return ''
  }
}

function write(key: string, text: string) {
  try {
    if (text) localStorage.setItem(storageKey(key), text)
    else localStorage.removeItem(storageKey(key))
  } catch {
    // ignored: see above
  }
}

/**
 * Typed text that is also kept in this browser, so scrolling away, closing a panel or reloading never loses it.
 * `clear` forgets it, once what it was for has been sent. The key must not change while mounted.
 */
export function useDraft(key: string) {
  const [text, setText] = useState(() => read(key))
  return {
    text,
    set: (next: string) => {
      setText(next)
      write(key, next)
    },
    clear: () => {
      setText('')
      write(key, '')
    },
  }
}
