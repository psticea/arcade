export type DifficultyTier = 'easy' | 'medium' | 'hard' | 'expert'

export const LEVEL_DURATION_SECONDS = 10
export const MAX_LEVEL = 12

export interface DifficultyConfig {
  spawnIntervalMs: number
  minFallSpeed: number
  maxFallSpeed: number
  maxWordsOnScreen: number
  tier: DifficultyTier
}

const tiers: DifficultyTier[] = ['easy', 'medium', 'hard', 'expert']

export function getLevel(elapsedSeconds: number, startingTier: DifficultyTier = 'easy'): number {
  const startingLevel = tiers.indexOf(startingTier)
  return Math.min(startingLevel + Math.floor(elapsedSeconds / LEVEL_DURATION_SECONDS), MAX_LEVEL)
}

export function getLevelProgress(
  elapsedSeconds: number,
  startingTier: DifficultyTier = 'easy',
): { progress: number; secondsRemaining: number } {
  if (getLevel(elapsedSeconds, startingTier) >= MAX_LEVEL) {
    return { progress: 1, secondsRemaining: 0 }
  }

  const elapsedInLevel = elapsedSeconds % LEVEL_DURATION_SECONDS
  return {
    progress: elapsedInLevel / LEVEL_DURATION_SECONDS,
    secondsRemaining: Math.ceil(LEVEL_DURATION_SECONDS - elapsedInLevel),
  }
}

export function getDifficulty(
  elapsedSeconds: number,
  startingTier: DifficultyTier = 'easy',
): DifficultyConfig {
  const level = getLevel(elapsedSeconds, startingTier)
  const tier = tiers[Math.min(level, tiers.length - 1)] ?? 'expert'

  return {
    spawnIntervalMs: Math.max(2500 - level * 150, 800),
    minFallSpeed: 25,
    maxFallSpeed: 30 + level * 3,
    maxWordsOnScreen: 4 + Math.min(Math.floor(level / 2), 6),
    tier,
  }
}
