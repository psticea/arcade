import type { DifficultyTier } from '../game/difficulty.ts'
import type { GameLanguage } from '../game/wordManager.ts'
import { calculateAccuracy, calculateWpm } from '../game/runStats.ts'
import { getUiCopy } from '../uiCopy.ts'

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
  const text = getUiCopy(language)

  return (
    <div className="screen gameover-screen">
      <div className="screen-content">
        <h1 className="gameover-title">{text.results.gameOver}</h1>
        <p className="run-mode">{text.language[language]} / {text.difficulty[difficulty].toUpperCase()}</p>
        <div className="final-score">
          <span className="final-score-label">
            {isNewBest ? text.results.newPersonalBest : text.results.finalScore}
          </span>
          <span className="final-score-value">{score.toLocaleString()}</span>
          <span className="best-score">{text.results.best}: {bestScore.toLocaleString()}</span>
        </div>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">{text.results.wordsTyped}</span>
            <span className="stat-value">{wordsTyped}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{text.results.wordsMissed}</span>
            <span className="stat-value">{wordsMissed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{text.results.maxCombo}</span>
            <span className="stat-value">x{maxCombo}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{text.results.accuracy}</span>
            <span className="stat-value">{accuracy}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{text.results.typingSpeed}</span>
            <span className="stat-value">{wpm} WPM</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{text.results.timeSurvived}</span>
            <span className="stat-value">{timeStr}</span>
          </div>
        </div>
        <div className="gameover-actions">
          <button className="start-button" onClick={onRestart}>{text.results.playAgain}</button>
          <button className="secondary-button" onClick={onHome}>{text.results.changeSettings}</button>
        </div>
      </div>
    </div>
  )
}
