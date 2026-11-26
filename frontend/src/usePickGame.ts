import { useLocation, useNavigate } from 'react-router-dom'

import type { GameId } from './data/mock'
import { useApp } from './state/AppState'

/** Changes the current game. On a per-game page it jumps to the same page for the new game. */
export function usePickGame() {
  const { setGame } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (g: GameId) => {
    setGame(g)
    const m = pathname.match(/^\/(012|nt)(\/.*)?$/)
    if (m) navigate(`/${g}${m[2]?.startsWith('/characters') ? '/meta' : (m[2] ?? '')}`)
  }
}
