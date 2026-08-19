import { describe, it, expect } from 'vitest'
import { createRng } from '../lib/prng.ts'
import {
  FUEL_CAPACITY,
  GRAVITY,
  MAX_SAFE_SPEED,
  MAX_SAFE_TILT,
  PERFECT_SPEED,
  PERFECT_TILT,
  SHIP_RADIUS,
  TERRAIN_STEP,
  WORLD_WIDTH,
  approachQuality,
  createState,
  createTerrain,
  nextCavern,
  normaliseAngle,
  padAt,
  step,
  terrainHeightAt,
  type DescentInput,
  type DescentState,
} from '../games/descent/simulation.ts'

const DT = 1 / 120
const IDLE: DescentInput = {
  rotateLeft: false, rotateRight: false, thrust: false, survey: false, hardBurn: false,
}

function run(state: DescentState, seconds: number, input: DescentInput = IDLE, seed = 1) {
  const rng = createRng(seed)
  const events = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.push(step(state, input, DT, rng))
  }
  return events
}

describe('DESCENT terrain', () => {
  it('is deterministic for a seed', () => {
    const a = createTerrain(createRng(42), 0)
    const b = createTerrain(createRng(42), 0)
    expect(a.heights).toEqual(b.heights)
    expect(a.pads).toEqual(b.pads)
  })

  it('differs between seeds', () => {
    const a = createTerrain(createRng(1), 0)
    const b = createTerrain(createRng(2), 0)
    expect(a.heights).not.toEqual(b.heights)
  })

  it('always produces the three pad tiers', () => {
    for (let seed = 0; seed < 40; seed++) {
      const terrain = createTerrain(createRng(seed), 0)
      const multipliers = terrain.pads.map((p) => p.multiplier).sort((a, b) => a - b)
      expect(multipliers).toEqual([1, 3, 8])
    }
  })

  it('makes richer pads narrower', () => {
    for (let seed = 0; seed < 20; seed++) {
      const terrain = createTerrain(createRng(seed), 0)
      const byMultiplier = new Map(terrain.pads.map((p) => [p.multiplier, p.right - p.left]))
      const wide = byMultiplier.get(1) ?? 0
      const medium = byMultiplier.get(3) ?? 0
      const narrow = byMultiplier.get(8) ?? 0
      expect(wide).toBeGreaterThan(medium)
      expect(medium).toBeGreaterThan(narrow)
    }
  })

  it('keeps pads inside the world and truly flat', () => {
    for (let seed = 0; seed < 20; seed++) {
      const terrain = createTerrain(createRng(seed), 0)
      for (const pad of terrain.pads) {
        expect(pad.left).toBeGreaterThanOrEqual(0)
        expect(pad.right).toBeLessThanOrEqual(WORLD_WIDTH)
        const samples = 6
        for (let i = 0; i <= samples; i++) {
          const x = pad.left + ((pad.right - pad.left) * i) / samples
          expect(terrainHeightAt(terrain, x)).toBeCloseTo(pad.y, 4)
        }
      }
    }
  })

  it('pads do not overlap', () => {
    for (let seed = 0; seed < 30; seed++) {
      const pads = [...createTerrain(createRng(seed), 0).pads].sort((a, b) => a.left - b.left)
      for (let i = 1; i < pads.length; i++) {
        expect(pads[i]!.left).toBeGreaterThan(pads[i - 1]!.right)
      }
    }
  })

  it('padAt finds a pad only within its span', () => {
    const terrain = createTerrain(createRng(3), 0)
    const pad = terrain.pads[0]!
    expect(padAt(terrain, (pad.left + pad.right) / 2)).toBe(pad)
    expect(padAt(terrain, pad.left - TERRAIN_STEP * 4)).not.toBe(pad)
  })
})

