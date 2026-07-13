export type DifficultyTier = 'easy' | 'medium' | 'hard' | 'expert'

export interface DifficultyConfig {
  minWordLength: number
  maxWordLength: number
  spawnIntervalMs: number
  fallSpeed: number
  maxWordsOnScreen: number
  tier: DifficultyTier
}

const tiers: DifficultyTier[] = ['easy', 'medium', 'hard', 'expert']

export function getLevel(elapsedSeconds: number, startingTier: DifficultyTier = 'easy'): number {
  return tiers.indexOf(startingTier) + Math.floor(elapsedSeconds / 30)
}

export function getDifficulty(
  elapsedSeconds: number,
  startingTier: DifficultyTier = 'easy',
): DifficultyConfig {
  const level = getLevel(elapsedSeconds, startingTier)

  const tierIndex = Math.min(level, tiers.length - 1)
  const tier = tiers[tierIndex] ?? 'easy'

  const lengthRanges: Record<DifficultyConfig['tier'], [number, number]> = {
    easy: [3, 4],
    medium: [4, 6],
    hard: [5, 8],
    expert: [7, 10],
  }

  const [minWordLength, maxWordLength] = lengthRanges[tier]

  return {
    minWordLength,
    maxWordLength,
    spawnIntervalMs: Math.max(2500 - level * 250, 800),
    fallSpeed: 28 + level * 6,
    maxWordsOnScreen: 4 + Math.min(level * 2, 10),
    tier,
  }
}
