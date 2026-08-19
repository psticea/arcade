import type { Rng } from '../../../lib/prng.ts'
import { clamp } from '../../../lib/math.ts'
import { PROXIMITY_BAND, distanceToStone, type BallastState } from '../simulation.ts'

/**
 * Everything the renderer animates that the simulation does not own.
 *
 * The simulation stays pure and framework-free — it knows nothing about bubbles
 * or lantern flicker — so all presentation state lives here and is advanced on
 * the same fixed timestep. That keeps the look deterministic for a seed and
 * keeps `simulation.ts` testable in Node.
 *
 * Nothing in here is allocated per frame: pools are sized at construction and
 * recycled.
 */

const TRAIL_SAMPLES = 44
const TRAIL_INTERVAL = 0.016
const BUBBLE_COUNT = 90
const MOTE_COUNT = 120
const SPARK_COUNT = 90

export interface TrailSample {
  /** Lateral position in shaft units. */
  x: number
  depth: number
  /** Earning intensity when this sample was taken, so the wake glows in bands. */
  heat: number
}

export interface Bubble {
  /** Screen x in CSS pixels. */
  x: number
  y: number
  radius: number
  /** Parallax factor: bigger reads as nearer. */
  layer: number
  wobble: number
  phase: number
}

export interface Mote {
  x: number
  y: number
  size: number
  layer: number
  alpha: number
  phase: number
}

export interface Spark {
  /** World position: shaft units across, metres down. */
  x: number
  depth: number
  vx: number
  vd: number
  life: number
  maxLife: number
  size: number
  /** 0 = cold green, 1 = gold. Sparks warm up as the multiplier climbs. */
  warmth: number
}

export interface BallastView {
  time: number
  /** Bell roll in radians, easing toward the pull direction. */
  bank: number
  bankVelocity: number
  /** Smoothed 0..1 proximity to stone; drives every earning cue. */
  earn: number
  /** Smoothed 0..1 multiplier heat; drives colour temperature. */
  heat: number
  /** 1 → 0 after a flip. */
  flipPulse: number
  /** 1 → 0 after a successful double flip. */
  doublePulse: number
  /** 1 → 0 after a depth milestone; drives the bell toll bloom. */
  tollPulse: number
  lanternFlicker: number
  trail: TrailSample[]
  trailCursor: number
  trailFilled: number
  sinceTrail: number
  bubbles: Bubble[]
  motes: Mote[]
  sparks: Spark[]
  sparkCursor: number
  sinceSpark: number
  lastFlips: number
  lastDoubleFlips: number
  lastMilestone: number
  /** Frozen at the moment of death so the end frame stops moving. */
  dead: boolean
  deathTime: number
  rng: Rng
}

export function createView(rng: Rng): BallastView {
  return {
    time: 0,
    bank: 0,
    bankVelocity: 0,
    earn: 0,
    heat: 0,
    flipPulse: 0,
    doublePulse: 0,
    tollPulse: 0,
    lanternFlicker: 1,
    trail: Array.from({ length: TRAIL_SAMPLES }, () => ({ x: 50, depth: 0, heat: 0 })),
    trailCursor: 0,
    trailFilled: 0,
    sinceTrail: 0,
    bubbles: Array.from({ length: BUBBLE_COUNT }, () => ({
      x: rng.range(0, 1), y: rng.range(0, 1), radius: 0, layer: 1, wobble: 0, phase: 0,
    })),
    motes: Array.from({ length: MOTE_COUNT }, () => ({
      x: rng.range(0, 1), y: rng.range(0, 1), size: 1, layer: 1, alpha: 0.2, phase: 0,
    })),
    sparks: Array.from({ length: SPARK_COUNT }, () => ({
      x: 0, depth: 0, vx: 0, vd: 0, life: 0, maxLife: 1, size: 1, warmth: 0,
    })),
    sparkCursor: 0,
    sinceSpark: 0,
    lastFlips: 0,
    lastDoubleFlips: 0,
    lastMilestone: 0,
    dead: false,
    deathTime: 0,
    rng,
  }
}

/** Lazily seed a particle the first time it is used, then recycle forever. */
function seedBubble(bubble: Bubble, rng: Rng, width: number, height: number, fromBottom: boolean): void {
  bubble.x = rng.range(0, width)
  bubble.y = fromBottom ? height + rng.range(0, 60) : rng.range(0, height)
  bubble.layer = rng.pick([0.45, 0.45, 0.8, 1, 1, 1.5, 2.1])
  bubble.radius = (0.7 + rng.range(0, 1.9)) * bubble.layer
  bubble.wobble = rng.range(4, 16)
  bubble.phase = rng.range(0, Math.PI * 2)
}

function seedMote(mote: Mote, rng: Rng, width: number, height: number, fromBottom: boolean): void {
  mote.x = rng.range(0, width)
  mote.y = fromBottom ? height + rng.range(0, 40) : rng.range(0, height)
  mote.layer = rng.pick([0.3, 0.5, 0.5, 0.9, 1.4])
  mote.size = 0.5 + mote.layer * rng.range(0.4, 1.4)
  mote.alpha = 0.06 + mote.layer * 0.12
  mote.phase = rng.range(0, Math.PI * 2)
}

