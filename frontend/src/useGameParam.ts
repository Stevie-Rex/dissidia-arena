import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import type { GameId } from './data/mock'
import { useApp } from './state/AppState'

/** Reads the :game route param and keeps the global game switcher in sync with it. */
export function useGameParam(): GameId {
  const { game: param } = useParams()
  const { game, setGame } = useApp()
  const g: GameId = param === '012' ? '012' : 'nt'
  useEffect(() => {
    if (g !== game) setGame(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g])
  return g
}
