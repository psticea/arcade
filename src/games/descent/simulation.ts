import type { Rng } from '../../lib/prng.ts'
import { clamp } from '../../lib/math.ts'
import { fbm2 } from '../../lib/noise.ts'

/**
 * DESCENT — pure simulation.
 *
 * A survey drone flying down into procedurally generated caverns. There is no
 * numeric instrumentation by design: the renderer shows velocity as a vector,
 * fuel as flame length and attitude as the drone itself, so all the information
 * here is spatial rather than textual.
 *
 * Three things make the loop work, and they pull against each other:
 *
 * 1. **Fuel is the run.** It is never topped up for free — a landing returns
 *    fuel in proportion to how well it was flown, so a run ends when the pilot
 *    stops flying well, not when a timer expires.
 * 2. **The rich pads cost fuel to reach.** The x8 sits in a chasm between
 *    spires, so the pad that pays best is also the one that eats the resource
 *    keeping you alive.
 * 3. **The cavern closes in.** Every landing generates a rougher cave with
 *    longer stalactites, so the same flying buys less clearance each time.
 */

export const WORLD_WIDTH = 80
export const WORLD_HEIGHT = 52
export const TERRAIN_STEP = 0.5
export const SHIP_RADIUS = 0.75
/** Half the distance between the landing legs, in world units. */
export const LEG_SPREAD = 0.72

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

/** Above this closing speed, touching the roof is a wreck rather than a scrape. */
export const CEILING_SAFE_SPEED = 2.6
/** Altitude below which the exhaust starts pushing back off the rock. */
export const GROUND_EFFECT_HEIGHT = 4.5
export const GROUND_EFFECT_BOOST = 0.16

/** Fuel returned by a landing, before the quality and perfection bonuses. */
export const REFUEL_BASE = 22
export const REFUEL_QUALITY = 26
export const REFUEL_PERFECT = 16
/**
 * How much of a landing's fuel actually makes it into the tanks, per cavern.
 *
 * The drone is getting further from resupply, so recovery thins out with depth.
 * Without this the cave stops being able to end a run: clearance bottoms out at
 * MIN_CLEARANCE, so a pilot good enough to land cleanly could descend forever.
 * This is the clock, and it is one the player can hear ticking — the tank comes
 * back less full every time.
 */
export const REFUEL_DECAY = 0.05
export const REFUEL_FLOOR = 0.3

/** The cave never pinches tighter than this between roof and floor. */
export const MIN_CLEARANCE = 11

export interface Pad {
  /** Left and right world x of the flat surface. */
  left: number
  right: number
  y: number
  multiplier: number
}

export interface Terrain {
  /** Floor heights sampled every TERRAIN_STEP from x = 0. */
  heights: number[]
  /** Roof heights on the same sampling. Lower y is higher up. */
  ceilings: number[]
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
  /** Fuel actually recovered, after the capacity cap. */
  refuel: number
}

/**
 * Build a cavern.
 *
 * The floor is layered value noise rather than a sum of three sines: sines
 * repeat on a visible period, and by the fourth cavern the player recognises
 * the same ridge coming back. The roof is a second, independent field with
 * stalactites hung off it, and the two are then forced apart so the cave can
 * never pinch shut.
 */
export function createTerrain(rng: Rng, cavern: number): Terrain {
  const count = Math.round(WORLD_WIDTH / TERRAIN_STEP) + 1
  const heights = new Array<number>(count)
  const ceilings = new Array<number>(count)

  const roughness = 1 + cavern * 0.2
  const floorSeed = rng.range(0, 900)
  const roofSeed = rng.range(0, 900)
  const baseline = WORLD_HEIGHT * 0.72
  // The roof keeps descending for the whole plausible length of a run, so the
  // cave is still closing in at the depth where fuel finally runs out.
  const roofBase = 5 + Math.min(cavern * 0.45, 7)

  for (let i = 0; i < count; i++) {
    const x = i * TERRAIN_STEP
    const floor = (fbm2(x * 0.045 + floorSeed, floorSeed * 0.31, 3) - 0.5) * 13 * roughness
      + (fbm2(x * 0.17 + floorSeed, 40 + floorSeed * 0.11, 2) - 0.5) * 4 * roughness
    heights[i] = clamp(baseline + floor, WORLD_HEIGHT * 0.42, WORLD_HEIGHT - 2)

    const roof = (fbm2(x * 0.05 + roofSeed, roofSeed * 0.27, 3) - 0.5) * 6
    ceilings[i] = clamp(roofBase + roof, 1.2, 12)
  }

  hangStalactites(ceilings, rng, cavern)
  const pads = carvePads(heights, rng, cavern)
  openClearance(heights, ceilings, pads)

  return { heights, ceilings, pads }
}

