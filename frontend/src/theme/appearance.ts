/**
 * Appearance helpers: a TypeScript port of the theme package's js/appearance.js, minus the
 * reload-based interface switch (React swaps layouts instead).
 *
 * The server is the source of truth for unlocks (GET/PATCH /api/me/appearance); this module only
 * reflects them. Names, goals and defaults come from tokens.json, which mirrors backend/app/rewards.py.
 */
import tokens from './tokens.json'

export type Interface = 'rift' | 'classic'
export type WindowTheme = 'classic' | 'crystal' | 'magitek' | 'midgar' | 'garden' | 'gaia' | 'spira' | 'ivalice' | 'custom'
export type MenuFont = 'auto' | 'bit16' | 'bit8' | 'story' | 'modern'
export type Cursor = 'glove' | 'arrow'
export type Rgb = [number, number, number]

export interface Preferences {
  interface: Interface
  window_theme: WindowTheme
  menu_font: MenuFont
  cursor: Cursor
  window_rgb: Rgb
}
export type PreferenceField = keyof Preferences

export interface RewardDef {
  key: string
  name: string
  goal: number
  unlocks: Partial<Record<PreferenceField, string[]>>
}

export interface RewardStatus extends RewardDef {
  unlocked: boolean
  remaining: number
  percent: number
}

/** Body of GET/PATCH /api/me/appearance. */
export interface Appearance {
  preferences: Preferences
  ranked_wins: number
  ranked_losses: number
  unlocks: string[]
  rewards: RewardStatus[]
  next: RewardStatus | null
}

/** 403 body from PATCH when a value is locked. */
export interface LockedBody {
  error: 'locked'
  message?: string
  reward: string
  goal: number
  remaining: number
}

export const REWARDS: RewardDef[] = tokens.rewards as RewardDef[]
export const REWARDS_BY_KEY: Record<string, RewardDef> = Object.fromEntries(REWARDS.map((r) => [r.key, r]))

export const DEFAULT_PREFERENCES: Preferences = {
  interface: 'rift',
  window_theme: 'classic',
  menu_font: 'auto',
  cursor: 'glove',
  window_rgb: tokens.classic.customWindow.default as Rgb,
}

export const WINDOWS = Object.entries(tokens.classic.windows).map(([key, w]) => ({
  key: key as WindowTheme,
  name: w.name,
  after: w.after,
  font: w.font as Exclude<MenuFont, 'auto'>,
}))

export const MENU_FONTS = Object.entries(tokens.classic.fonts).map(([key, f]) => ({
  key: key as Exclude<MenuFont, 'auto'>,
  name: f.name,
  family: f.family,
}))

export const RGB_MAX = tokens.classic.customWindow.channelMax

/** The reward a preference value needs, or null. Mirrors rewards.required_reward(). */
export function requiredReward(field: PreferenceField, value: unknown): string | null {
  for (const r of REWARDS) {
    const values = r.unlocks[field]
    if (values && (values.includes('any') || (typeof value === 'string' && values.includes(value)))) return r.key
  }
  return null
}

/** Progress for a signed-out player, or before the first fetch: everything locked. */
export function rewardStatus(wins: number, unlocked: string[]): RewardStatus[] {
  return REWARDS.map((r) => {
    const have = unlocked.includes(r.key)
    return {
      ...r,
      unlocked: have,
      remaining: have ? 0 : Math.max(0, r.goal - wins),
      percent: have ? 100 : Math.min(100, Math.round((wins / r.goal) * 100)),
    }
  })
}

export function lockedAppearance(): Appearance {
  const rewards = rewardStatus(0, [])
  return { preferences: { ...DEFAULT_PREFERENCES }, ranked_wins: 0, ranked_losses: 0, unlocks: [], rewards, next: rewards[0] }
}

/* ------------------------------------------------------------------ DOM */

const root = () => document.documentElement

/** Custom window colour: channels 0-31 as in the old Config screens. Base = channel x 3 (max 93),
 *  so white text always passes 4.5:1. */
export function customWindow(r: number, g: number, b: number) {
  const clamp = (n: number) => {
    const v = Math.round(Number(n))
    return Math.max(0, Math.min(RGB_MAX, Number.isNaN(v) ? 0 : v))
  }
  const base = [clamp(r) * 3, clamp(g) * 3, clamp(b) * 3]
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  const mix = (f: number) => '#' + base.map((c) => hex(c * f)).join('')
  return { top: mix(1.2), bot: mix(0.45), track: mix(0.25) }
}

const CUSTOM_PROPS = ['--win-top', '--win-bot', '--win-track'] as const

/** Write a full preferences object onto <html>. `interfaceOverride` is used for preview. */
export function applyAppearance(p: Preferences, opts: { preview?: boolean } = {}) {
  const el = root()
  el.setAttribute('data-interface', opts.preview ? 'classic' : p.interface)
  if (opts.preview) el.setAttribute('data-preview', 'classic')
  else el.removeAttribute('data-preview')
  // A previewing player only has the base Classic window.
  const win = opts.preview ? 'classic' : p.window_theme
  el.setAttribute('data-window', win)
  const font = opts.preview && p.menu_font === 'bit8' ? 'auto' : p.menu_font
  if (font === 'auto') el.removeAttribute('data-menu-font')
  else el.setAttribute('data-menu-font', font)
  el.setAttribute('data-cursor', p.cursor)
  if (win === 'custom') {
    const c = customWindow(...p.window_rgb)
    el.style.setProperty('--win-top', c.top)
    el.style.setProperty('--win-bot', c.bot)
    el.style.setProperty('--win-track', c.track)
  } else {
    CUSTOM_PROPS.forEach((prop) => el.style.removeProperty(prop))
  }
}

/* ------------------------------------------------------------------ storage */

/** Read by the inline no-flash script in index.html; keep the shape in step with it. */
export const CACHE_KEY = 'da-appearance'
export const PREVIEW_KEY = 'da-preview'

export function readCache(): Appearance | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const a = raw ? (JSON.parse(raw) as Appearance) : null
    return a && a.preferences && Array.isArray(a.unlocks) ? a : null
  } catch {
    return null
  }
}

export function writeCache(a: Appearance | null) {
  try {
    if (a) localStorage.setItem(CACHE_KEY, JSON.stringify(a))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    /* storage blocked: the theme just won't survive a reload */
  }
}

export function isPreviewing(): boolean {
  try {
    return sessionStorage.getItem(PREVIEW_KEY) === 'classic'
  } catch {
    return false
  }
}

export function setPreviewFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(PREVIEW_KEY, 'classic')
    else sessionStorage.removeItem(PREVIEW_KEY)
  } catch {
    /* ignore */
  }
}

/** Progress toward one reward, for bars. */
export function rewardProgress(wins: number, key: string) {
  const goal = REWARDS_BY_KEY[key]?.goal ?? 1
  return {
    goal,
    done: Math.min(wins, goal),
    remaining: Math.max(0, goal - wins),
    percent: Math.min(100, Math.round((wins / goal) * 100)),
  }
}
