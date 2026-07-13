import { beforeEach, describe, expect, it } from 'vitest'
import { calculateAccuracy, calculateWpm, updatePersonalBest } from '../game/runStats.ts'

describe('run metrics', () => {
  it('calculates accuracy from completed and missed words', () => {
    expect(calculateAccuracy(8, 2)).toBe(80)
    expect(calculateAccuracy(0, 0)).toBe(0)
  })

  it('calculates standard five-character words per minute', () => {
    expect(calculateWpm(250, 60)).toBe(50)
    expect(calculateWpm(0, 0)).toBe(0)
  })
})

describe('updatePersonalBest', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the highest score for a mode', () => {
    expect(updatePersonalBest(localStorage, 'english', 'easy', 120)).toEqual({
      bestScore: 120,
      isNewBest: true,
    })
    expect(updatePersonalBest(localStorage, 'english', 'easy', 80)).toEqual({
      bestScore: 120,
      isNewBest: false,
    })
  })

  it('tracks language and difficulty combinations separately', () => {
    updatePersonalBest(localStorage, 'english', 'easy', 120)
    expect(updatePersonalBest(localStorage, 'romanian', 'hard', 50)).toEqual({
      bestScore: 50,
      isNewBest: true,
    })
  })
})