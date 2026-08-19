import type { Rng } from '../../lib/prng.ts'

/**
 * COIL — pure simulation.
 *
 * Contains no rendering and no DOM access so it can be stepped deterministically
 * in tests. The arena rotation lives here only as a counter: the *simulation* is
 * rotation-agnostic and keys always map to fixed world directions. Rotation is
 * applied by the renderer, which is precisely what makes it disorienting — what
 * you see turns, what you press does not.
 */

export const GRID_SIZE = 21
export const ROTATE_EVERY = 5
export const ROTATION_DURATION = 0.6
export const TELEGRAPH_LEAD = 1
export const PHASE_DURATION = 0.5
export const MAX_PHASE_CHARGES = 2
export const SPRINT_SECONDS = 60

const BASE_SPEED = 6
const SPEED_PER_COMBO = 0.4
const MAX_SPEED = 20

export interface Cell {
  x: number
  y: number
}

export type PickupKind = 'safe' | 'hot'

export interface Pickup extends Cell {
  kind: PickupKind
}

export interface CoilInput {
  dx: number
  dy: number
  phase: boolean
}

export type DeathCause = 'wall' | 'self' | 'timeup' | undefined

export interface CoilState {
  snake: Cell[]
  direction: Cell
  pendingDirection: Cell | undefined
  pickups: Pickup[]
  growth: number
  score: number
  combo: number
  bestCombo: number
  pickupsEaten: number
  hotEaten: number
  phaseCharges: number
  phaseTimer: number
  rotationSteps: number
  /** 0..1 progress of the current rotation animation, 1 when settled. */
  rotationProgress: number
  /** Seconds until the next rotation, used for the telegraph pulse. */
  untilRotation: number
  moveTimer: number
  elapsed: number
  alive: boolean
  cause: DeathCause
  mode: 'endless' | 'sprint'
}

export function createState(rng: Rng, mode: 'endless' | 'sprint' = 'endless'): CoilState {
  const middle = Math.floor(GRID_SIZE / 2)
  const snake: Cell[] = [
    { x: middle, y: middle },
    { x: middle - 1, y: middle },
    { x: middle - 2, y: middle },
  ]
  const state: CoilState = {
    snake,
    direction: { x: 1, y: 0 },
    pendingDirection: undefined,
    pickups: [],
    growth: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    pickupsEaten: 0,
    hotEaten: 0,
    phaseCharges: 1,
    phaseTimer: 0,
    rotationSteps: 0,
    rotationProgress: 1,
    untilRotation: Number.POSITIVE_INFINITY,
    moveTimer: 0,
    elapsed: 0,
    alive: true,
    cause: undefined,
    mode,
  }
  state.pickups = spawnPair(state, rng)
  return state
}

export function currentSpeed(state: CoilState): number {
  return Math.min(MAX_SPEED, BASE_SPEED + state.combo * SPEED_PER_COMBO)
}

/** Events a step can produce, so the renderer and audio can react without polling. */
export interface StepEvents {
  ate?: PickupKind
  rotated?: boolean
  phased?: boolean
  died?: DeathCause
}

export function step(state: CoilState, input: CoilInput, dt: number, rng: Rng): StepEvents {
  const events: StepEvents = {}
  if (!state.alive) return events

  state.elapsed += dt

  if (state.mode === 'sprint' && state.elapsed >= SPRINT_SECONDS) {
    state.alive = false
    state.cause = 'timeup'
    events.died = 'timeup'
    return events
  }

  if (state.phaseTimer > 0) state.phaseTimer = Math.max(0, state.phaseTimer - dt)
  if (state.rotationProgress < 1) {
    state.rotationProgress = Math.min(1, state.rotationProgress + dt / ROTATION_DURATION)
  }
  if (Number.isFinite(state.untilRotation)) {
    state.untilRotation = Math.max(0, state.untilRotation - dt)
  }

  // Queue a turn. A direct reversal would fold the snake into itself instantly,
  // so it is ignored rather than being an instant loss.
  if (input.dx !== 0 || input.dy !== 0) {
    const isReversal = input.dx === -state.direction.x && input.dy === -state.direction.y
    if (!isReversal) state.pendingDirection = { x: input.dx, y: input.dy }
  }

  if (input.phase && state.phaseCharges > 0 && state.phaseTimer <= 0) {
    state.phaseCharges -= 1
    state.phaseTimer = PHASE_DURATION
    events.phased = true
  }

  state.moveTimer += dt
  const interval = 1 / currentSpeed(state)
  while (state.moveTimer >= interval && state.alive) {
    state.moveTimer -= interval
    advance(state, rng, events)
  }

  return events
}

