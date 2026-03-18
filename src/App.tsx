import { useState, useCallback } from 'react'
import { StartScreen } from './components/StartScreen.tsx'
import { GameCanvas } from './components/GameCanvas.tsx'
import { GameOverScreen } from './components/GameOverScreen.tsx'
import type { GameState } from './game/gameState.ts'
import './styles/theme.css'

type Screen = 'start' | 'playing' | 'gameover'

export function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [finalState, setFinalState] = useState<GameState | undefined>(undefined)
  const [gameKey, setGameKey] = useState(0)

  const handleStart = useCallback(() => {
    setGameKey((k) => k + 1)
    setScreen('playing')
    setFinalState(undefined)
  }, [])

  const handleGameOver = useCallback((state: GameState) => {
    setFinalState(state)
    setScreen('gameover')
  }, [])

  const handleRestart = useCallback(() => {
    setGameKey((k) => k + 1)
    setScreen('playing')
    setFinalState(undefined)
  }, [])

  return (
    <>
      {screen === 'start' && <StartScreen onStart={handleStart} />}
      {screen === 'playing' && <GameCanvas key={gameKey} onGameOver={handleGameOver} />}
      {screen === 'gameover' && finalState && (
        <GameOverScreen
          score={finalState.score}
          wordsTyped={finalState.wordsTyped}
          wordsMissed={finalState.wordsMissed}
          maxCombo={finalState.maxCombo}
          elapsedTime={finalState.elapsedTime}
          onRestart={handleRestart}
        />
      )}
    </>
  )
}
