import type { Rng } from '../../lib/prng.ts'
import { clamp } from '../../lib/math.ts'

/**
 * BALLAST — pure simulation.
 *
 * You sink through a drowned cathedral. Sideways gravity pulls you toward one
 * wall; SPACE flips which wall. Riding close to the masonry compounds a
 * multiplier, and flipping resets it — so the decision every second is "bank it
 * or hold one more beat".
 *
 * Two problems in the original brief are resolved here:
 *
 * 1. The brief promised the cautious "metronome" and the greedy "diver" would
 *    score comparably, while also requiring centre play to score near-zero.
 *    Those cannot both hold when score is only `metre x multiplier`. Depth is
 *    therefore banked at a flat rate *plus* a proximity bonus, and the
 *    multiplier has diminishing returns above MULTIPLIER_SOFT_CAP, so surviving
 *    deep is worth something on its own and greed does not run away.
 *
 * 2. The brief never said where the gaps sit relative to the walls. Here the
 *    earning band is a ribbon just inside each wall, and obstacles are teeth
 *    that grow out of the walls — so riding the stone is exactly what puts you
 *    in danger, and gaps are always reachable from the opposite wall.
 */

export const SHAFT_WIDTH = 100
export const PLAYER_RADIUS = 3
export const WALL_MARGIN = 6

export const LATERAL_GRAVITY = 120
export const MAX_LATERAL_SPEED = 52
export const BASE_SINK_SPEED = 26
export const SINK_ACCELERATION = 0.34
export const MAX_SINK_SPEED = 58

/** Two flips inside this window count as one, preserving the multiplier. */
export const DOUBLE_FLIP_WINDOW = 0.15
export const MULTIPLIER_GAIN = 1.5
export const MULTIPLIER_SOFT_CAP = 8
/** Distance from the stone at which earning stops entirely. */
export const PROXIMITY_BAND = 22

export const OBSTACLE_SPACING = 54
export const MAX_SAME_WALL_RUN = 2

/**
 * Teeth must reach past the centre line, or a player can simply sit in the
 * middle of the shaft and never touch anything — a risk-free ride that makes
 * every rule about proximity irrelevant. The upper bound is set by
 * reachability: the crossing it forces has to be coverable before the next one.
 */
export const MIN_REACH = 54
export const MAX_REACH = 60

export interface Obstacle {
  /** Depth in metres at the centre of the tooth. */
  depth: number
  side: 'left' | 'right'
  /** How far the tooth reaches into the shaft at its widest. */
  reach: number
  height: number
}

/**
 * How far a tooth reaches into the shaft at a given depth.
 *
 * A tooth is a carved spur, not a box: it is full width across its middle and
 * sweeps back to the wall at both ends, further and more gently above than
 * below. Collision reads this same profile, so the silhouette the player judges
 * *is* the hitbox — a shoulder that looks clippable is clippable, and threading
 * one close is a real skill rather than a cosmetic near-miss.
 */
export function reachAt(obstacle: Obstacle, depth: number): number {
  const t = (depth - obstacle.depth) / obstacle.height
  const a = Math.abs(t)
  if (a >= 1) return 0
  const shoulder = t < 0 ? SHOULDER_ABOVE : SHOULDER_BELOW
  if (a <= shoulder) return obstacle.reach
  const k = (a - shoulder) / (1 - shoulder)
  // Smoothstep, so there is no crease where the shoulder begins.
  return obstacle.reach * (1 - k * k * (3 - 2 * k))
}

/**
 * Where the taper starts, as a fraction of half-height. The long upper sweep
 * and the compact lower haunch are what make the form read as an arch springing
 * out of the wall instead of a shelf bolted to it.
 */
export const SHOULDER_ABOVE = 0.16
export const SHOULDER_BELOW = 0.4

export interface BallastInput {
  flip: boolean
}

