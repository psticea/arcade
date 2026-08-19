import type { Rng } from '../../lib/prng.ts'
import { clamp } from '../../lib/math.ts'

/**
 * DESCENT — pure simulation.
 *
 * A survey drone landing in procedurally generated caverns. There is no numeric
 * instrumentation by design: the renderer shows velocity as a vector and fuel as
 * flame length, so all the information here is spatial rather than textual.
 */

export const WORLD_WIDTH = 80
export const WORLD_HEIGHT = 52
export const TERRAIN_STEP = 0.5
export const SHIP_RADIUS = 0.75

export const GRAVITY = 3.2
export const THRUST_ACCEL = 9
export const THRUST_RAMP = 0.25
export const HARD_BURN_MULTIPLIER = 2.2
export const ROTATE_ACCEL = 3.4
export const MAX_ANGULAR_VELOCITY = 2.6

export const FUEL_CAPACITY = 100
export const THRUST_BURN_RATE = 7
export const HARD_BURN_RATE = 21

export const MAX_SAFE_SPEED = 3.2
export const MAX_SAFE_TILT = 0.36
export const PERFECT_SPEED = 1.2
export const PERFECT_TILT = 0.07

export interface Pad {
  /** Left and right world x of the flat surface. */
  left: number
  right: number
  y: number
  multiplier: number
}

export interface Terrain {
  /** Heights sampled every TERRAIN_STEP from x = 0. */
  heights: number[]
  pads: Pad[]
}

export interface Ship {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  angularVelocity: number
  /** 0..1 ramped thrust level, so power builds rather than snapping on. */
  throttle: number
}

export interface DescentInput {
  rotateLeft: boolean
  rotateRight: boolean
  thrust: boolean
  survey: boolean
  hardBurn: boolean
}

export type DescentPhase = 'flying' | 'landed' | 'wrecked'

export interface DescentState {
  ship: Ship
  terrain: Terrain
  fuel: number
  score: number
  /** Permanent run multiplier; every perfect landing adds one. */
  runMultiplier: number
  landings: number
  perfectLandings: number
  cavern: number
  phase: DescentPhase
  /** Set on the frame a landing or wreck resolves, for the shell to react to. */
  lastLanding: LandingResult | undefined
  surveying: boolean
  elapsed: number
  seed: number
}

export interface LandingResult {
  padMultiplier: number
  speed: number
  tilt: number
  softness: number
  perfect: boolean
  points: number
}

export function createTerrain(rng: Rng, cavern: number): Terrain {
  const count = Math.round(WORLD_WIDTH / TERRAIN_STEP) + 1
  const heights = new Array<number>(count)

  // Layered sine ridges give a readable silhouette without a noise dependency.
  const roughness = 1 + cavern * 0.22
  const a = rng.range(0, Math.PI * 2)
  const b = rng.range(0, Math.PI * 2)
  const c = rng.range(0, Math.PI * 2)
  const baseline = WORLD_HEIGHT * 0.72

  for (let i = 0; i < count; i++) {
    const x = i * TERRAIN_STEP
    const ridge =
      Math.sin(x * 0.09 + a) * 4.2 +
      Math.sin(x * 0.21 + b) * 2.1 * roughness +
      Math.sin(x * 0.41 + c) * 0.9 * roughness
    heights[i] = clamp(baseline + ridge, WORLD_HEIGHT * 0.42, WORLD_HEIGHT - 2)
  }

  const pads = carvePads(heights, rng, cavern)
  return { heights, pads }
}

/**
 * Cut three landing pads of decreasing width and increasing reward. The ×8 pad
 * is sunk between two spires so reaching it costs real fuel and real nerve.
 */
