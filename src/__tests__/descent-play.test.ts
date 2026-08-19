import { describe, it, expect } from 'vitest'
import { createRng } from '../lib/prng.ts'
import { clamp } from '../lib/math.ts'
import {
  MAX_SAFE_SPEED,
  SHIP_RADIUS,
  createState,
  nextCavern,
  padAt,
  step,
  terrainHeightAt,
  type DescentInput,
  type DescentState,
} from '../games/descent/simulation.ts'

const DT = 1 / 120

/**
 * A PD autopilot: hold altitude while translating toward the pad, level out
 * once lined up, then descend at a rate that shrinks with altitude. It exists
 * to prove a landing is actually achievable with the tuned constants — if the
 * flight model is unflyable, this test fails.
 */
function autopilot(state: DescentState, targetMultiplier: number): DescentInput {
  const ship = state.ship
  const pad = state.terrain.pads.find((p) => p.multiplier === targetMultiplier)
  const input: DescentInput = {
    rotateLeft: false, rotateRight: false, thrust: false, survey: false, hardBurn: false,
  }
  if (!pad) return input

  const padX = (pad.left + pad.right) / 2
  const dx = padX - ship.x
  const linedUp = Math.abs(dx) < 0.5

  // Lean to translate: desired lateral velocity, converted into a tilt target.
  const desiredVx = clamp(dx * 0.6, -3, 3)
  const desiredAngle = linedUp && Math.abs(ship.vx) < 0.5
    ? 0
    : clamp((desiredVx - ship.vx) * 0.12, -0.32, 0.32)

  const angleError = desiredAngle - ship.angle
  const control = angleError * 6 - ship.angularVelocity * 2.4
  if (control > 0.15) input.rotateRight = true
  else if (control < -0.15) input.rotateLeft = true

  const ground = terrainHeightAt(state.terrain, ship.x)
  const altitude = ground - (ship.y + SHIP_RADIUS)

  // Hold a safe cruise height until lined up, then ease down onto the pad.
  const desiredVy = linedUp
    ? clamp(0.25 + altitude * 0.35, 0.25, 2.5)
    : clamp((altitude - 14) * 0.8, -2.5, 2.5)

  if (ship.vy > desiredVy && Math.abs(ship.angle) < 0.7) input.thrust = true
  return input
}

function flyTo(seed: number, multiplier: number, seconds = 40) {
  const rng = createRng(seed)
  const state = createState(rng, seed)
  const steps = Math.round(seconds / DT)
  for (let i = 0; i < steps && state.phase === 'flying'; i++) {
    step(state, autopilot(state, multiplier), DT, rng)
  }
  return state
}

describe('DESCENT playability', () => {
  it('an autopilot can land on the wide pad from most starts', () => {
    let landed = 0
    for (let seed = 0; seed < 12; seed++) {
      if (flyTo(seed, 1).phase === 'landed') landed += 1
    }
    // The flight model must be flyable; a simple controller should mostly cope.
    expect(landed).toBeGreaterThanOrEqual(9)
  })

  it('landings are within the safe envelope, not lucky wrecks', () => {
    for (let seed = 0; seed < 12; seed++) {
      const state = flyTo(seed, 1)
      if (state.phase !== 'landed') continue
      const landing = state.lastLanding!
      expect(landing.speed).toBeLessThanOrEqual(MAX_SAFE_SPEED)
      expect(landing.padMultiplier).toBeGreaterThan(0)
      expect(state.score).toBeGreaterThan(0)
    }
  })

  it('the narrow x8 pad is harder to hit than the wide one', () => {
    let wide = 0
    let narrow = 0
    for (let seed = 0; seed < 12; seed++) {
      if (flyTo(seed, 1).phase === 'landed') wide += 1
      if (flyTo(seed, 8).phase === 'landed') narrow += 1
    }
    expect(wide).toBeGreaterThan(narrow)
  })

  it('fuel is a real budget across a multi-cavern run', () => {
    const rng = createRng(3)
    const state = createState(rng, 3)
    let caverns = 0
    for (let attempt = 0; attempt < 6; attempt++) {
      const steps = Math.round(40 / DT)
      for (let i = 0; i < steps && state.phase === 'flying'; i++) {
        step(state, autopilot(state, 1), DT, rng)
      }
      if (state.phase !== 'landed') break
      caverns += 1
      nextCavern(state, rng)
    }
    expect(caverns).toBeGreaterThan(0)
    // No refills: fuel only ever goes down.
    expect(state.fuel).toBeLessThan(100)
  })

  it('a drone that never thrusts always wrecks', () => {
    for (let seed = 0; seed < 8; seed++) {
      const rng = createRng(seed)
      const state = createState(rng, seed)
      const idle: DescentInput = {
        rotateLeft: false, rotateRight: false, thrust: false, survey: false, hardBurn: false,
      }
      for (let i = 0; i < Math.round(30 / DT) && state.phase === 'flying'; i++) {
        step(state, idle, DT, rng)
      }
      expect(state.phase).toBe('wrecked')
    }
  })

  it('the ship stays inside the world for an entire flight', () => {
    for (let seed = 0; seed < 8; seed++) {
      const rng = createRng(seed)
      const state = createState(rng, seed)
      for (let i = 0; i < Math.round(30 / DT) && state.phase === 'flying'; i++) {
        step(state, autopilot(state, 3), DT, rng)
        expect(state.ship.x).toBeGreaterThanOrEqual(SHIP_RADIUS - 0.001)
        expect(state.ship.x).toBeLessThanOrEqual(80 - SHIP_RADIUS + 0.001)
        expect(Number.isFinite(state.ship.y)).toBe(true)
      }
    }
  })

  it('never reports a landing off a pad', () => {
    for (let seed = 0; seed < 12; seed++) {
      const state = flyTo(seed, 3)
      if (state.phase === 'landed') {
        expect(padAt(state.terrain, state.ship.x)).toBeDefined()
      }
    }
  })
})
