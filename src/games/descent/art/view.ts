import type { Rng } from '../../../lib/prng.ts'
import { clamp, damp } from '../../../lib/math.ts'
import {
  GROUND_EFFECT_HEIGHT,
  SHIP_RADIUS,
  altitude,
  terrainHeightAt,
  type DescentState,
} from '../simulation.ts'

/**
 * Presentation state for DESCENT.
 *
 * The simulation is pure and knows nothing about dust or suspension travel, so
 * everything the eye needs but the physics does not lives here and is advanced
 * on the same fixed timestep from a seeded stream. Pools are sized once.
 */

const DUST_COUNT = 140

export interface Camera {
  angle: number
  /** World units visible vertically. Drives zoom. */
  view: number
  /** Where the camera is actually looking, damped behind the drone. */
  x: number
  y: number
}

export interface DustMote {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  /** 0 normal exhaust, 1 hard burn — hotter and shorter-lived. */
  heat: number
}

export interface DescentView {
  time: number
  camera: Camera
  /** 0 extended, 1 fully compressed. Springs on touchdown. */
  legs: number
  legVelocity: number
  /** Lamp brightness, wandering slightly so the pool of light is never static. */
  lamp: number
  dust: DustMote[]
  dustCursor: number
  sinceDust: number
  /** 1 → 0 after a landing resolves. */
  landFlash: number
  /** 1 → 0 after scraping the roof. */
  scrapeFlash: number
  /** Seconds since the drone was wrecked, for the settle-and-fade. */
  wreckedFor: number
  lastLandings: number
  rng: Rng
}

export function createView(rng: Rng, state: DescentState): DescentView {
  return {
    time: 0,
    camera: { angle: 0, view: 46, x: state.ship.x, y: state.ship.y },
    legs: 0,
    legVelocity: 0,
    lamp: 1,
    dust: Array.from({ length: DUST_COUNT }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 0.1, heat: 0,
    })),
    dustCursor: 0,
    sinceDust: 0,
    landFlash: 0,
    scrapeFlash: 0,
    wreckedFor: 0,
    lastLandings: 0,
    rng,
  }
}

export interface ViewSignals {
  thrusting: boolean
  hardBurn: boolean
  groundEffect: number
  scraped: boolean
  landed: boolean
  wrecked: boolean
}

export function updateView(
  view: DescentView,
  state: DescentState,
  signals: ViewSignals,
  dt: number,
): void {
  view.time += dt

  if (signals.landed) view.landFlash = 1
  if (signals.scraped) view.scrapeFlash = 1
  view.landFlash = Math.max(0, view.landFlash - dt * 1.6)
  view.scrapeFlash = Math.max(0, view.scrapeFlash - dt * 3.2)
  if (state.phase === 'wrecked') view.wreckedFor += dt

  // --- Suspension -------------------------------------------------------------
  // The legs take the landing so the hull does not have to. Compression is a
  // spring driven by descent rate on contact, and it is the only thing that
  // makes a soft touchdown *look* soft.
  const target = state.phase === 'landed' ? clamp(1 - (state.lastLanding?.softness ?? 1), 0.12, 1) : 0
  if (signals.landed) view.legVelocity += clamp(state.ship.vy * 0.6 + 0.9, 0.4, 3)
  view.legVelocity += (target - view.legs) * 90 * dt
  view.legVelocity *= Math.exp(-9 * dt)
  view.legs = clamp(view.legs + view.legVelocity * dt, 0, 1)

  // A lamp that wanders slightly keeps the pool of light from looking painted on.
  const flicker = 0.94 + Math.sin(view.time * 5.1) * 0.03 + Math.sin(view.time * 17.3) * 0.02
    + (view.rng.chance(dt * 0.35) ? -0.16 : 0)
  view.lamp = damp(view.lamp, state.phase === 'wrecked' ? 0.2 : flicker, 11, dt)

  updateDust(view, state, signals, dt)
  updateCamera(view.camera, state, dt)
}