function carvePads(heights: number[], rng: Rng, cavern: number): Pad[] {
  const specs: { width: number; multiplier: number }[] = [
    { width: 6 * SHIP_RADIUS * 2, multiplier: 1 },
    { width: 3 * SHIP_RADIUS * 2, multiplier: 3 },
    { width: 1.6 * SHIP_RADIUS * 2, multiplier: 8 },
  ]

  const pads: Pad[] = []
  const slots = [
    { min: 6, max: WORLD_WIDTH / 3 - 4 },
    { min: WORLD_WIDTH / 3 + 4, max: (WORLD_WIDTH * 2) / 3 - 4 },
    { min: (WORLD_WIDTH * 2) / 3 + 4, max: WORLD_WIDTH - 8 },
  ]
  const order = rng.next() < 0.5 ? [0, 1, 2] : [2, 1, 0]

  specs.forEach((spec, index) => {
    const slot = slots[order[index] ?? index]
    if (!slot) return
    const centre = rng.range(slot.min + spec.width, slot.max - spec.width)
    const left = centre - spec.width / 2
    const right = centre + spec.width / 2

    const startIndex = Math.max(0, Math.floor(left / TERRAIN_STEP))
    const endIndex = Math.min(heights.length - 1, Math.ceil(right / TERRAIN_STEP))

    // Deeper pads sit lower, so the valuable ones are also further to fall into.
    const depthBias = spec.multiplier === 8 ? 5 + cavern * 0.4 : spec.multiplier === 3 ? 2 : 0
    let level = 0
    for (let i = startIndex; i <= endIndex; i++) level += heights[i] ?? 0
    level = level / Math.max(1, endIndex - startIndex + 1) + depthBias

    for (let i = startIndex; i <= endIndex; i++) heights[i] = level

    if (spec.multiplier === 8) {
      // Spires either side turn the richest pad into a chasm approach.
      const spireHeight = 9 + cavern * 0.5
      for (let i = 1; i <= 5; i++) {
        const leftIndex = startIndex - i
        const rightIndex = endIndex + i
        const falloff = (6 - i) / 6
        if (leftIndex >= 0) {
          heights[leftIndex] = Math.min(heights[leftIndex] ?? level, level - spireHeight * falloff)
        }
        if (rightIndex < heights.length) {
          heights[rightIndex] = Math.min(heights[rightIndex] ?? level, level - spireHeight * falloff)
        }
      }
    }

    pads.push({ left, right, y: level, multiplier: spec.multiplier })
  })

  return pads
}

export function terrainHeightAt(terrain: Terrain, x: number): number {
  const raw = x / TERRAIN_STEP
  const index = Math.floor(raw)
  if (index < 0) return terrain.heights[0] ?? WORLD_HEIGHT
  if (index >= terrain.heights.length - 1) {
    return terrain.heights[terrain.heights.length - 1] ?? WORLD_HEIGHT
  }
  const a = terrain.heights[index] ?? WORLD_HEIGHT
  const b = terrain.heights[index + 1] ?? WORLD_HEIGHT
  return a + (b - a) * (raw - index)
}

export function padAt(terrain: Terrain, x: number): Pad | undefined {
  return terrain.pads.find((pad) => x >= pad.left && x <= pad.right)
}

export function createState(rng: Rng, seed: number): DescentState {
  const terrain = createTerrain(rng, 0)
  return {
    ship: spawnShip(rng),
    terrain,
    fuel: FUEL_CAPACITY,
    score: 0,
    runMultiplier: 1,
    landings: 0,
    perfectLandings: 0,
    cavern: 0,
    phase: 'flying',
    lastLanding: undefined,
    surveying: false,
    elapsed: 0,
    seed,
  }
}

function spawnShip(rng: Rng): Ship {
  return {
    x: WORLD_WIDTH / 2 + rng.range(-8, 8),
    y: 6,
    vx: rng.range(-1.6, 1.6),
    vy: 0.4,
    angle: 0,
    angularVelocity: 0,
    throttle: 0,
  }
}

/** Advance to the next, harder cavern after a successful landing. */
export function nextCavern(state: DescentState, rng: Rng): void {
  state.cavern += 1
  state.terrain = createTerrain(rng, state.cavern)
  state.ship = spawnShip(rng)
  state.phase = 'flying'
}

export interface DescentEvents {
  landed?: LandingResult
  wrecked?: LandingResult
  thrusting?: boolean
  outOfFuel?: boolean
}

