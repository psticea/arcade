interface GameOverProps {
  score: number
  wordsTyped: number
  wordsMissed: number
  maxCombo: number
  elapsedTime: number
  onRestart: () => void
}

export function GameOverScreen({ score, wordsTyped, wordsMissed, maxCombo, elapsedTime, onRestart }: GameOverProps) {
  const minutes = Math.floor(elapsedTime / 60)
  const seconds = Math.floor(elapsedTime % 60)
  const timeStr = minutes > 0 ? minutes + 'm ' + seconds + 's' : seconds + 's'

  return (
    <div className="screen gameover-screen">
      <div className="screen-content">
        <h1 className="gameover-title">GAME OVER</h1>
        <div className="final-score">
          <span className="final-score-label">FINAL SCORE</span>
          <span className="final-score-value">{score.toLocaleString()}</span>
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
            <span className="stat-label">Time Survived</span>
            <span className="stat-value">{timeStr}</span>
          </div>
        </div>
        <button className="start-button" onClick={onRestart}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  )
}
