import { useState, useCallback } from 'react'
import { StartScreen } from './components/StartScreen.tsx'
import { GameCanvas } from './components/GameCanvas.tsx'
import { GameOverScreen } from './components/GameOverScreen.tsx'
import type { GameState } from './game/gameState.ts'
import type { DifficultyTier } from './game/difficulty.ts'
import type { GameLanguage } from './game/wordManager.ts'
import { updatePersonalBest, type PersonalBestResult } from './game/runStats.ts'
import './styles/theme.css'

type Screen = 'start' | 'playing' | 'gameover'

export function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [finalState, setFinalState] = useState<GameState | undefined>(undefined)
  const [gameKey, setGameKey] = useState(0)
  const [startingDifficulty, setStartingDifficulty] = useState<DifficultyTier>('easy')
  const [gameLanguage, setGameLanguage] = useState<GameLanguage>('english')
  const [personalBest, setPersonalBest] = useState<PersonalBestResult | undefined>()

  const handleStart = useCallback((difficulty: DifficultyTier, language: GameLanguage) => {
    setStartingDifficulty(difficulty)
    setGameLanguage(language)
    setGameKey((k) => k + 1)
    setScreen('playing')
    setFinalState(undefined)
    setPersonalBest(undefined)
  }, [])

  const handleGameOver = useCallback((state: GameState) => {
    setPersonalBest(updatePersonalBest(
      window.localStorage,
      gameLanguage,
      startingDifficulty,
      state.score,
    ))
    setFinalState(state)
    setScreen('gameover')
  }, [gameLanguage, startingDifficulty])

  const handleRestart = useCallback(() => {
    setGameKey((k) => k + 1)
    setScreen('playing')
    setFinalState(undefined)
    setPersonalBest(undefined)
  }, [])

  const handleHome = useCallback(() => {
    setScreen('start')
    setFinalState(undefined)
    setPersonalBest(undefined)
  }, [])

  return (
    <>
      {screen === 'start' && (
        <StartScreen
          initialDifficulty={startingDifficulty}
          initialLanguage={gameLanguage}
          onStart={handleStart}
        />
      )}
      {screen === 'playing' && (
        <GameCanvas
          key={gameKey}
          startingDifficulty={startingDifficulty}
          language={gameLanguage}
          onGameOver={handleGameOver}
        />
      )}
      {screen === 'gameover' && finalState && (
        <GameOverScreen
          score={finalState.score}
          wordsTyped={finalState.wordsTyped}
          charactersTyped={finalState.charactersTyped}
          wordsMissed={finalState.wordsMissed}
          maxCombo={finalState.maxCombo}
          elapsedTime={finalState.elapsedTime}
          language={gameLanguage}
          difficulty={startingDifficulty}
          bestScore={personalBest?.bestScore ?? finalState.score}
          isNewBest={personalBest?.isNewBest ?? false}
          onRestart={handleRestart}
          onHome={handleHome}
        />
      )}
    </>
  )
}
