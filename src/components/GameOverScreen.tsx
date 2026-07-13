import type { DifficultyTier } from '../game/difficulty.ts'
import type { GameLanguage } from '../game/wordManager.ts'
import { calculateAccuracy, calculateWpm } from '../game/runStats.ts'

interface GameOverProps {
  score: number
  wordsTyped: number
  charactersTyped: number
  wordsMissed: number
  maxCombo: number
  elapsedTime: number
  language: GameLanguage
  difficulty: DifficultyTier
  bestScore: number
  isNewBest: boolean
  onRestart: () => void
  onHome: () => void
}

export function GameOverScreen({
  score,
  wordsTyped,
  charactersTyped,
  wordsMissed,
  maxCombo,
  elapsedTime,
  language,
  difficulty,
  bestScore,
  isNewBest,
  onRestart,
  onHome,
}: GameOverProps) {
  const minutes = Math.floor(elapsedTime / 60)
  const seconds = Math.floor(elapsedTime % 60)
  const timeStr = minutes > 0 ? minutes + 'm ' + seconds + 's' : seconds + 's'
  const accuracy = calculateAccuracy(wordsTyped, wordsMissed)
  const wpm = calculateWpm(charactersTyped, elapsedTime)
  const languageLabel = language === 'romanian' ? 'Romana' : 'English'

  return (
    <div className="screen gameover-screen">
      <div className="screen-content">
        <h1 className="gameover-title">GAME OVER</h1>
        <p className="run-mode">{languageLabel} / {difficulty.toUpperCase()}</p>
        <div className="final-score">
          <span className="final-score-label">{isNewBest ? 'NEW PERSONAL BEST' : 'FINAL SCORE'}</span>
          <span className="final-score-value">{score.toLocaleString()}</span>
          <span className="best-score">Best: {bestScore.toLocaleString()}</span>
        </div>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Words Typed</span>
            <span className="stat-value">{wordsTyped}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Words Missed</span>
            <span className="stat-value">{wordsMissed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Max Combo</span>
            <span className="stat-value">x{maxCombo}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Accuracy</span>
            <span className="stat-value">{accuracy}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Typing Speed</span>
            <span className="stat-value">{wpm} WPM</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Time Survived</span>
            <span className="stat-value">{timeStr}</span>
          </div>
        </div>
        <div className="gameover-actions">
          <button className="start-button" onClick={onRestart}>PLAY AGAIN</button>
          <button className="secondary-button" onClick={onHome}>CHANGE SETTINGS</button>
        </div>
      </div>
    </div>
  )
}
