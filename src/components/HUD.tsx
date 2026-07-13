import type { DifficultyTier } from '../game/difficulty.ts'
import type { GameLanguage } from '../game/wordManager.ts'
import { getUiCopy } from '../uiCopy.ts'

interface HUDProps {
  score: number
  combo: number
  lives: number
  level: number
  tier: DifficultyTier
  levelProgress: number
  secondsToNextLevel: number
  language: GameLanguage
}

export function HUD({
  score,
  combo,
  lives,
  level,
  tier,
  levelProgress,
  secondsToNextLevel,
  language,
}: HUDProps) {
  const text = getUiCopy(language)

  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-score">
          <span className="hud-label">{text.hud.score}</span>
          <span className="hud-value">{score.toLocaleString()}</span>
        </div>
        <div className="hud-combo">
          <span className="hud-label">{text.hud.combo}</span>
          <span className={`hud-value ${combo >= 5 ? 'combo-high' : combo >= 3 ? 'combo-mid' : ''}`}>
            x{combo}
          </span>
        </div>
      </div>
      <div className="hud-right">
        <div className="hud-level">
          <span className="hud-label">{text.hud.level} {level + 1}</span>
          <span className="hud-value hud-tier">{text.difficulty[tier].toUpperCase()}</span>
          <div
            className="level-progress"
            role="progressbar"
            aria-label={text.hud.progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(levelProgress * 100)}
          >
            <span style={{ width: `${levelProgress * 100}%` }} />
          </div>
          <span className="level-countdown">
            {secondsToNextLevel === 0 ? text.hud.max : `${secondsToNextLevel}s`}
          </span>
        </div>
        <div className="hud-lives" aria-label={text.hud.livesRemaining(lives)}>
          {Array.from({ length: 3 }, (_, i) => (
            <span aria-hidden="true" key={i} className={`heart ${i < lives ? 'heart-active' : 'heart-lost'}`}>
              {i < lives ? '\u2764' : '\u2661'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
