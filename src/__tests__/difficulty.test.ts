import { describe, it, expect } from 'vitest'
import { getDifficulty, getLevel, getLevelProgress, MAX_LEVEL } from '../game/difficulty.ts'

describe('getLevel', () => {
  it('returns 0 for the first 10 seconds', () => {
    expect(getLevel(0)).toBe(0)
    expect(getLevel(5)).toBe(0)
    expect(getLevel(9)).toBe(0)
  })

  it('increments every 10 seconds', () => {
    expect(getLevel(10)).toBe(1)
    expect(getLevel(20)).toBe(2)
    expect(getLevel(30)).toBe(3)
  })

  it('starts at the selected difficulty level', () => {
    expect(getLevel(0, 'hard')).toBe(2)
    expect(getLevel(10, 'hard')).toBe(3)
  })

  it('caps progression at the maximum level', () => {
    expect(getLevel(1000, 'expert')).toBe(MAX_LEVEL)
  })
})

describe('getLevelProgress', () => {
  it('reports progress and seconds until the next level', () => {
    expect(getLevelProgress(4, 'easy')).toEqual({ progress: 0.4, secondsRemaining: 6 })
  })

  it('reports max progression at the level cap', () => {
    expect(getLevelProgress(1000, 'expert')).toEqual({ progress: 1, secondsRemaining: 0 })
  })
})

describe('getDifficulty', () => {
  it('applies the selected tier as the starting difficulty', () => {
    const hardStart = getDifficulty(0, 'hard')
    const easyAfterTwoLevels = getDifficulty(20, 'easy')
    expect(hardStart).toEqual(easyAfterTwoLevels)
    expect(hardStart.tier).toBe('hard')
  })

  it('decreases spawn interval with level', () => {
    const early = getDifficulty(0)
    const late = getDifficulty(20)
    expect(late.spawnIntervalMs).toBeLessThan(early.spawnIntervalMs)
  })

  it('increases max fall speed with level', () => {
    const early = getDifficulty(0)
    const late = getDifficulty(20)
    expect(late.maxFallSpeed).toBeGreaterThan(early.maxFallSpeed)
  })

  it('keeps min fall speed constant', () => {
    const early = getDifficulty(0)
    const late = getDifficulty(100)
    expect(late.minFallSpeed).toBe(early.minFallSpeed)
  })

  it('enforces minimum spawn interval', () => {
    const veryLate = getDifficulty(600)
    expect(veryLate.spawnIntervalMs).toBeGreaterThanOrEqual(800)
  })

  it('max fall speed is always greater than min fall speed', () => {
    const early = getDifficulty(0)
    const late = getDifficulty(100)
    expect(early.maxFallSpeed).toBeGreaterThanOrEqual(early.minFallSpeed)
    expect(late.maxFallSpeed).toBeGreaterThanOrEqual(late.minFallSpeed)
  })
})