export function updateView(
  view: BallastView,
  state: BallastState,
  dt: number,
  width: number,
  height: number,
): void {
  view.time += dt

  // --- Cues driven by simulation state, smoothed so nothing snaps ------------
  const distance = distanceToStone(state)
  const proximity = state.alive ? clamp(1 - distance / PROXIMITY_BAND, 0, 1) : 0
  view.earn += (proximity - view.earn) * Math.min(1, dt * 9)
  const heatTarget = clamp((state.multiplier - 1) / 9, 0, 1)
  view.heat += (heatTarget - view.heat) * Math.min(1, dt * 5)

  if (state.flips !== view.lastFlips) {
    view.lastFlips = state.flips
    view.flipPulse = 1
    // A flip throws the bell over; the spring below carries the follow-through.
    view.bankVelocity += state.pull === 'right' ? 9 : -9
  }
  if (state.doubleFlips !== view.lastDoubleFlips) {
    view.lastDoubleFlips = state.doubleFlips
    view.doublePulse = 1
  }
  const milestone = Math.floor(state.depth / 100)
  if (milestone !== view.lastMilestone) {
    view.lastMilestone = milestone
    view.tollPulse = 1
  }
  if (!state.alive && !view.dead) {
    view.dead = true
    view.deathTime = view.time
  }

  view.flipPulse = Math.max(0, view.flipPulse - dt * 3.4)
  view.doublePulse = Math.max(0, view.doublePulse - dt * 2.2)
  view.tollPulse = Math.max(0, view.tollPulse - dt * 0.7)

  // --- The bell rolls into the pull, and overshoots ---------------------------
  // A critically underdamped spring: the flip reads as weight rather than a
  // snap, which is the whole point of the 120 ms rotation in the brief.
  const target = (state.pull === 'right' ? 1 : -1) * (0.34 + Math.abs(state.vx) * 0.004)
  view.bankVelocity += (target - view.bank) * 150 * dt
  view.bankVelocity *= Math.exp(-7.5 * dt)
  view.bank += view.bankVelocity * dt

  // Lantern flicker: a slow wander plus a rare guttering dip.
  const flickerTarget = 0.86 + Math.sin(view.time * 3.1) * 0.05 + Math.sin(view.time * 11.3) * 0.03
    + (view.rng.chance(dt * 0.6) ? -0.28 : 0)
  view.lanternFlicker += (flickerTarget - view.lanternFlicker) * Math.min(1, dt * 12)

  // --- The wake ---------------------------------------------------------------
  view.sinceTrail += dt
  if (state.alive && view.sinceTrail >= TRAIL_INTERVAL) {
    view.sinceTrail = 0
    const sample = view.trail[view.trailCursor]
    if (sample) {
      sample.x = state.x
      sample.depth = state.depth
      sample.heat = view.earn
    }
    view.trailCursor = (view.trailCursor + 1) % view.trail.length
    view.trailFilled = Math.min(view.trailFilled + 1, view.trail.length)
  }

  // --- Silt and bubbles rise, and their speed is the only sink-rate cue -------
  // On contact the water goes instantly still, which is the loudest thing the
  // frame can do without a flash.
  const rise = state.alive ? state.sinkSpeed * 2.6 : 0
  for (const bubble of view.bubbles) {
    if (bubble.radius === 0) seedBubble(bubble, view.rng, width, height, false)
    bubble.y -= rise * bubble.layer * dt
    bubble.phase += dt * 2.6
    if (bubble.y < -12) seedBubble(bubble, view.rng, width, height, true)
  }
  for (const mote of view.motes) {
    if (mote.size === 1 && mote.alpha === 0.2) seedMote(mote, view.rng, width, height, false)
    mote.y -= rise * mote.layer * 0.75 * dt
    mote.phase += dt * 1.4
    if (mote.y < -8) seedMote(mote, view.rng, width, height, true)
  }

  // --- Sparks struck off the masonry while earning ----------------------------
  view.sinceSpark += dt
  const rate = view.earn * view.earn * 0.014
  if (state.alive && view.earn > 0.12 && view.sinceSpark > rate) {
    view.sinceSpark = 0
    const spark = view.sparks[view.sparkCursor]
    view.sparkCursor = (view.sparkCursor + 1) % view.sparks.length
    if (spark) {
      const towardLeft = state.x < 50
      spark.x = state.x + (towardLeft ? -1 : 1) * view.rng.range(0.5, 3.5)
      spark.depth = state.depth + view.rng.range(-3, 5)
      spark.vx = (towardLeft ? -1 : 1) * view.rng.range(1, 9)
      spark.vd = -view.rng.range(8, 34)
      spark.maxLife = view.rng.range(0.25, 0.75)
      spark.life = spark.maxLife
      spark.size = view.rng.range(0.7, 2.1)
      spark.warmth = view.heat
    }
  }
  for (const spark of view.sparks) {
    if (spark.life <= 0) continue
    spark.life -= dt
    spark.x += spark.vx * dt
    spark.depth += spark.vd * dt
    spark.vx *= Math.exp(-2.4 * dt)
    spark.vd *= Math.exp(-1.4 * dt)
  }
}

/** Walk the wake oldest-first. Returns the number of valid samples written. */
export function readTrail(view: BallastView, out: TrailSample[]): number {
  const count = view.trailFilled
  const start = (view.trailCursor - count + view.trail.length) % view.trail.length
  for (let i = 0; i < count; i++) {
    const source = view.trail[(start + i) % view.trail.length]
    const target = out[i]
    if (!source || !target) continue
    target.x = source.x
    target.depth = source.depth
    target.heat = source.heat
  }
  return count
}