describe('DESCENT flight model', () => {
  it('falls under gravity with no thrust', () => {
    const state = createState(createRng(5), 5)
    const before = state.ship.vy
    run(state, 0.5)
    expect(state.ship.vy).toBeGreaterThan(before)
    expect(state.ship.vy).toBeCloseTo(before + GRAVITY * 0.5, 1)
  })

  it('thrust opposes gravity and burns fuel', () => {
    const state = createState(createRng(5), 5)
    state.ship.angle = 0
    state.ship.vy = 0
    run(state, 0.6, { ...IDLE, thrust: true })
    expect(state.fuel).toBeLessThan(FUEL_CAPACITY)
    // With ramping, half a second of thrust should already beat gravity.
    expect(state.ship.vy).toBeLessThan(GRAVITY * 0.6)
  })

  it('hard burn costs materially more fuel than normal thrust', () => {
    const normal = createState(createRng(5), 5)
    run(normal, 1, { ...IDLE, thrust: true })
    const hard = createState(createRng(5), 5)
    run(hard, 1, { ...IDLE, hardBurn: true })
    expect(FUEL_CAPACITY - hard.fuel).toBeGreaterThan((FUEL_CAPACITY - normal.fuel) * 2)
  })

  it('rotation does not damp — a spin persists after release', () => {
    const state = createState(createRng(6), 6)
    run(state, 0.3, { ...IDLE, rotateLeft: true })
    const spin = state.ship.angularVelocity
    expect(spin).toBeLessThan(0)
    run(state, 0.3)
    expect(state.ship.angularVelocity).toBeCloseTo(spin, 6)
  })

  it('counter-rotation cancels a spin', () => {
    const state = createState(createRng(6), 6)
    run(state, 0.3, { ...IDLE, rotateLeft: true })
    run(state, 0.3, { ...IDLE, rotateRight: true })
    expect(Math.abs(state.ship.angularVelocity)).toBeLessThan(0.05)
  })

  it('throttle ramps rather than snapping to full', () => {
    const state = createState(createRng(7), 7)
    step(state, { ...IDLE, thrust: true }, DT, createRng(1))
    expect(state.ship.throttle).toBeGreaterThan(0)
    expect(state.ship.throttle).toBeLessThan(0.2)
  })

  it('cannot thrust once the tanks are dry', () => {
    const state = createState(createRng(8), 8)
    state.fuel = 0
    const before = state.ship.vy
    run(state, 0.4, { ...IDLE, thrust: true })
    expect(state.fuel).toBe(0)
    expect(state.ship.vy).toBeGreaterThan(before)
  })

  it('bounces off the cavern walls instead of ending the run', () => {
    const state = createState(createRng(9), 9)
    state.ship.x = SHIP_RADIUS + 0.05
    state.ship.vx = -8
    run(state, 0.1)
    expect(state.ship.x).toBeGreaterThanOrEqual(SHIP_RADIUS)
    expect(state.ship.vx).toBeGreaterThan(0)
    expect(state.phase).toBe('flying')
  })

  it('is deterministic for identical seeds and inputs', () => {
    const play = () => {
      const state = createState(createRng(1234), 1234)
      run(state, 2, { ...IDLE, thrust: true, rotateLeft: true }, 1234)
      return JSON.stringify(state)
    }
    expect(play()).toBe(play())
  })
})

/** Place the drone already in contact with a chosen pad at a given speed and tilt. */
function dropOnto(
  state: DescentState,
  multiplier: number,
  speed: number,
  tilt: number,
): DescentState {
  const pad = state.terrain.pads.find((p) => p.multiplier === multiplier)!
  state.ship.x = (pad.left + pad.right) / 2
  state.ship.y = pad.y - SHIP_RADIUS + 0.05
  state.ship.vx = 0
  state.ship.vy = speed
  state.ship.angle = tilt
  state.ship.angularVelocity = 0
  step(state, IDLE, DT, createRng(1))
  return state
}

