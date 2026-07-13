import { useCallback, useEffect, useState } from 'react'
import type { DifficultyTier } from '../game/difficulty.ts'

interface StartScreenProps {
  onStart: (difficulty: DifficultyTier) => void
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [difficulty, setDifficulty] = useState<DifficultyTier>('easy')

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') onStart(difficulty)
    },
    [difficulty, onStart],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="screen start-screen">
      <div className="screen-content">
        <h1 className="game-title">WORD<span className="title-accent">FALL</span></h1>
        <p className="game-subtitle">Type the falling words before they reach the bottom</p>
        <fieldset className="difficulty-picker">
          <legend>Choose starting difficulty</legend>
          <div className="difficulty-options">
            {(['easy', 'medium', 'hard', 'expert'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                className="difficulty-option"
                aria-pressed={difficulty === tier}
                onClick={() => setDifficulty(tier)}
              >
                {tier}
              </button>
            ))}
          </div>
          <p className="difficulty-hint">The pace increases every 30 seconds</p>
        </fieldset>
        <div className="instructions">
          <div className="instruction-item">Words fall from the top — type them to destroy</div>
          <div className="instruction-item">Longer words appear as difficulty increases</div>
          <div className="instruction-item">Build combos for bonus points</div>
          <div className="instruction-item">3 lives — miss a word and lose one</div>
        </div>
        <button className="start-button" onClick={() => onStart(difficulty)}>
          PRESS ENTER TO START
        </button>
      </div>
    </div>
  )
}
