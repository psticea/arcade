import { describe, it, expect, beforeEach } from 'vitest'
import { spawnWord, updateWords, findMatchingWord, resetRecentWords, type FallingWord } from '../game/wordManager.ts'
import type { DifficultyConfig } from '../game/difficulty.ts'

const baseConfig: DifficultyConfig = {
  spawnIntervalMs: 2500,
  minFallSpeed: 25,
  maxFallSpeed: 30,
  maxWordsOnScreen: 4,
}

describe('spawnWord', () => {
  beforeEach(() => resetRecentWords())

  it('creates a word with correct initial properties', () => {
    const word = spawnWord(1, 800, baseConfig)
    expect(word.id).toBe(1)
    expect(word.text.length).toBeGreaterThanOrEqual(1)
    expect(word.text.length).toBeLessThanOrEqual(10)
    expect(word.y).toBe(-30)
    expect(word.speed).toBeGreaterThanOrEqual(baseConfig.minFallSpeed)
    expect(word.speed).toBeLessThanOrEqual(baseConfig.maxFallSpeed)
    expect(word.matchedChars).toBe(0)
    expect(word.targeted).toBe(false)
  })

  it('positions word within canvas bounds', () => {
    const word = spawnWord(1, 800, baseConfig)
    expect(word.x).toBeGreaterThanOrEqual(0)
    expect(word.x).toBeLessThan(800)
  })
})

describe('updateWords', () => {
  it('moves words down by speed * dt', () => {
    const words: FallingWord[] = [
      { id: 1, text: 'test', x: 100, y: 0, speed: 50, matchedChars: 0, targeted: false },
    ]
    const updated = updateWords(words, 0.5)
    expect(updated[0]!.y).toBe(25)
  })
})

describe('findMatchingWord', () => {
  const words: FallingWord[] = [
    { id: 1, text: 'apple', x: 100, y: 50, speed: 30, matchedChars: 0, targeted: false },
    { id: 2, text: 'art', x: 200, y: 100, speed: 30, matchedChars: 0, targeted: false },
    { id: 3, text: 'banana', x: 300, y: 75, speed: 30, matchedChars: 0, targeted: false },
  ]

  it('returns undefined for empty input', () => {
    expect(findMatchingWord(words, '')).toBeUndefined()
  })

  it('finds matching word by prefix', () => {
    const match = findMatchingWord(words, 'ban')
    expect(match?.text).toBe('banana')
  })

  it('prioritizes the word closest to the bottom', () => {
    const match = findMatchingWord(words, 'a')
    expect(match?.text).toBe('art')
  })

  it('returns undefined when no words match', () => {
    expect(findMatchingWord(words, 'xyz')).toBeUndefined()
  })
})
