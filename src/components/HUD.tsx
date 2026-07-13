import type { DifficultyTier } from '../game/difficulty.ts'

interface HUDProps {
  score: number
  combo: number
  lives: number
  level: number
  tier: DifficultyTier
  levelProgress: number
  secondsToNextLevel: number
}

export function HUD({
  score,
  combo,
  lives,
  level,
  tier,
  levelProgress,
  secondsToNextLevel,
}: HUDProps) {
  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-score">
          <span className="hud-label">SCORE</span>
          <span className="hud-value">{score.toLocaleString()}</span>
        </div>
        <div className="hud-combo">
          <span className="hud-label">COMBO</span>
          <span className={`hud-value ${combo >= 5 ? 'combo-high' : combo >= 3 ? 'combo-mid' : ''}`}>
            x{combo}
          </span>
        </div>
      </div>
      <div className="hud-right">
        <div className="hud-level">
          <span className="hud-label">LEVEL {level + 1}</span>
          <span className="hud-value hud-tier">{tier.toUpperCase()}</span>
          <div
            className="level-progress"
            role="progressbar"
            aria-label="Progress to next level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(levelProgress * 100)}
          >
            <span style={{ width: `${levelProgress * 100}%` }} />
          </div>
          <span className="level-countdown">
            {secondsToNextLevel === 0 ? 'MAX' : `${secondsToNextLevel}s`}
          </span>
        </div>
        <div className="hud-lives" aria-label={`${lives} lives remaining`}>
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