/**
 * Hang stalactites off the roof.
 *
 * They are part of the collision profile, not decoration painted on top of it:
 * a spike that looks like it will take the drone's head off has to actually be
 * able to, or the cave stops being something the player can read.
 */
function hangStalactites(ceilings: number[], rng: Rng, cavern: number): void {
  const count = 3 + Math.min(cavern, 12)
  for (let s = 0; s < count; s++) {
    const centre = rng.range(4, WORLD_WIDTH - 4)
    const length = rng.range(2.5, 5 + Math.min(cavern * 0.7, 10))
    const halfWidth = rng.range(1.1, 2.4)
    const from = Math.max(0, Math.floor((centre - halfWidth) / TERRAIN_STEP))
    const to = Math.min(ceilings.length - 1, Math.ceil((centre + halfWidth) / TERRAIN_STEP))

    for (let i = from; i <= to; i++) {
      const x = i * TERRAIN_STEP
      // Smoothstep taper: a solid root and a fine point, not a triangle.
      const t = clamp(1 - Math.abs(x - centre) / halfWidth, 0, 1)
      ceilings[i] = (ceilings[i] ?? 0) + length * t * t * (3 - 2 * t)
    }
  }
}

/**
 * Cut three landing pads of decreasing width and increasing reward. The x8 pad
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

/**
 * Force roof and floor apart.
 *
 * Generation is two independent fields, so nothing stops a stalactite growing
 * down into a spire and sealing the cave. Rather than reject and retry — which
 * would make generation take an unbounded time — the roof is simply lifted
 * wherever the gap has closed, and lifted further above the pads so every pad
 * keeps a column of clear air to descend through.
 */
function openClearance(heights: number[], ceilings: number[], pads: Pad[]): void {
  for (const pad of pads) {
    const from = Math.max(0, Math.floor((pad.left - 5) / TERRAIN_STEP))
    const to = Math.min(ceilings.length - 1, Math.ceil((pad.right + 5) / TERRAIN_STEP))
    for (let i = from; i <= to; i++) {
      ceilings[i] = Math.min(ceilings[i] ?? 0, Math.max(1.5, pad.y - MIN_CLEARANCE - 8))
    }
  }

  for (let i = 0; i < ceilings.length; i++) {
    const floor = heights[i] ?? WORLD_HEIGHT
    const roof = ceilings[i] ?? 0
    if (floor - roof < MIN_CLEARANCE) ceilings[i] = floor - MIN_CLEARANCE
    ceilings[i] = Math.max(1, ceilings[i] ?? 1)
  }
}

function sampleProfile(profile: number[], x: number, fallback: number): number {
  const raw = x / TERRAIN_STEP
  const index = Math.floor(raw)
  if (index < 0) return profile[0] ?? fallback
  if (index >= profile.length - 1) return profile[profile.length - 1] ?? fallback
  const a = profile[index] ?? fallback
  const b = profile[index + 1] ?? fallback
  return a + (b - a) * (raw - index)
}

export function terrainHeightAt(terrain: Terrain, x: number): number {
  return sampleProfile(terrain.heights, x, WORLD_HEIGHT)
}

export function terrainCeilingAt(terrain: Terrain, x: number): number {
  return sampleProfile(terrain.ceilings, x, 0)
}

export function padAt(terrain: Terrain, x: number): Pad | undefined {
  return terrain.pads.find((pad) => x >= pad.left && x <= pad.right)
}

/** Clearance between the drone's belly and the rock directly beneath it. */
export function altitude(state: DescentState): number {
  return Math.max(0, terrainHeightAt(state.terrain, state.ship.x) - state.ship.y - SHIP_RADIUS)
}

