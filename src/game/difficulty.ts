export interface DifficultyConfig {
  minWordLength: number
  maxWordLength: number
  spawnIntervalMs: number
  fallSpeed: number
  maxWordsOnScreen: number
  tier: 'easy' | 'medium' | 'hard' | 'expert'
}

export function getDifficulty(elapsedSeconds: number): DifficultyConfig {
  const level = Math.floor(elapsedSeconds / 30)

  const tiers: Array<DifficultyConfig['tier']> = ['easy', 'medium', 'hard', 'expert']
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

export function getLevel(elapsedSeconds: number): number {
  return Math.floor(elapsedSeconds / 30)
}
