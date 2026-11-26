/*
 * Icons from game-icons.net (CC BY 3.0, https://creativecommons.org/licenses/by/3.0/), copied from
 * @iconify-json/game-icons 1.2.4 with fill="currentColor". Unchanged except for being wrapped as React components.
 * Each icon names its author; the credit line is in the Rift footer and CREDITS.md. Nothing is fetched at runtime.
 */
import type { ReactNode } from 'react'

function Icon({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden focusable="false">
      {children}
    </svg>
  )
}

type P = { size?: number }

/** 012 emblem: `floating-crystal` by Lorc, game-icons.net, CC BY 3.0 */
export function GiFloatingCrystal({ size = 24 }: P) {
  return (
    <Icon size={size}>
      <path d="M320.94 24.86v55.654l45.31 58.49v66.27l41.24-64.038zm-56.706 16.263l-76.77 94.758l87.09 27.778l64.58-29.146l-24.81-32.024zm-143.074 88.5l-82.674 96.035l82.674 26.858zm226.403 21.588l-62.307 28.122v238.334l62.176-28.875V234.5l.13-.203V151.21zm-165.907 2.436v237.258l84.912 27.766V180.73l-84.912-27.084zM44.85 247.376l76.31 102.368v-77.58l-76.31-24.79zm331.31 4.413v154.415l82.752-13.533L376.16 251.79zm73.412 161.347L376.16 425.14v46.768l73.412-58.77zm-256.267 1.238l70.93 79.78l70.738-78.973l-57.516 26.713z" />
    </Icon>
  )
}

/** NT emblem: `winged-sword` by Lorc, game-icons.net, CC BY 3.0 */
export function GiWingedSword({ size = 24 }: P) {
  return (
    <Icon size={size}>
      <path d="M246.78 18.656v101.22c7.988.266 16.003.267 24 0V18.655zm-72.155 110.406v30.813h168.313v-30.813c-55.755 12.73-113.104 12.604-168.313 0m-150.28 35.063l9.343 37.594l132.187 8.093l9.406.562l-.655 9.406c-2.594 38.077 5.257 78.673 25.563 112.44l7.625-146.47l-183.47-21.625zm463.186 0l-177.842 20.97l7.187 137.843c16.457-31.775 22.736-68.503 20.375-103.157l-.625-9.405l9.375-.563l132.188-8.093zm-260.624 14.438L216.25 383.188v44.187l44.375 66.53l43.03-65.342l-13-250h-22.53V429.5h-18.688V178.562zM38.186 220.72c3.52 11.234 8.043 23.026 13.345 34.936l104.5-8.562a232 232 0 0 1-.28-19.188zm435.502 0l-117.563 7.186c.172 6.353.077 12.768-.28 19.188l104.5 8.562c5.3-11.91 9.825-23.702 13.342-34.937zm-315.844 45l-97.72 8a439 439 0 0 0 17.782 31.81l84.063-18.28a219 219 0 0 1-4.126-21.53zm196.187 0a219 219 0 0 1-4.092 21.53l84.03 18.28a438 438 0 0 0 17.782-31.81zM167.19 305.25l-78.44 17.063c6.694 9.8 13.67 19.05 20.75 27.468l64.938-26.342a196 196 0 0 1-7.25-18.188zm177.5 0a197 197 0 0 1-7.25 18.188l64.937 26.343c7.08-8.415 14.056-17.666 20.75-27.467l-78.438-17.063z" />
    </Icon>
  )
}
