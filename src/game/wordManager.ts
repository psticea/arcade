import words from '../data/words.json'
import type { DifficultyConfig } from './difficulty.ts'

export interface FallingWord {
  id: number
  text: string
  x: number
  y: number
  speed: number
  matchedChars: number
  targeted: boolean
}

const usedRecently = new Set<string>()
const MAX_RECENT = 40
const allWords = [...new Set([...words.easy, ...words.medium, ...words.hard, ...words.expert])]

function pickWord(): string {
  const available = allWords.filter((w) => !usedRecently.has(w))
  const source = available.length > 0 ? available : allWords
  const word = source[Math.floor(Math.random() * source.length)]!

  usedRecently.add(word)
  if (usedRecently.size > MAX_RECENT) {
    const first = usedRecently.values().next().value as string
    usedRecently.delete(first)
  }

  return word
}

export function spawnWord(
  id: number,
  canvasWidth: number,
  difficulty: DifficultyConfig,
): FallingWord {
  const text = pickWord()
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

export function resetRecentWords(): void {
  usedRecently.clear()
}
