import { describe, it, expect } from 'vitest'
import { getDifficulty, getLevel } from '../game/difficulty.ts'

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
})

describe('getDifficulty', () => {
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
