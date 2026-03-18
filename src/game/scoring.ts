export function calculateScore(wordLength: number, combo: number, level: number): number {
  const basePoints = wordLength * 10
  const comboMultiplier = 1 + Math.min(combo, 10) * 0.5
  const levelBonus = 1 + level * 0.15
  return Math.round(basePoints * comboMultiplier * levelBonus)
}

export function getMissedPenalty(level: number): number {
  return Math.round(5 + level * 2)
}