export interface BallastState {
  /** Lateral position across the shaft, 0..SHAFT_WIDTH. */
  x: number
  vx: number
  /** Metres descended. */
  depth: number
  sinkSpeed: number
  /** Which wall gravity currently pulls toward. */
  pull: 'left' | 'right'
  multiplier: number
  score: number
  bestMultiplier: number
  /** Depth at which the best multiplier broke, for the end-of-run sentence. */
  bestMultiplierDepth: number
  flips: number
  doubleFlips: number
  /** Time since the previous flip, for the double-flip grace window. */
  sinceFlip: number
  /** Multiplier carried through the grace window, restored on a double flip. */
  pendingMultiplier: number
  obstacles: Obstacle[]
  generatedTo: number
  lastSide: 'left' | 'right'
  sameSideRun: number
  alive: boolean
  elapsed: number
}

export function createState(rng: Rng): BallastState {
  const state: BallastState = {
    x: SHAFT_WIDTH / 2,
    vx: 0,
    depth: 0,
    sinkSpeed: BASE_SINK_SPEED,
    pull: 'right',
    multiplier: 1,
    score: 0,
    bestMultiplier: 1,
    bestMultiplierDepth: 0,
    flips: 0,
    doubleFlips: 0,
    sinceFlip: Number.POSITIVE_INFINITY,
    pendingMultiplier: 1,
    obstacles: [],
    generatedTo: 0,
    lastSide: 'left',
    sameSideRun: 0,
    alive: true,
    elapsed: 0,
  }
  generateTo(state, 400, rng)
  return state
}

/**
 * Generate teeth ahead of the player.
 *
 * Obstacles alternate walls and no wall may run clear for long, which stops a
 * stretch of open masonry becoming a risk-free multiplier farm.
 */
export function generateTo(state: BallastState, depth: number, rng: Rng): void {
  while (state.generatedTo < depth) {
    const next = state.generatedTo + OBSTACLE_SPACING + rng.range(-3, 12)

    let side: 'left' | 'right'
    if (state.sameSideRun >= MAX_SAME_WALL_RUN) {
      side = state.lastSide === 'left' ? 'right' : 'left'
    } else {
      side = rng.chance(0.5) ? 'left' : 'right'
    }
    state.sameSideRun = side === state.lastSide ? state.sameSideRun + 1 : 1
    state.lastSide = side

    // Teeth reach past the centre so the shaft is a genuine slalom, but never
    // so far that the gap on the far side is unreachable before the next tooth.
    const difficulty = clamp(next / 3000, 0, 1)
    const reach = MIN_REACH + difficulty * (MAX_REACH - MIN_REACH) + rng.range(-2, 2)

    state.obstacles.push({
      depth: next,
      side,
      reach: clamp(reach, MIN_REACH, MAX_REACH),
      height: 15 + rng.range(0, 7),
    })
    state.generatedTo = next
  }
}

export interface BallastEvents {
  flipped?: boolean
  doubleFlip?: boolean
  multiplierBroke?: number
  died?: boolean
  passed?: number
}

export function step(
  state: BallastState,
  input: BallastInput,
  dt: number,
  rng: Rng,
): BallastEvents {
  const events: BallastEvents = {}
  if (!state.alive) return events

  state.elapsed += dt
  state.sinceFlip += dt

  if (input.flip) applyFlip(state, events)

  // Resolve a pending multiplier once the grace window closes.
  if (state.sinceFlip > DOUBLE_FLIP_WINDOW && state.pendingMultiplier > 1) {
    if (state.pendingMultiplier > state.bestMultiplier) {
      state.bestMultiplier = state.pendingMultiplier
      state.bestMultiplierDepth = state.depth
    }
    events.multiplierBroke = state.pendingMultiplier
    state.pendingMultiplier = 1
  }

  // Lateral gravity accelerates; it never teleports, which is what makes a late
  // flip fatal and an early one wasteful.
  const direction = state.pull === 'right' ? 1 : -1
  state.vx += direction * LATERAL_GRAVITY * dt
  state.vx = clamp(state.vx, -MAX_LATERAL_SPEED, MAX_LATERAL_SPEED)
  state.x += state.vx * dt

  state.sinkSpeed = Math.min(MAX_SINK_SPEED, state.sinkSpeed + SINK_ACCELERATION * dt)
  const previousDepth = state.depth
  state.depth += state.sinkSpeed * dt

  generateTo(state, state.depth + 600, rng)

  const distance = distanceToStone(state)
  accrueScore(state, distance, state.depth - previousDepth)

  if (distance <= 0) {
    state.alive = false
    if (state.multiplier > state.bestMultiplier) {
      state.bestMultiplier = state.multiplier
      state.bestMultiplierDepth = state.depth
    }
    events.died = true
  }

  // Drop obstacles that are well above the player. The bound is generous
  // because the renderer still draws teeth some way above the bell.
  if (state.obstacles.length > 64) {
    state.obstacles = state.obstacles.filter((o) => o.depth > state.depth - 220)
  }

  return events
}