/**
 * Dust blown off the rock by the exhaust.
 *
 * It only appears inside ground effect, which makes it a *reading* of altitude
 * rather than decoration: a pilot who sees dust knows the rock is close enough
 * that the engine is starting to push back, without any gauge saying so.
 */
function updateDust(
  view: DescentView,
  state: DescentState,
  signals: ViewSignals,
  dt: number,
): void {
  const { ship } = state
  view.sinceDust += dt

  const blowing = signals.thrusting && signals.groundEffect > 0.05 && state.phase === 'flying'
  const interval = 0.012 / Math.max(0.15, signals.groundEffect)
  if (blowing && view.sinceDust >= interval) {
    view.sinceDust = 0
    const ground = terrainHeightAt(state.terrain, ship.x)
    const spread = 1 + signals.groundEffect * 2.5
    const count = signals.hardBurn ? 3 : 2
    for (let i = 0; i < count; i++) {
      const mote = view.dust[view.dustCursor]
      view.dustCursor = (view.dustCursor + 1) % view.dust.length
      if (!mote) continue
      const side = view.rng.chance(0.5) ? -1 : 1
      mote.x = ship.x + view.rng.range(-0.5, 0.5)
      mote.y = ground - view.rng.range(0, 0.3)
      mote.vx = side * view.rng.range(2, 9) * spread * 0.5 + ship.vx * 0.3
      mote.vy = -view.rng.range(0.4, 3.2)
      mote.maxLife = view.rng.range(0.35, 1.1)
      mote.life = mote.maxLife
      mote.size = view.rng.range(0.06, 0.22)
      mote.heat = signals.hardBurn ? 1 : 0
    }
  }

  for (const mote of view.dust) {
    if (mote.life <= 0) continue
    mote.life -= dt
    mote.x += mote.vx * dt
    mote.y += mote.vy * dt
    mote.vx *= Math.exp(-2.6 * dt)
    mote.vy = mote.vy * Math.exp(-2.2 * dt) + 0.9 * dt
  }
}

/**
 * The camera.
 *
 * It rolls with the drone but only partway. A camera locked rigidly to the hull
 * is dramatic and unreadable — on a phone, with a thumb on each side of the
 * screen, losing track of which way is down is the difference between a hard
 * game and an unfair one. A third of the roll keeps the drama and keeps gravity
 * pointing somewhere the player can find.
 *
 * Zoom is driven by altitude so the rock under the drone is always in frame,
 * pulling in tight for the final approach — the same automatic close-up the
 * original Lunar Lander used.
 */
export function updateCamera(camera: Camera, state: DescentState, dt: number): void {
  camera.angle = damp(camera.angle, -state.ship.angle * 0.34, 7, dt)

  const clearance = altitude(state)
  const framed = clamp(clearance * 2.2 + 15, 19, 60)
  camera.view = damp(camera.view, state.surveying ? 78 : framed, 4, dt)

  // Lead the camera slightly into the direction of travel, and lift it so the
  // ground the drone is heading for is on screen before it is needed.
  const leadX = clamp(state.ship.vx * 0.55, -6, 6)
  const leadY = clamp(state.ship.vy * 0.35, -3, 5)
  camera.x = damp(camera.x, state.ship.x + leadX, 6, dt)
  camera.y = damp(camera.y, state.ship.y + leadY, 6, dt)
}

/** How hard the exhaust is currently blasting the rock, for the renderer. */
export function groundEffectNow(state: DescentState): number {
  return clamp(1 - altitude(state) / GROUND_EFFECT_HEIGHT, 0, 1)
}

/** World-space point the exhaust leaves the drone from. */
export function nozzle(state: DescentState, out: { x: number; y: number }): void {
  const { ship } = state
  out.x = ship.x - Math.sin(ship.angle) * SHIP_RADIUS * 0.95
  out.y = ship.y + Math.cos(ship.angle) * SHIP_RADIUS * 0.95
}