describe('DESCENT landing', () => {
  it('a gentle upright touchdown on a pad succeeds', () => {
    const state = dropOnto(createState(createRng(11), 11), 1, 0.5, 0)
    expect(state.phase).toBe('landed')
    expect(state.landings).toBe(1)
    expect(state.score).toBeGreaterThan(0)
  })

  it('too fast wrecks the drone', () => {
    const state = dropOnto(createState(createRng(11), 11), 1, MAX_SAFE_SPEED + 2, 0)
    expect(state.phase).toBe('wrecked')
    expect(state.score).toBe(0)
  })

  it('too tilted wrecks the drone', () => {
    const state = dropOnto(createState(createRng(11), 11), 1, 0.5, MAX_SAFE_TILT + 0.2)
    expect(state.phase).toBe('wrecked')
  })

  it('landing off-pad wrecks the drone', () => {
    const state = createState(createRng(12), 12)
    // Find an x that is not on any pad.
    let x = 2
    while (padAt(state.terrain, x) && x < WORLD_WIDTH - 2) x += 1
    state.ship.x = x
    state.ship.y = terrainHeightAt(state.terrain, x) - SHIP_RADIUS + 0.05
    state.ship.vy = 0.4
    state.ship.angle = 0
    step(state, IDLE, DT, createRng(1))
    expect(state.phase).toBe('wrecked')
  })

  it('a perfect landing banks a permanent run multiplier', () => {
    const state = dropOnto(createState(createRng(13), 13), 1, PERFECT_SPEED * 0.5, PERFECT_TILT * 0.5)
    expect(state.lastLanding?.perfect).toBe(true)
    expect(state.perfectLandings).toBe(1)
    expect(state.runMultiplier).toBe(2)
  })

  it('a merely safe landing does not raise the run multiplier', () => {
    const state = dropOnto(createState(createRng(13), 13), 1, MAX_SAFE_SPEED * 0.8, 0)
    expect(state.phase).toBe('landed')
    expect(state.lastLanding?.perfect).toBe(false)
    expect(state.runMultiplier).toBe(1)
  })

  it('richer pads pay more for the same landing', () => {
    const cheap = dropOnto(createState(createRng(14), 14), 1, 0.4, 0)
    const rich = dropOnto(createState(createRng(14), 14), 8, 0.4, 0)
    expect(rich.score).toBeGreaterThan(cheap.score * 4)
  })

  it('softer landings pay more than harder ones', () => {
    const soft = dropOnto(createState(createRng(15), 15), 3, 0.3, 0)
    const hard = dropOnto(createState(createRng(15), 15), 3, MAX_SAFE_SPEED * 0.9, 0)
    expect(soft.score).toBeGreaterThan(hard.score)
  })

  it('unspent fuel increases the payout', () => {
    const full = dropOnto(createState(createRng(16), 16), 3, 0.4, 0)
    const empty = createState(createRng(16), 16)
    empty.fuel = 0
    dropOnto(empty, 3, 0.4, 0)
    expect(full.score).toBeGreaterThan(empty.score)
  })

  it('the run multiplier compounds across landings', () => {
    const state = createState(createRng(17), 17)
    state.runMultiplier = 5
    dropOnto(state, 1, 0.4, 0)
    const boosted = state.score

    const plain = createState(createRng(17), 17)
    dropOnto(plain, 1, 0.4, 0)
    expect(boosted).toBeCloseTo(plain.score * 5, -1)
  })

  it('advances to a fresh, harder cavern after landing', () => {
    const state = dropOnto(createState(createRng(18), 18), 1, 0.4, 0)
    const first = state.terrain.heights.slice()
    nextCavern(state, createRng(19))
    expect(state.cavern).toBe(1)
    expect(state.phase).toBe('flying')
    expect(state.terrain.heights).not.toEqual(first)
    expect(state.ship.y).toBeLessThan(10)
  })

  it('does not keep simulating once wrecked', () => {
    const state = dropOnto(createState(createRng(20), 20), 1, MAX_SAFE_SPEED + 4, 0)
    const frozen = JSON.stringify(state)
    run(state, 1)
    expect(JSON.stringify(state)).toBe(frozen)
  })
})

describe('DESCENT feedback', () => {
  it('approach quality falls as speed rises', () => {
    const state = createState(createRng(21), 21)
    state.ship.vx = 0
    state.ship.vy = 0
    state.ship.angle = 0
    const calm = approachQuality(state)
    state.ship.vy = MAX_SAFE_SPEED * 0.95
    const rushed = approachQuality(state)
    expect(calm).toBeGreaterThan(rushed)
    expect(calm).toBeLessThanOrEqual(1)
    expect(rushed).toBeGreaterThanOrEqual(0)
  })

  it('approach quality falls as tilt rises', () => {
    const state = createState(createRng(21), 21)
    state.ship.vx = 0
    state.ship.vy = 0
    state.ship.angle = 0
    const level = approachQuality(state)
    state.ship.angle = MAX_SAFE_TILT * 0.9
    expect(approachQuality(state)).toBeLessThan(level)
  })

  it('normaliseAngle wraps into -PI..PI', () => {
    expect(normaliseAngle(0)).toBeCloseTo(0, 6)
    expect(normaliseAngle(Math.PI * 2)).toBeCloseTo(0, 6)
    expect(normaliseAngle(Math.PI * 2.5)).toBeCloseTo(Math.PI * 0.5, 6)
    expect(normaliseAngle(-Math.PI * 2.5)).toBeCloseTo(-Math.PI * 0.5, 6)
  })
})
