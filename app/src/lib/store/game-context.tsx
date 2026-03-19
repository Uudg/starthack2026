'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useGameEngine } from '@/lib/hooks/useGameEngine'

// The context type is whatever useGameEngine returns
type GameContextType = ReturnType<typeof useGameEngine>

const GameContext = createContext<GameContextType | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const engine = useGameEngine()
  return (
    <GameContext.Provider value={engine}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
