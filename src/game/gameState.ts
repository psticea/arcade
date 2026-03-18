import type { FallingWord } from './wordManager.ts'
import type { Particle } from './particleSystem.ts'

export interface GameState {
  words: FallingWord[]
  particles: Particle[]
  score: number
  combo: number
  lives: number
  level: number
  elapsedTime: number
  lastSpawnTime: number
  nextWordId: number
  wordsTyped: number
  wordsMissed: number
  maxCombo: number
  status: 'playing' | 'gameover'
}

export function createInitialState(): GameState {
  return {
    words: [],
    particles: [],
    score: 0,
    combo: 0,
    lives: 3,
    level: 0,
    elapsedTime: 0,
    lastSpawnTime: 0,
    nextWordId: 1,
    wordsTyped: 0,
    wordsMissed: 0,
    maxCombo: 0,
    status: 'playing',
  }
}