function advance(state: CoilState, rng: Rng, events: StepEvents): void {
  if (state.pendingDirection) {
    state.direction = state.pendingDirection
    state.pendingDirection = undefined
  }

  const head = state.snake[0]
  if (!head) return
  const next: Cell = { x: head.x + state.direction.x, y: head.y + state.direction.y }

  if (next.x < 0 || next.y < 0 || next.x >= GRID_SIZE || next.y >= GRID_SIZE) {
    state.alive = false
    state.cause = 'wall'
    events.died = 'wall'
    return
  }

  // The tail cell vacates on this move, so stepping onto it is legal.
  const body = state.growth > 0 ? state.snake : state.snake.slice(0, -1)
  const hitsSelf = body.some((cell) => cell.x === next.x && cell.y === next.y)
  if (hitsSelf && state.phaseTimer <= 0) {
    state.alive = false
    state.cause = 'self'
    events.died = 'self'
    return
  }

  state.snake.unshift(next)
  if (state.growth > 0) state.growth -= 1
  else state.snake.pop()

  const eaten = state.pickups.find((p) => p.x === next.x && p.y === next.y)
  if (eaten) consume(state, eaten, rng, events)
}

function consume(state: CoilState, pickup: Pickup, rng: Rng, events: StepEvents): void {
  const base = pickup.kind === 'hot' ? 50 : 10
  state.score += Math.round(base * (1 + state.combo * 0.5))

  if (pickup.kind === 'hot') {
    state.combo += 1
    state.bestCombo = Math.max(state.bestCombo, state.combo)
    state.growth += 2
    state.hotEaten += 1
    state.phaseCharges = Math.min(MAX_PHASE_CHARGES, state.phaseCharges + 1)
  } else {
    state.combo = 0
    state.growth += 1
  }

  state.pickupsEaten += 1
  events.ate = pickup.kind

  if (state.pickupsEaten % ROTATE_EVERY === 0) {
    state.rotationSteps = (state.rotationSteps + 1) % 4
    state.rotationProgress = 0
    events.rotated = true
  }

  state.pickups = spawnPair(state, rng)

  const untilNext = ROTATE_EVERY - (state.pickupsEaten % ROTATE_EVERY)
  state.untilRotation = untilNext === 1 ? TELEGRAPH_LEAD : Number.POSITIVE_INFINITY
}

/**
 * Spawn one safe and one hot pickup.
 *
 * "Hot" means enclosed by the player's own body — the multiplier deliberately
 * lives where it is most dangerous to go. "Safe" is the most open cell available.
 */
export function spawnPair(state: CoilState, rng: Rng): Pickup[] {
  const occupied = new Set(state.snake.map((c) => `${c.x},${c.y}`))
  const candidates: { cell: Cell; enclosure: number }[] = []

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (occupied.has(`${x},${y}`)) continue
      candidates.push({ cell: { x, y }, enclosure: enclosureScore(x, y, occupied) })
    }
  }
  if (candidates.length < 2) return []

  const sorted = [...candidates].sort((a, b) => b.enclosure - a.enclosure)
  const hotPool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.12)))
  const hotPick = hotPool[rng.int(0, hotPool.length - 1)]
  if (!hotPick) return []
  const hot = hotPick.cell

  const safePool = sorted
    .filter((c) => c.cell.x !== hot.x || c.cell.y !== hot.y)
    .slice(-Math.max(1, Math.ceil(sorted.length * 0.25)))
  const safePick = safePool[rng.int(0, safePool.length - 1)]
  if (!safePick) return []
  const safe = safePick.cell

  return [
    { ...hot, kind: 'hot' },
    { ...safe, kind: 'safe' },
  ]
}

/** How boxed-in a cell is: nearby body segments plus proximity to the walls. */
function enclosureScore(x: number, y: number, occupied: Set<string>): number {
  let score = 0
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue
      if (occupied.has(`${x + dx},${y + dy}`)) {
        score += 4 - Math.max(Math.abs(dx), Math.abs(dy))
      }
    }
  }
  const edgeDistance = Math.min(x, y, GRID_SIZE - 1 - x, GRID_SIZE - 1 - y)
  if (edgeDistance < 2) score += 2 - edgeDistance
  return score
}

export function timeRemaining(state: CoilState): number {
  if (state.mode !== 'sprint') return Number.POSITIVE_INFINITY
  return Math.max(0, SPRINT_SECONDS - state.elapsed)
}
