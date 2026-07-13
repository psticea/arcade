import { useCallback, useEffect, useState } from 'react'
import type { DifficultyTier } from '../game/difficulty.ts'
import type { GameLanguage } from '../game/wordManager.ts'

interface StartScreenProps {
  onStart: (difficulty: DifficultyTier, language: GameLanguage) => void
  initialDifficulty?: DifficultyTier
  initialLanguage?: GameLanguage
}

export function StartScreen({
  onStart,
  initialDifficulty = 'easy',
  initialLanguage = 'english',
}: StartScreenProps) {
  const [difficulty, setDifficulty] = useState<DifficultyTier>(initialDifficulty)
  const [language, setLanguage] = useState<GameLanguage>(initialLanguage)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') onStart(difficulty, language)
    },
    [difficulty, language, onStart],
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
        <fieldset className="language-picker">
          <legend>Word language</legend>
          <div className="language-options">
            {([
              ['english', 'English'],
              ['romanian', 'Romana'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="language-option"
                aria-pressed={language === value}
                onClick={() => setLanguage(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
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
          <p className="difficulty-hint">The pace increases every 10 seconds, up to Level 13</p>
        </fieldset>
        <div className="instructions">
          <div className="instruction-item">Words fall from the top - type them to destroy</div>
          <div className="instruction-item">The pace picks up every 10 seconds</div>
          <div className="instruction-item">Build combos for bonus points</div>
          <div className="instruction-item">3 lives - miss a word and lose one</div>
        </div>
        <button className="start-button" onClick={() => onStart(difficulty, language)}>
          PRESS ENTER TO START
        </button>
      </div>
    </div>
  )
}