export function step(
  state: DescentState,
  input: DescentInput,
  dt: number,
  _rng: Rng,
): DescentEvents {
  const events: DescentEvents = {}
  if (state.phase !== 'flying') return events

  state.elapsed += dt
  state.surveying = input.survey

  const ship = state.ship

  // Rotation has no damping: stopping a spin means deliberately counter-rotating.
  if (input.rotateLeft) ship.angularVelocity -= ROTATE_ACCEL * dt
  if (input.rotateRight) ship.angularVelocity += ROTATE_ACCEL * dt
  ship.angularVelocity = clamp(ship.angularVelocity, -MAX_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY)
  ship.angle += ship.angularVelocity * dt

  const wantsThrust = input.thrust || input.hardBurn
  const hasFuel = state.fuel > 0
  const target = !hasFuel ? 0 : input.hardBurn ? 1 : input.thrust ? 1 : 0

  // Power ramps in rather than snapping, so a tap is a nudge not a jolt.
  if (target > ship.throttle) {
    ship.throttle = Math.min(target, ship.throttle + dt / THRUST_RAMP)
  } else {
    ship.throttle = Math.max(target, ship.throttle - dt / (THRUST_RAMP * 0.6))
  }

  if (wantsThrust && hasFuel && ship.throttle > 0) {
    const power = THRUST_ACCEL * ship.throttle * (input.hardBurn ? HARD_BURN_MULTIPLIER : 1)
    ship.vx += Math.sin(ship.angle) * power * dt
    ship.vy -= Math.cos(ship.angle) * power * dt
    const burn = (input.hardBurn ? HARD_BURN_RATE : THRUST_BURN_RATE) * ship.throttle * dt
    state.fuel = Math.max(0, state.fuel - burn)
    events.thrusting = true
    if (state.fuel === 0) events.outOfFuel = true
  }

  ship.vy += GRAVITY * dt
  ship.x += ship.vx * dt
  ship.y += ship.vy * dt

  // The cavern is a closed box; the walls bounce rather than kill.
  if (ship.x < SHIP_RADIUS) {
    ship.x = SHIP_RADIUS
    ship.vx = Math.abs(ship.vx) * 0.4
  } else if (ship.x > WORLD_WIDTH - SHIP_RADIUS) {
    ship.x = WORLD_WIDTH - SHIP_RADIUS
    ship.vx = -Math.abs(ship.vx) * 0.4
  }
  if (ship.y < SHIP_RADIUS) {
    ship.y = SHIP_RADIUS
    ship.vy = Math.abs(ship.vy) * 0.3
  }

  const ground = terrainHeightAt(state.terrain, ship.x)
  if (ship.y + SHIP_RADIUS >= ground) {
    resolveContact(state, ground, events)
  }

  return events
}

function resolveContact(state: DescentState, ground: number, events: DescentEvents): void {
  const ship = state.ship
  ship.y = ground - SHIP_RADIUS
  ship.throttle = 0

  const speed = Math.hypot(ship.vx, ship.vy)
  const tilt = Math.abs(normaliseAngle(ship.angle))
  const pad = padAt(state.terrain, ship.x)

  const softness = clamp(1 - speed / MAX_SAFE_SPEED, 0, 1)
  const safe = pad !== undefined && speed <= MAX_SAFE_SPEED && tilt <= MAX_SAFE_TILT
  const perfect = safe && speed <= PERFECT_SPEED && tilt <= PERFECT_TILT

  const result: LandingResult = {
    padMultiplier: pad?.multiplier ?? 0,
    speed,
    tilt,
    softness,
    perfect,
    points: 0,
  }

  if (safe && pad) {
    const fuelFraction = state.fuel / FUEL_CAPACITY
    result.points = Math.round(
      500 * pad.multiplier * state.runMultiplier * softness * (1 + fuelFraction),
    )
    state.score += result.points
    state.landings += 1
    if (perfect) {
      state.perfectLandings += 1
      state.runMultiplier += 1
    }
    state.phase = 'landed'
    state.lastLanding = result
    events.landed = result
  } else {
    state.phase = 'wrecked'
    state.lastLanding = result
    events.wrecked = result
  }

  ship.vx = 0
  ship.vy = 0
  ship.angularVelocity = 0
}

export function normaliseAngle(angle: number): number {
  let value = (angle + Math.PI) % (Math.PI * 2)
  if (value < 0) value += Math.PI * 2
  return value - Math.PI
}

/** 0..1 quality of the current approach, used to colour the target pad. */
export function approachQuality(state: DescentState): number {
  const speed = Math.hypot(state.ship.vx, state.ship.vy)
  const tilt = Math.abs(normaliseAngle(state.ship.angle))
  const speedScore = clamp(1 - speed / MAX_SAFE_SPEED, 0, 1)
  const tiltScore = clamp(1 - tilt / MAX_SAFE_TILT, 0, 1)
  return Math.min(speedScore, tiltScore)
}
