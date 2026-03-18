interface HUDProps {
  score: number
  combo: number
  lives: number
  level: number
}

const TIER_NAMES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT']

export function HUD({ score, combo, lives, level }: HUDProps) {
  const tierName = TIER_NAMES[Math.min(level, TIER_NAMES.length - 1)]

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
          <span className="hud-label">LEVEL</span>
          <span className="hud-value hud-tier">{tierName}</span>
        </div>
        <div className="hud-lives">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className={`heart ${i < lives ? 'heart-active' : 'heart-lost'}`}>
              {i < lives ? '\u2764' : '\u2661'}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
