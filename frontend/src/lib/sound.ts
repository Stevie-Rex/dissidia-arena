/*
 * The match-found chime, made in the browser with the Web Audio API: a short rising swell, then a crystal chime.
 * Ported from lab round 1. Synthesis needs no audio asset.
 *
 * Unlock audio on a player gesture so a later poll can play the chime.
 *
 * The chime follows its own Sound setting, not prefers-reduced-motion: it's a cue, not motion (owner, #40). The
 * setting is per device, in localStorage, so it works signed out too.
 */
import { useSyncExternalStore } from 'react'

const MUTE_KEY = 'da-sound-muted'
let ctx: AudioContext | null = null
const listeners = new Set<() => void>()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

let muted = readMuted()

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {
    /* storage blocked: the setting lasts for this visit only */
  }
  // Turning sound on is a click, so it unlocks audio too.
  if (!next) unlockAudio()
  listeners.forEach((l) => l())
}

/** The Sound setting, for a toggle. */
export function useMuted(): [boolean, (muted: boolean) => void] {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    isMuted,
  )
  return [value, setMuted]
}

/** Create or resume the audio context. Call it from a user gesture. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  } catch {
    ctx = null
  }
}

/** A bell-like note: a sine and a quieter inharmonic partial, with a fast attack and a long decay. */
function bell(ac: AudioContext, out: AudioNode, freq: number, at: number, length: number, level: number) {
  for (const [ratio, part] of [
    [1, 1],
    [2.76, 0.28],
  ] as const) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * ratio
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(level * part, at + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length / ratio)
    osc.connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + length + 0.05)
  }
}

/** Plays the match-found chime unless Sound is off, or audio was never unlocked by a click. */
export function playMatchFound() {
  if (muted) return
  const ac = ctx
  if (ac?.state !== 'running') return
  const t = ac.currentTime + 0.02
  const out = ac.createGain()
  out.gain.value = 0.2
  out.connect(ac.destination)

  // The swell: a soft triangle rising an octave.
  const swell = ac.createOscillator()
  const swellGain = ac.createGain()
  swell.type = 'triangle'
  swell.frequency.setValueAtTime(440, t)
  swell.frequency.exponentialRampToValueAtTime(880, t + 0.55)
  swellGain.gain.setValueAtTime(0.0001, t)
  swellGain.gain.exponentialRampToValueAtTime(0.25, t + 0.45)
  swellGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.62)
  swell.connect(swellGain).connect(out)
  swell.start(t)
  swell.stop(t + 0.7)

  // The chime: E6, B6, E7 and G#7 in quick succession.
  ;[1318.5, 1975.5, 2637, 3322.4].forEach((f, i) => bell(ac, out, f, t + 0.58 + i * 0.06, 1.6, 0.55 / (i + 1)))
}