function applyFlip(state: BallastState, events: BallastEvents): void {
  state.flips += 1
  state.pull = state.pull === 'right' ? 'left' : 'right'
  events.flipped = true

  if (state.sinceFlip <= DOUBLE_FLIP_WINDOW && state.pendingMultiplier > 1) {
    // A double flip inside the grace window is a lateral nudge that keeps the
    // hard-won multiplier — deliberately tight so it stays a skill.
    state.multiplier = state.pendingMultiplier
    state.pendingMultiplier = 1
    state.doubleFlips += 1
    events.doubleFlip = true
  } else {
    if (state.multiplier > state.bestMultiplier) {
      state.bestMultiplier = state.multiplier
      state.bestMultiplierDepth = state.depth
    }
    state.pendingMultiplier = state.multiplier
    state.multiplier = 1
  }
  state.sinceFlip = 0
}

/**
 * Score.
 *
 * Depth banks a flat rate so surviving deep is worth something regardless of
 * style, plus a proximity-scaled bonus that only pays inside the band near the
 * stone. The multiplier itself has diminishing returns past the soft cap, so a
 * long wall-ride is strong without making every other style pointless.
 */
function accrueScore(state: BallastState, distance: number, metres: number): void {
  if (metres <= 0) return

  const proximity = clamp(1 - distance / PROXIMITY_BAND, 0, 1)
  if (proximity > 0) {
    state.multiplier += MULTIPLIER_GAIN * proximity * metres / state.sinkSpeed
  }

  state.score += metres * 1
  state.score += metres * 6 * proximity * effectiveMultiplier(state)
}

/** Diminishing returns above the soft cap keep the multiplier from running away. */
export function effectiveMultiplier(state: BallastState): number {
  if (state.multiplier <= MULTIPLIER_SOFT_CAP) return state.multiplier
  return MULTIPLIER_SOFT_CAP + Math.sqrt(state.multiplier - MULTIPLIER_SOFT_CAP) * 2
}

/**
 * Distance from the player's edge to the nearest stone, counting both the
 * shaft walls and any tooth the player is currently level with. Zero or less
 * means contact.
 */
export function distanceToStone(state: BallastState): number {
  let leftStone = 0
  let rightStone = SHAFT_WIDTH

  for (const obstacle of state.obstacles) {
    const reach = reachAt(obstacle, state.depth)
    if (reach <= 0) continue
    if (obstacle.side === 'left') leftStone = Math.max(leftStone, reach)
    else rightStone = Math.min(rightStone, SHAFT_WIDTH - reach)
  }

  return Math.min(state.x - PLAYER_RADIUS - leftStone, rightStone - (state.x + PLAYER_RADIUS))
}

/** The teeth the renderer should draw for the visible window. */
export function visibleObstacles(state: BallastState, ahead = 420, behind = 90): Obstacle[] {
  return state.obstacles.filter(
    (o) => o.depth > state.depth - behind && o.depth < state.depth + ahead,
  )
}

/** True while the player is inside the earning ribbon. */
export function isEarning(state: BallastState): boolean {
  return distanceToStone(state) < PROXIMITY_BAND
}
