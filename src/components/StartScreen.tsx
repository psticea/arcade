import { useCallback, useEffect } from 'react'

interface StartScreenProps {
  onStart: () => void
}

export function StartScreen({ onStart }: StartScreenProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') onStart()
    },
    [onStart],
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
        <div className="instructions">
          <div className="instruction-item">Words fall from the top — type them to destroy</div>
          <div className="instruction-item">Longer words appear as difficulty increases</div>
          <div className="instruction-item">Build combos for bonus points</div>
          <div className="instruction-item">3 lives — miss a word and lose one</div>
        </div>
        <button className="start-button" onClick={onStart}>
          PRESS ENTER TO START
        </button>
      </div>
    </div>
  )
}
