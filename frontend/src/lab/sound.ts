/*
 * The match-found sound, made in the browser with the Web Audio API: a short rising swell, then a crystal
 * chime timed to the shatter. It is original, so no licence applies, and there is no file to download.
 *
 * Browsers only let a page play sound after the player has interacted with it. Call unlockAudio() from a
 * click (Queue, Accept, Play); a match found later by polling can then play.
 *
 * Proposal for the owner: sound follows its own mute setting, not prefers-reduced-motion, because it is a
 * cue rather than motion.
 */

const MUTE_KEY = 'lab-sound-muted'
let ctx: AudioContext | null = null

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* storage blocked: the setting lasts for this visit only */
  }
}

/** Create or resume the audio context. Call it from a user gesture. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
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

/** Plays the match-found sound unless muted. Starts the burst about 0.6s in, in step with the shatter. */
export function playMatchFound(muted: boolean) {
  if (muted) return
  unlockAudio()
  const ac = ctx
  if (!ac) return
  const t = ac.currentTime + 0.02
  const out = ac.createGain()
  out.gain.value = 0.2
  out.connect(ac.destination)

  // The swell: a soft triangle rising an octave as the crystal grows.
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
