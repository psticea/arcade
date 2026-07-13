import words from '../data/words.json'
import romanianWords from '../data/words-ro.json'
import type { DifficultyConfig } from './difficulty.ts'

export type GameLanguage = 'english' | 'romanian'

export interface FallingWord {
  id: number
  text: string
  x: number
  y: number
  speed: number
  matchedChars: number
  targeted: boolean
}

const MAX_RECENT = 40
const wordPools: Record<GameLanguage, string[]> = {
  english: [...new Set([...words.easy, ...words.medium, ...words.hard, ...words.expert])],
  romanian: romanianWords,
}
const usedRecently: Record<GameLanguage, Set<string>> = {
  english: new Set<string>(),
  romanian: new Set<string>(),
}

function pickWord(language: GameLanguage): string {
  const pool = wordPools[language]
  const recentWords = usedRecently[language]
  const available = pool.filter((word) => !recentWords.has(word))
  const source = available.length > 0 ? available : pool
  const word = source[Math.floor(Math.random() * source.length)]!

  recentWords.add(word)
  if (recentWords.size > MAX_RECENT) {
    const first = recentWords.values().next().value as string
    recentWords.delete(first)
  }

  return word
}

export function spawnWord(
  id: number,
  canvasWidth: number,
  difficulty: DifficultyConfig,
  language: GameLanguage = 'english',
): FallingWord {
  const text = pickWord(language)
  const textWidth = text.length * 18
  const margin = 40
  const x = margin + Math.random() * Math.max(canvasWidth - textWidth - margin * 2, 0)
  const speed = difficulty.minFallSpeed + Math.random() * (difficulty.maxFallSpeed - difficulty.minFallSpeed)

  return {
    id,
    text,
    x,
    y: -30,
    speed,
    matchedChars: 0,
    targeted: false,
  }
}

export function updateWords(wordList: FallingWord[], dt: number): FallingWord[] {
  return wordList.map((w) => ({ ...w, y: w.y + w.speed * dt }))
}

export function findMatchingWord(
  wordList: FallingWord[],
  input: string,
): FallingWord | undefined {
  if (input.length === 0) return undefined

  const lower = input.toLowerCase()
  const candidates = wordList
    .filter((w) => w.text.toLowerCase().startsWith(lower))
    .sort((a, b) => b.y - a.y)

  return candidates[0]
}

export function resetRecentWords(language?: GameLanguage): void {
  if (language) {
    usedRecently[language].clear()
    return
  }

  usedRecently.english.clear()
  usedRecently.romanian.clear()
}
