import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import {
  applyAppearance,
  DEFAULT_PREFERENCES,
  isPreviewing,
  lockedAppearance,
  readCache,
  requiredReward,
  rewardStatus,
  setPreviewFlag,
  writeCache,
  type Appearance,
  type Interface,
  type LockedBody,
  type PreferenceField,
  type Preferences,
  type RewardStatus,
} from '../theme/appearance'
import { useApp } from './AppState'

interface AppearanceState {
  appearance: Appearance
  prefs: Preferences
  /** What's on screen: the saved interface, or Classic while previewing. */
  ui: Interface
  previewing: boolean
  isUnlocked: (rewardKey: string) => boolean
  /** The reward a value needs and the player's progress toward it, or null if it's free or held. */
  lockFor: (field: PreferenceField, value: unknown) => RewardStatus | null
  /** Apply at once, save in the background, revert on error. Opens the lock panel for locked values.
   *  `trustServer` skips the local lock check (e.g. equipping a reward the server granted moments ago). */
  save: (changes: Partial<Preferences>, opts?: { trustServer?: boolean }) => Promise<boolean>
  saveError: string | null
  startPreview: () => void
  endPreview: () => void
  /** The reward the lock panel is showing, or null when closed. */
  lockPanel: RewardStatus | null
  openLock: (rewardKey: string) => void
  closeLock: () => void
  /** Re-fetch from the server (after a match completes, for new unlocks). */
  refresh: () => void
}

const Ctx = createContext<AppearanceState | null>(null)

/** Signed out: keep the free choices (the cursor and the Rift mode), lock everything else. */
function signedOut(a: Appearance): Appearance {
  const base = lockedAppearance()
  const p = a.preferences
  return { ...base, preferences: { ...DEFAULT_PREFERENCES, cursor: p.cursor, rift_mode: p.rift_mode ?? DEFAULT_PREFERENCES.rift_mode } }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, live } = useApp()
  // Last appearance from the server (or the cache, before the first fetch).
  const [stored, setStored] = useState<Appearance>(() => readCache() ?? lockedAppearance())
  const [previewFlag, setPreviewing] = useState(isPreviewing)
  const [lockPanel, setLockPanel] = useState<RewardStatus | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Signed out, nothing is unlocked whatever the cache says.
  const appearance = useMemo(() => (user === null ? signedOut(stored) : stored), [user, stored])
  // Earning Classic ends a preview: the real thing replaces it.
  const hasClassic = appearance.unlocks.includes('classic_interface')
  const previewing = previewFlag && !hasClassic

  const latest = useRef(appearance)
  useEffect(() => {
    latest.current = appearance
    writeCache(appearance)
  }, [appearance])

  const refresh = useCallback(() => {
    api.appearance().then(setStored, () => {
      /* keep what we have; the next refresh retries */
    })
  }, [])

  useEffect(() => {
    if (user) refresh()
  }, [user, refresh])

  // A ranked match just finished: wins and unlocks may have changed.
  const finishedMatch = live?.status === 'completed' ? live.id : null
  useEffect(() => {
    if (finishedMatch !== null) refresh()
  }, [finishedMatch, refresh])

  useEffect(() => {
    if (hasClassic) setPreviewFlag(false)
    applyAppearance(appearance.preferences, { preview: previewing })
  }, [appearance.preferences, previewing, hasClassic])

  const isUnlocked = useCallback((key: string) => appearance.unlocks.includes(key), [appearance.unlocks])

  const statusFor = useCallback(
    (key: string): RewardStatus | null =>
      appearance.rewards.find((r) => r.key === key) ??
      // The cached list can be empty or stale: fall back to the catalogue.
      rewardStatus(appearance.ranked_wins, appearance.unlocks).find((r) => r.key === key) ??
      null,
    [appearance.rewards, appearance.ranked_wins, appearance.unlocks],
  )

  const lockFor = useCallback(
    (field: PreferenceField, value: unknown) => {
      const key = requiredReward(field, value)
      return key && !appearance.unlocks.includes(key) ? statusFor(key) : null
    },
    [appearance.unlocks, statusFor],
  )

  const openLock = useCallback((key: string) => setLockPanel(statusFor(key)), [statusFor])
  const closeLock = useCallback(() => setLockPanel(null), [])

  const save = useCallback(
    async (changes: Partial<Preferences>, opts: { trustServer?: boolean } = {}) => {
      setSaveError(null)
      const before = latest.current
      for (const [field, value] of opts.trustServer ? [] : Object.entries(changes)) {
        const key = requiredReward(field as PreferenceField, value)
        if (key && !before.unlocks.includes(key)) {
          openLock(key)
          return false
        }
      }
      setStored({ ...before, preferences: { ...before.preferences, ...changes } })
      if (changes.interface) {
        // Choosing an interface for real ends any preview.
        setPreviewFlag(false)
        setPreviewing(false)
      }
      if (!user) return true // signed out: free choices live in this browser only
      try {
        setStored(await api.saveAppearance(changes))
        setLockPanel(null)
        return true
      } catch (e) {
        setStored(before)
        if (e instanceof ApiError && e.status === 403) {
          // Our idea of what's unlocked was wrong: show the lock, and fetch the truth.
          const body = e.body as LockedBody | null
          if (body?.reward) openLock(body.reward)
          refresh()
        } else {
          setSaveError('Could not save your look. Try again.')
        }
        return false
      }
    },
    [user, openLock, refresh],
  )

  const startPreview = useCallback(() => {
    setPreviewFlag(true)
    setPreviewing(true)
    setLockPanel(null)
  }, [])

  const endPreview = useCallback(() => {
    setPreviewFlag(false)
    setPreviewing(false)
  }, [])

  const value = useMemo<AppearanceState>(
    () => ({
      appearance,
      prefs: appearance.preferences,
      ui: previewing ? 'classic' : appearance.preferences.interface,
      previewing,
      isUnlocked,
      lockFor,
      save,
      saveError,
      startPreview,
      endPreview,
      lockPanel,
      openLock,
      closeLock,
      refresh,
    }),
    [appearance, previewing, isUnlocked, lockFor, save, saveError, startPreview, endPreview, lockPanel, openLock, closeLock, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppearance() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppearance must be used inside <AppearanceProvider>')
  return v
}
