import { describe, expect, it } from 'vitest'
import { createInitialState } from '../game/gameState.ts'

describe('createInitialState', () => {
  it('allows the first word to spawn immediately', () => {
    expect(createInitialState().lastSpawnTime).toBe(Number.NEGATIVE_INFINITY)
  })

  it('starts character tracking at zero', () => {
    expect(createInitialState().charactersTyped).toBe(0)
  })
})