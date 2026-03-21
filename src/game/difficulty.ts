export interface DifficultyConfig {
  spawnIntervalMs: number
  minFallSpeed: number
  maxFallSpeed: number
  maxWordsOnScreen: number
}

export function getDifficulty(elapsedSeconds: number): DifficultyConfig {
  const level = Math.floor(elapsedSeconds / 10)

  return {
    spawnIntervalMs: Math.max(2500 - level * 150, 800),
    minFallSpeed: 25,
    maxFallSpeed: 30 + level * 3,
    maxWordsOnScreen: 4 + Math.min(Math.floor(level / 2), 6),
  }
}

export function getLevel(elapsedSeconds: number): number {
  return Math.floor(elapsedSeconds / 10)
}
