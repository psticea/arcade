import type { DifficultyTier } from './difficulty.ts'
import type { GameLanguage } from './wordManager.ts'

const STORAGE_KEY = 'wordfall-personal-bests-v1'

export interface PersonalBestResult {
  bestScore: number
  isNewBest: boolean
}

export function calculateAccuracy(wordsTyped: number, wordsMissed: number): number {
  const totalWords = wordsTyped + wordsMissed
  return totalWords === 0 ? 0 : Math.round((wordsTyped / totalWords) * 100)
}

export function calculateWpm(charactersTyped: number, elapsedSeconds: number): number {
  if (charactersTyped === 0 || elapsedSeconds <= 0) return 0
  return Math.round((charactersTyped / 5) / (elapsedSeconds / 60))
}

export function updatePersonalBest(
  storage: Storage,
  language: GameLanguage,
  difficulty: DifficultyTier,
  score: number,
): PersonalBestResult {
  try {
    const storedValue = storage.getItem(STORAGE_KEY)
    const bestScores = storedValue ? JSON.parse(storedValue) as Record<string, number> : {}
    const modeKey = `${language}:${difficulty}`
    const previousBest = Number(bestScores[modeKey]) || 0
    const bestScore = Math.max(previousBest, score)
    const isNewBest = score > previousBest

    if (isNewBest) {
      bestScores[modeKey] = bestScore
      storage.setItem(STORAGE_KEY, JSON.stringify(bestScores))
    }

    return { bestScore, isNewBest }
  } catch {
    return { bestScore: score, isNewBest: false }
  }
}