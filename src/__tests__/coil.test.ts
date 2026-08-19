import { describe, it, expect } from 'vitest'
import { createRng } from '../lib/prng.ts'
import {
  GRID_SIZE,
  MAX_PHASE_CHARGES,
  PHASE_DURATION,
  ROTATE_EVERY,
  SPRINT_SECONDS,
  createState,
  currentSpeed,
  step,
  timeRemaining,
  type CoilInput,
  type CoilState,
} from '../games/coil/simulation.ts'

const DT = 1 / 120
const NEUTRAL: CoilInput = { dx: 0, dy: 0, phase: false }

function run(state: CoilState, seconds: number, input: CoilInput = NEUTRAL, seed = 1) {
  const rng = createRng(seed)
  const events = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.push(step(state, input, DT, rng))
  }
  return events
}

/** Teleport a pickup onto the cell the head is about to enter. */
function placePickupInFront(state: CoilState, kind: 'hot' | 'safe') {
  const head = state.snake[0]!
  const target = { x: head.x + state.direction.x, y: head.y + state.direction.y }
  state.pickups = [{ ...target, kind }]
}

describe('COIL simulation', () => {
  it('starts alive, centred and moving', () => {
    const state = createState(createRng(1))
    expect(state.alive).toBe(true)
    expect(state.snake.length).toBe(3)
    expect(state.direction).toEqual({ x: 1, y: 0 })
    expect(state.score).toBe(0)
  })

  it('is deterministic for the same seed and inputs', () => {
    const play = () => {
      const state = createState(createRng(2024))
      run(state, 3, NEUTRAL, 2024)
      return {
        snake: state.snake,
        score: state.score,
        pickups: state.pickups,
        alive: state.alive,
      }
    }
    expect(play()).toEqual(play())
  })

  it('spawns exactly one hot and one safe pickup', () => {
    const state = createState(createRng(5))
    expect(state.pickups).toHaveLength(2)
    expect(state.pickups.filter((p) => p.kind === 'hot')).toHaveLength(1)
    expect(state.pickups.filter((p) => p.kind === 'safe')).toHaveLength(1)
  })

  it('never spawns a pickup on the snake', () => {
    for (let seed = 0; seed < 40; seed++) {
      const state = createState(createRng(seed))
      const occupied = new Set(state.snake.map((c) => `${c.x},${c.y}`))
      for (const pickup of state.pickups) {
        expect(occupied.has(`${pickup.x},${pickup.y}`)).toBe(false)
        expect(pickup.x).toBeGreaterThanOrEqual(0)
        expect(pickup.y).toBeGreaterThanOrEqual(0)
        expect(pickup.x).toBeLessThan(GRID_SIZE)
        expect(pickup.y).toBeLessThan(GRID_SIZE)
      }
    }
  })

  it('dies on the wall and reports the cause', () => {
    const state = createState(createRng(3))
    state.pickups = []
    const events = run(state, 6)
    expect(state.alive).toBe(false)
    expect(state.cause).toBe('wall')
    expect(events.some((e) => e.died === 'wall')).toBe(true)
  })

  it('ignores a direct reversal instead of instantly killing the player', () => {
    const state = createState(createRng(4))
    state.pickups = []
    step(state, { dx: -1, dy: 0, phase: false }, DT, createRng(1))
    expect(state.pendingDirection).toBeUndefined()
    expect(state.direction).toEqual({ x: 1, y: 0 })
  })

  it('turns when given a perpendicular direction', () => {
    const state = createState(createRng(4))
    state.pickups = []
    run(state, 0.4, { dx: 0, dy: 1, phase: false })
    expect(state.direction).toEqual({ x: 0, y: 1 })
  })

  describe('scoring', () => {
    it('hot pickups build combo, grow by 2 and recharge phase', () => {
      const state = createState(createRng(6))
      state.phaseCharges = 0
      placePickupInFront(state, 'hot')
      run(state, 0.2)
      expect(state.combo).toBe(1)
      expect(state.hotEaten).toBe(1)
      expect(state.phaseCharges).toBe(1)
      expect(state.score).toBe(50)
    })

    it('safe pickups score less and reset the combo', () => {
      const state = createState(createRng(6))
      placePickupInFront(state, 'hot')
      run(state, 0.2)
      expect(state.combo).toBe(1)

      placePickupInFront(state, 'safe')
      run(state, 0.2)
      expect(state.combo).toBe(0)
    })

    it('applies the combo multiplier to pickup value', () => {
      const state = createState(createRng(6))
      state.combo = 4
      placePickupInFront(state, 'hot')
      run(state, 0.2)
      // 50 * (1 + 4 * 0.5) = 150
      expect(state.score).toBe(150)
    })

    it('rewards a greedy hot-only line more than a safe-only line', () => {
      const hotOnly = createState(createRng(9))
      for (let i = 0; i < 6; i++) {
        placePickupInFront(hotOnly, 'hot')
        run(hotOnly, 0.25)
        hotOnly.direction = { x: 1, y: 0 }
        hotOnly.snake = [{ x: 3, y: 3 + i }, { x: 2, y: 3 + i }]
      }

      const safeOnly = createState(createRng(9))
      for (let i = 0; i < 6; i++) {
        placePickupInFront(safeOnly, 'safe')
        run(safeOnly, 0.25)
        safeOnly.direction = { x: 1, y: 0 }
        safeOnly.snake = [{ x: 3, y: 3 + i }, { x: 2, y: 3 + i }]
      }

      expect(hotOnly.score).toBeGreaterThan(safeOnly.score * 3)
    })
  })

  describe('phase', () => {
    it('is spent on use and lets the head cross the body', () => {
      const state = createState(createRng(7))
      state.phaseCharges = 1
      step(state, { dx: 0, dy: 0, phase: true }, DT, createRng(1))
      expect(state.phaseCharges).toBe(0)
      expect(state.phaseTimer).toBeCloseTo(PHASE_DURATION, 5)
    })

    it('cannot be used without a charge', () => {
      const state = createState(createRng(7))
      state.phaseCharges = 0
      const events = step(state, { dx: 0, dy: 0, phase: true }, DT, createRng(1))
      expect(events.phased).toBeUndefined()
      expect(state.phaseTimer).toBe(0)
    })

    it('survives a self-collision while active', () => {
      const state = createState(createRng(8))
      state.pickups = []
      // A tight coil the head must cross to continue.
      state.snake = [
        { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 4 },
        { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 6, y: 6 },
      ]
      state.direction = { x: 0, y: -1 }
      state.growth = 3
      state.phaseCharges = 1
      step(state, { dx: 0, dy: 0, phase: true }, DT, createRng(1))
      run(state, 0.2)
      expect(state.alive).toBe(true)
    })

    it('never exceeds the charge cap', () => {
      const state = createState(createRng(10))
      state.phaseCharges = MAX_PHASE_CHARGES
      placePickupInFront(state, 'hot')
      run(state, 0.2)
      expect(state.phaseCharges).toBe(MAX_PHASE_CHARGES)
    })
  })

  describe('rotation', () => {
    it('rotates the arena every five pickups and never resets the combo', () => {
      const state = createState(createRng(11))
      for (let i = 0; i < ROTATE_EVERY; i++) {
        placePickupInFront(state, 'hot')
        run(state, 0.25)
        // Reset geometry so the run does not end early while we feed pickups.
        state.snake = [{ x: 3, y: 3 }, { x: 2, y: 3 }]
        state.direction = { x: 1, y: 0 }
        state.growth = 0
      }
      expect(state.pickupsEaten).toBe(ROTATE_EVERY)
      expect(state.rotationSteps).toBe(1)
      expect(state.combo).toBe(ROTATE_EVERY)
    })

    it('wraps rotation steps within 0..3', () => {
      const state = createState(createRng(12))
      for (let i = 0; i < ROTATE_EVERY * 5; i++) {
        placePickupInFront(state, 'hot')
        run(state, 0.25)
        state.snake = [{ x: 3, y: 3 }, { x: 2, y: 3 }]
        state.direction = { x: 1, y: 0 }
        state.growth = 0
      }
      expect(state.rotationSteps).toBeGreaterThanOrEqual(0)
      expect(state.rotationSteps).toBeLessThan(4)
    })

    it('telegraphs the rotation one pickup ahead', () => {
      const state = createState(createRng(13))
      for (let i = 0; i < ROTATE_EVERY - 1; i++) {
        placePickupInFront(state, 'hot')
        run(state, 0.25)
        state.snake = [{ x: 3, y: 3 }, { x: 2, y: 3 }]
        state.direction = { x: 1, y: 0 }
        state.growth = 0
      }
      expect(Number.isFinite(state.untilRotation)).toBe(true)
    })
  })

  describe('speed', () => {
    it('scales with combo and caps out', () => {
      const state = createState(createRng(14))
      expect(currentSpeed(state)).toBeCloseTo(6, 5)
      state.combo = 10
      expect(currentSpeed(state)).toBeCloseTo(10, 5)
      state.combo = 1000
      expect(currentSpeed(state)).toBe(20)
    })
  })

  describe('sprint mode', () => {
    it('ends at sixty seconds', () => {
      const state = createState(createRng(15), 'sprint')
      state.pickups = []
      // Keep the snake alive by parking it; only the clock should end the run.
      for (let i = 0; i < Math.round(SPRINT_SECONDS / DT) + 10; i++) {
        state.snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }]
        step(state, NEUTRAL, DT, createRng(1))
        if (!state.alive) break
      }
      expect(state.alive).toBe(false)
      expect(state.cause).toBe('timeup')
    })

    it('reports remaining time', () => {
      const state = createState(createRng(16), 'sprint')
      expect(timeRemaining(state)).toBeCloseTo(SPRINT_SECONDS, 3)
      const endless = createState(createRng(16), 'endless')
      expect(timeRemaining(endless)).toBe(Number.POSITIVE_INFINITY)
    })
  })

  it('does not advance once the run is over', () => {
    const state = createState(createRng(17))
    state.pickups = []
    run(state, 6)
    expect(state.alive).toBe(false)
    const frozen = JSON.stringify(state)
    run(state, 2)
    expect(JSON.stringify(state)).toBe(frozen)
  })
})
