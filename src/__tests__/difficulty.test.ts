import { describe, it, expect } from 'vitest'
import { getDifficulty, getLevel } from '../game/difficulty.ts'

describe('getLevel', () => {
  it('returns 0 for the first 30 seconds', () => {
    expect(getLevel(0)).toBe(0)
    expect(getLevel(15)).toBe(0)
    expect(getLevel(29)).toBe(0)
  })

  it('increments every 30 seconds', () => {
    expect(getLevel(30)).toBe(1)
    expect(getLevel(60)).toBe(2)
    expect(getLevel(90)).toBe(3)
  })
})

describe('getDifficulty', () => {
  it('starts with easy tier', () => {
    const config = getDifficulty(0)
    expect(config.tier).toBe('easy')
    expect(config.minWordLength).toBe(3)
    expect(config.maxWordLength).toBe(4)
  })

  it('progresses to medium tier', () => {
    const config = getDifficulty(30)
    expect(config.tier).toBe('medium')
    expect(config.minWordLength).toBe(4)
  })

  it('progresses to hard tier', () => {
    const config = getDifficulty(60)
    expect(config.tier).toBe('hard')
  })

  it('progresses to expert tier', () => {
    const config = getDifficulty(90)
    expect(config.tier).toBe('expert')
  })

  it('caps at expert tier for very long games', () => {
    const config = getDifficulty(300)
    expect(config.tier).toBe('expert')
  })

  it('decreases spawn interval with level', () => {
    const early = getDifficulty(0)
    const late = getDifficulty(60)
    expect(late.spawnIntervalMs).toBeLessThan(early.spawnIntervalMs)
  })

  it('increases fall speed with level', () => {
    const early = getDifficulty(0)
    const late = getDifficulty(60)
    expect(late.fallSpeed).toBeGreaterThan(early.fallSpeed)
  })

  it('enforces minimum spawn interval', () => {
    const veryLate = getDifficulty(600)
    expect(veryLate.spawnIntervalMs).toBeGreaterThanOrEqual(800)
  })
})