export function createState(rng: Rng, seed: number): DescentState {
  const terrain = createTerrain(rng, 0)
  return {
    ship: spawnShip(rng, terrain),
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

/** Drop in below the roof, never inside it. */
function spawnShip(rng: Rng, terrain: Terrain): Ship {
  const x = clamp(WORLD_WIDTH / 2 + rng.range(-8, 8), 6, WORLD_WIDTH - 6)
  const roof = terrainCeilingAt(terrain, x)
  return {
    x,
    y: roof + 3.5,
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
  state.ship = spawnShip(rng, state.terrain)
  state.phase = 'flying'
  state.lastLanding = undefined
}

export interface DescentEvents {
  landed?: LandingResult
  wrecked?: LandingResult
  thrusting?: boolean
  outOfFuel?: boolean
  /** A survivable scrape along the roof. */
  scraped?: boolean
  /** 0..1 — how hard the exhaust is blowing dust off the rock below. */
  groundEffect?: number
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

  // Ground effect: exhaust bouncing off close rock gives a little back. Small
  // enough that it never rescues a bad approach, large enough that a pilot who
  // notices it starts hovering into pads instead of dropping onto them.
  const proximity = clamp(1 - altitude(state) / GROUND_EFFECT_HEIGHT, 0, 1)
  events.groundEffect = proximity

  if (wantsThrust && hasFuel && ship.throttle > 0) {
    const cushion = 1 + GROUND_EFFECT_BOOST * proximity
    const power = THRUST_ACCEL * ship.throttle * (input.hardBurn ? HARD_BURN_MULTIPLIER : 1) * cushion
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

  // The cavern is a closed box; the side walls bounce rather than kill.
  if (ship.x < SHIP_RADIUS) {
    ship.x = SHIP_RADIUS
    ship.vx = Math.abs(ship.vx) * 0.4
  } else if (ship.x > WORLD_WIDTH - SHIP_RADIUS) {
    ship.x = WORLD_WIDTH - SHIP_RADIUS
    ship.vx = -Math.abs(ship.vx) * 0.4
  }

  const roof = terrainCeilingAt(state.terrain, ship.x)
  if (ship.y - SHIP_RADIUS <= roof) {
    // Drifting into the roof is a scrape. Driving into a stalactite is not.
    const closing = Math.hypot(ship.vx, ship.vy)
    ship.y = roof + SHIP_RADIUS
    if (closing > CEILING_SAFE_SPEED) {
      wreck(state, events)
      return events
    }
    ship.vy = Math.abs(ship.vy) * 0.3
    ship.vx *= 0.85
    events.scraped = true
  }

  const ground = groundUnderLegs(state)
  if (ship.y + SHIP_RADIUS >= ground) {
    resolveContact(state, ground, events)
  }

  return events
}

/**
 * The rock under whichever leg reaches it first.
 *
 * Sampling only the centre lets the drone settle with a leg hanging over the
 * lip of a pad, which looks wrong and plays worse — the narrow x8 in particular
 * stops being a precision problem if only the middle has to be over rock.
 */
export function groundUnderLegs(state: DescentState): number {
  const { ship, terrain } = state
  const cos = Math.cos(ship.angle)
  let highest = Infinity
  for (const side of [-1, 1]) {
    highest = Math.min(highest, terrainHeightAt(terrain, ship.x + cos * LEG_SPREAD * side))
  }
  return highest
}

function wreck(state: DescentState, events: DescentEvents): void {
  const ship = state.ship
  const result: LandingResult = {
    padMultiplier: 0,
    speed: Math.hypot(ship.vx, ship.vy),
    tilt: Math.abs(normaliseAngle(ship.angle)),
    softness: 0,
    perfect: false,
    points: 0,
    refuel: 0,
  }
  state.phase = 'wrecked'
  state.lastLanding = result
  events.wrecked = result
  ship.vx = 0
  ship.vy = 0
  ship.angularVelocity = 0
  ship.throttle = 0
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
    refuel: 0,
  }

  ship.vx = 0
  ship.vy = 0
  ship.angularVelocity = 0

  if (safe && pad) {
    const fuelFraction = state.fuel / FUEL_CAPACITY
    result.points = Math.round(
      500 * pad.multiplier * state.runMultiplier * softness * (1 + fuelFraction),
    )
    // Fuel comes back in proportion to how well the landing was flown, never
    // all of it, and less of it the deeper the drone has gone. That decay is
    // the run's clock: the cave alone cannot end a run, because clearance
    // bottoms out, but a thinning tank always will.
    const offered = (REFUEL_BASE + REFUEL_QUALITY * softness + (perfect ? REFUEL_PERFECT : 0))
      * refuelScale(state.cavern)
    result.refuel = Math.max(0, Math.min(offered, FUEL_CAPACITY - state.fuel))
    state.fuel += result.refuel

    state.score += result.points
    state.landings += 1
    if (perfect) {
      state.perfectLandings += 1
      state.runMultiplier += 1
    }
    state.phase = 'landed'
    state.lastLanding = result
    events.landed = result
    return
  }

  state.phase = 'wrecked'
  state.lastLanding = result
  events.wrecked = result
}

/** Fraction of a landing's fuel that reaches the tanks at a given depth. */
export function refuelScale(cavern: number): number {
  return Math.max(REFUEL_FLOOR, 1 - cavern * REFUEL_DECAY)
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
