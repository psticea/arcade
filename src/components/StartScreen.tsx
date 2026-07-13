import { useCallback, useEffect, useState } from 'react'
import type { DifficultyTier } from '../game/difficulty.ts'
import type { GameLanguage } from '../game/wordManager.ts'
import { getUiCopy } from '../uiCopy.ts'

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
  const text = getUiCopy(language)

  useEffect(() => {
    document.documentElement.lang = language === 'romanian' ? 'ro' : 'en'
  }, [language])

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
        <p className="game-subtitle">{text.start.subtitle}</p>
        <fieldset className="language-picker">
          <legend>{text.start.languageLegend}</legend>
          <div className="language-options">
            {(['english', 'romanian'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="language-option"
                aria-pressed={language === value}
                onClick={() => setLanguage(value)}
              >
                {text.language[value]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="difficulty-picker">
          <legend>{text.start.difficultyLegend}</legend>
          <div className="difficulty-options">
            {(['easy', 'medium', 'hard', 'expert'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                className="difficulty-option"
                aria-pressed={difficulty === tier}
                onClick={() => setDifficulty(tier)}
              >
                {text.difficulty[tier]}
              </button>
            ))}
          </div>
          <p className="difficulty-hint">{text.start.difficultyHint}</p>
        </fieldset>
        <div className="instructions">
          {text.start.instructions.map((instruction) => (
            <div className="instruction-item" key={instruction}>{instruction}</div>
          ))}
        </div>
        <button className="start-button" onClick={() => onStart(difficulty, language)}>
          {text.start.startButton}
        </button>
      </div>
    </div>
  )
}
