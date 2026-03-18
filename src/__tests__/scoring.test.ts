import { describe, it, expect } from 'vitest'
import { calculateScore, getMissedPenalty } from '../game/scoring.ts'

describe('calculateScore', () => {
  it('returns base points for no combo and level 0', () => {
    expect(calculateScore(3, 0, 0)).toBe(30)
    expect(calculateScore(5, 0, 0)).toBe(50)
  })

  it('increases with combo multiplier', () => {
    const noCombo = calculateScore(4, 0, 0)
    const withCombo = calculateScore(4, 3, 0)
    expect(withCombo).toBeGreaterThan(noCombo)
  })

  it('increases with level bonus', () => {
    const level0 = calculateScore(4, 0, 0)
    const level3 = calculateScore(4, 0, 3)
    expect(level3).toBeGreaterThan(level0)
  })

  it('caps combo multiplier at 10', () => {
    const combo10 = calculateScore(4, 10, 0)
    const combo15 = calculateScore(4, 15, 0)
    expect(combo10).toBe(combo15)
  })

  it('combines combo and level bonuses', () => {
    const score = calculateScore(5, 5, 2)
    expect(score).toBeGreaterThan(0)
    expect(typeof score).toBe('number')
    expect(Number.isInteger(score)).toBe(true)
  })
})

describe('getMissedPenalty', () => {
  it('returns a positive penalty', () => {
    expect(getMissedPenalty(0)).toBeGreaterThan(0)
  })

  it('increases with level', () => {
    expect(getMissedPenalty(3)).toBeGreaterThan(getMissedPenalty(0))
  })
})
