export type DifficultyTier = 'easy' | 'medium' | 'hard' | 'expert'

export interface DifficultyConfig {
  spawnIntervalMs: number
  minFallSpeed: number
  maxFallSpeed: number
  maxWordsOnScreen: number
}

const tiers: DifficultyTier[] = ['easy', 'medium', 'hard', 'expert']

export function getLevel(elapsedSeconds: number, startingTier: DifficultyTier = 'easy'): number {
  return tiers.indexOf(startingTier) + Math.floor(elapsedSeconds / 10)
}

export function getDifficulty(
  elapsedSeconds: number,
  startingTier: DifficultyTier = 'easy',
): DifficultyConfig {
  const level = getLevel(elapsedSeconds, startingTier)

  return {
    spawnIntervalMs: Math.max(2500 - level * 150, 800),
    minFallSpeed: 25,
    maxFallSpeed: 30 + level * 3,
    maxWordsOnScreen: 4 + Math.min(Math.floor(level / 2), 6),
  }
}
