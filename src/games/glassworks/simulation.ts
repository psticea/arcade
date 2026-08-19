import type { Rng } from '../../lib/prng.ts'
import { clamp } from '../../lib/math.ts'
import {
  BALL_RADIUS,
  DRAIN_Y,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  createFlippers,
  distanceToSegment,
  diverterSegment,
  flipperSegment,
  tableConfigs,
  type Bumper,
  type Flipper,
  type Segment,
  type TableConfig,
} from './table.ts'

/**
 * GLASSWORKS — pure simulation.
 *
 * Physics is hand-rolled rather than pulled from an engine so the whole thing
 * stays deterministic and unit-testable in Node. Tunnelling — the classic way a
 * fast pinball escapes through a thin flipper — is prevented by substepping so
 * the ball never moves more than a fraction of its own radius per step.
 */

export const GRAVITY = 46
export const BALLS_PER_GAME = 3
export const BALL_SAVE_SECONDS = 15
export const NUDGE_IMPULSE = 11
export const NUDGE_METER_COST = 0.25
export const NUDGE_DECAY = 0.1
export const TILT_DURATION = 4
export const DIVERTER_COOLDOWN = 2
export const REBUILD_DURATION = 2.5
export const FLIPPER_INPUT_BUFFER = 0.05

const MAX_SUBSTEP_TRAVEL = BALL_RADIUS * 0.35
const MAX_SUBSTEPS = 24
const FLIPPER_SPEED = 22
const MAX_SPEED = 95

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  active: boolean
}

export type Phase = 'plunger' | 'play' | 'rebuilding' | 'drained' | 'over'

export interface GlassworksInput {
  leftFlipper: boolean
  rightFlipper: boolean
  raiseDiverter: boolean
  dropDiverter: boolean
  nudge: boolean
  plungerHeld: number
}

export interface GlassworksState {
  balls: Ball[]
  flippers: Flipper[]
  configIndex: number
  configs: TableConfig[]
  diverterRaised: boolean
  diverterCooldown: number
  hitTargets: Set<string>
  missionsComplete: number
  rebuildTimer: number
  ballsRemaining: number
  ballSaveTimer: number
  nudgeMeter: number
  tiltTimer: number
  tilted: boolean
  score: number
  multiball: boolean
  phase: Phase
  plungerPower: number
  elapsed: number
  /** Rolling record for the end-of-run summary. */
  bumperHits: number
  jackpots: number
}

export function createState(_rng: Rng): GlassworksState {
  const configs = tableConfigs()
  return {
    balls: [newBall()],
    flippers: createFlippers(),
    configIndex: 0,
    configs,
    diverterRaised: false,
    diverterCooldown: 0,
    hitTargets: new Set(),
    missionsComplete: 0,
    rebuildTimer: 0,
    ballsRemaining: BALLS_PER_GAME,
    ballSaveTimer: 0,
    nudgeMeter: 0,
    tiltTimer: 0,
    tilted: false,
    score: 0,
    multiball: false,
    phase: 'plunger',
    plungerPower: 0,
    elapsed: 0,
    bumperHits: 0,
    jackpots: 0,
  }
}

function newBall(): Ball {
  return { x: TABLE_WIDTH - 3, y: TABLE_HEIGHT - 6, vx: 0, vy: 0, active: true }
}

export function currentConfig(state: GlassworksState): TableConfig {
  return state.configs[state.configIndex % state.configs.length]!
}

/** Every collider the ball can meet this frame. */
export function activeSegments(state: GlassworksState): Segment[] {
  const config = currentConfig(state)
  return [
    ...config.segments,
    diverterSegment(state.diverterRaised),
    ...state.flippers.map(flipperSegment),
  ]
}

export interface GlassworksEvents {
  bumper?: { x: number; y: number; points: number }[]
  targetHit?: string
  missionComplete?: number
  rebuilt?: string
  drained?: boolean
  launched?: boolean
  tilted?: boolean
  diverted?: boolean
  gameOver?: boolean
  wallHit?: { x: number; y: number; speed: number }[]
}

export function step(
  state: GlassworksState,
  input: GlassworksInput,
  dt: number,
  _rng: Rng,
): GlassworksEvents {
  const events: GlassworksEvents = {}
  if (state.phase === 'over') return events

  state.elapsed += dt
  state.diverterCooldown = Math.max(0, state.diverterCooldown - dt)
  state.ballSaveTimer = Math.max(0, state.ballSaveTimer - dt)
  state.nudgeMeter = Math.max(0, state.nudgeMeter - NUDGE_DECAY * dt)

  if (state.tiltTimer > 0) {
    state.tiltTimer = Math.max(0, state.tiltTimer - dt)
    if (state.tiltTimer === 0) state.tilted = false
  }

  if (state.phase === 'rebuilding') {
    state.rebuildTimer -= dt
    if (state.rebuildTimer <= 0) {
      state.configIndex += 1
      state.phase = 'play'
      events.rebuilt = currentConfig(state).name
    }
    return events
  }

  updateDiverter(state, input, events)

  if (input.nudge && !state.tilted && state.phase === 'play') {
    applyNudge(state, events)
  }

  if (state.phase === 'plunger') {
    updateFlippers(state, input, dt)
    // Keep the previous charge: the release frame reports plungerHeld === 0, so
    // reading the freshly recomputed power here would always launch at zero.
    const chargedPower = state.plungerPower
    state.plungerPower = clamp(input.plungerHeld / 1.2, 0, 1)

    const ball = state.balls[0]
    if (ball) {
      ball.x = TABLE_WIDTH - 3
      ball.y = TABLE_HEIGHT - 6
      ball.vx = 0
      ball.vy = 0
    }

    if (input.plungerHeld === 0 && chargedPower > 0.02) {
      state.plungerPower = chargedPower
      launch(state, events)
    }
    return events
  }

  simulatePhysics(state, input, dt, events)
  checkDrain(state, events)

  return events
}

function updateFlippers(state: GlassworksState, input: GlassworksInput, dt: number): void {
  for (const flipper of state.flippers) {
    const held = state.tilted
      ? false
      : flipper.side === 'left' ? input.leftFlipper : input.rightFlipper
    const target = held ? flipper.raisedAngle : flipper.restAngle
    const previous = flipper.angle
    const delta = target - flipper.angle
    const move = Math.sign(delta) * Math.min(Math.abs(delta), FLIPPER_SPEED * dt)
    flipper.angle += move
    flipper.angularVelocity = dt > 0 ? (flipper.angle - previous) / dt : 0
  }
}

function updateDiverter(
  state: GlassworksState,
  input: GlassworksInput,
  events: GlassworksEvents,
): void {
  if (state.diverterCooldown > 0) return
  if (input.raiseDiverter && !state.diverterRaised) {
    state.diverterRaised = true
    state.diverterCooldown = DIVERTER_COOLDOWN
    events.diverted = true
  } else if (input.dropDiverter && state.diverterRaised) {
    state.diverterRaised = false
    state.diverterCooldown = DIVERTER_COOLDOWN
    events.diverted = true
  }
}

function applyNudge(state: GlassworksState, events: GlassworksEvents): void {
  state.nudgeMeter += NUDGE_METER_COST
  for (const ball of state.balls) {
    if (!ball.active) continue
    ball.vx += NUDGE_IMPULSE * (ball.x < TABLE_WIDTH / 2 ? 1 : -1)
    ball.vy -= NUDGE_IMPULSE * 0.4
  }
  // Metered tilt: nudging is a real tactic until you lean on it too hard.
  if (state.nudgeMeter >= 1) {
    state.tilted = true
    state.tiltTimer = TILT_DURATION
    state.nudgeMeter = 0
    events.tilted = true
  }
}

function launch(state: GlassworksState, events: GlassworksEvents): void {
  const ball = state.balls[0]
  if (!ball) return
  ball.vy = -(36 + state.plungerPower * 46)
  ball.vx = 0
  state.phase = 'play'
  state.ballSaveTimer = BALL_SAVE_SECONDS
  state.plungerPower = 0
  events.launched = true
}

/**
 * Substepped integration.
 *
 * Both the ball *and* the flippers advance inside the substep loop. Stepping
 * only the ball is not enough: a flipper sweeps its tip roughly a unit per
 * frame, so a rigid once-per-frame flipper can pass straight through the ball —
 * the classic "my flipper went through it" bug.
 */
function simulatePhysics(
  state: GlassworksState,
  input: GlassworksInput,
  dt: number,
  events: GlassworksEvents,
): void {
  let fastest = 0
  for (const ball of state.balls) {
    if (ball.active) fastest = Math.max(fastest, Math.hypot(ball.vx, ball.vy))
  }
  let flipperTipSpeed = 0
  for (const flipper of state.flippers) {
    flipperTipSpeed = Math.max(flipperTipSpeed, FLIPPER_SPEED * flipper.length)
  }

  const travel = Math.max(fastest, flipperTipSpeed) * dt
  const substeps = clamp(Math.ceil(travel / MAX_SUBSTEP_TRAVEL), 1, MAX_SUBSTEPS)
  const sub = dt / substeps

  for (let i = 0; i < substeps; i++) {
    updateFlippers(state, input, sub)
    for (const ball of state.balls) {
      if (!ball.active) continue
      integrate(state, ball, sub, events)
    }
  }
}

function integrate(
  state: GlassworksState,
  ball: Ball,
  dt: number,
  events: GlassworksEvents,
): void {
  ball.vy += GRAVITY * dt
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > MAX_SPEED) {
    ball.vx = (ball.vx / speed) * MAX_SPEED
    ball.vy = (ball.vy / speed) * MAX_SPEED
  }

  for (const segment of activeSegments(state)) {
    resolveSegment(state, ball, segment, events)
  }
  for (const bumper of currentConfig(state).bumpers) {
    resolveBumper(state, ball, bumper, events)
  }
}

function resolveSegment(
  state: GlassworksState,
  ball: Ball,
  segment: Segment,
  events: GlassworksEvents,
): void {
  const { distance, cx, cy } = distanceToSegment(ball.x, ball.y, segment)
  if (distance >= BALL_RADIUS) return

  let nx = ball.x - cx
  let ny = ball.y - cy
  const length = Math.hypot(nx, ny)
  if (length < 1e-6) {
    // Dead centre on the line: push along the segment normal instead.
    const dx = segment.x2 - segment.x1
    const dy = segment.y2 - segment.y1
    const segLength = Math.hypot(dx, dy) || 1
    nx = -dy / segLength
    ny = dx / segLength
  } else {
    nx /= length
    ny /= length
  }

  ball.x = cx + nx * BALL_RADIUS
  ball.y = cy + ny * BALL_RADIUS

  // A moving flipper adds its surface velocity, which is where the power comes from.
  let surfaceVx = 0
  let surfaceVy = 0
  for (const flipper of state.flippers) {
    const flipperSeg = flipperSegment(flipper)
    if (flipperSeg.x1 !== segment.x1 || flipperSeg.y1 !== segment.y1) continue
    if (flipperSeg.x2 !== segment.x2 || flipperSeg.y2 !== segment.y2) continue
    const rx = cx - flipper.pivotX
    const ry = cy - flipper.pivotY
    surfaceVx = -flipper.angularVelocity * ry
    surfaceVy = flipper.angularVelocity * rx
  }

  const relativeVx = ball.vx - surfaceVx
  const relativeVy = ball.vy - surfaceVy
  const normalSpeed = relativeVx * nx + relativeVy * ny
  if (normalSpeed >= 0) return

  const restitution = segment.restitution
  const impulse = -(1 + restitution) * normalSpeed
  ball.vx = relativeVx + impulse * nx + surfaceVx
  ball.vy = relativeVy + impulse * ny + surfaceVy

  const impactSpeed = Math.abs(normalSpeed)
  if (segment.points && impactSpeed > 4) {
    awardSegment(state, segment, events)
  }
  if (impactSpeed > 12) {
    events.wallHit = events.wallHit ?? []
    events.wallHit.push({ x: cx, y: cy, speed: impactSpeed })
  }
}

function awardSegment(
  state: GlassworksState,
  segment: Segment,
  events: GlassworksEvents,
): void {
  if (segment.kind === 'target' && segment.id) {
    if (state.hitTargets.has(segment.id)) return
    state.hitTargets.add(segment.id)
    state.score += segment.points ?? 0
    events.targetHit = segment.id

    const config = currentConfig(state)
    if (config.targetIds.every((id) => state.hitTargets.has(id))) {
      completeMission(state, events)
    }
  } else {
    state.score += segment.points ?? 0
  }
}

function completeMission(state: GlassworksState, events: GlassworksEvents): void {
  state.missionsComplete += 1
  state.jackpots += 1
  const jackpot = state.multiball ? 5_000_000 : 1_000_000
  state.score += jackpot + 250_000 * state.missionsComplete
  state.hitTargets = new Set()
  state.phase = 'rebuilding'
  state.rebuildTimer = REBUILD_DURATION
  events.missionComplete = state.missionsComplete

  // Multiball unlocks from the third mission and stays for the rest of the game.
  if (state.missionsComplete >= 3 && !state.multiball) {
    state.multiball = true
    state.balls.push(
      { x: 20, y: 30, vx: -14, vy: -8, active: true },
      { x: 22, y: 30, vx: 14, vy: -8, active: true },
    )
  }
}

function resolveBumper(
  state: GlassworksState,
  ball: Ball,
  bumper: Bumper,
  events: GlassworksEvents,
): void {
  const dx = ball.x - bumper.x
  const dy = ball.y - bumper.y
  const distance = Math.hypot(dx, dy)
  const minimum = bumper.radius + BALL_RADIUS
  if (distance >= minimum) return

  const nx = distance < 1e-6 ? 0 : dx / distance
  const ny = distance < 1e-6 ? 1 : dy / distance
  ball.x = bumper.x + nx * minimum
  ball.y = bumper.y + ny * minimum

  const normalSpeed = ball.vx * nx + ball.vy * ny
  if (normalSpeed < 0) {
    const impulse = -(1 + bumper.restitution) * normalSpeed
    ball.vx += impulse * nx
    ball.vy += impulse * ny
  }
  ball.vx += nx * bumper.kick
  ball.vy += ny * bumper.kick

  state.score += bumper.points
  state.bumperHits += 1
  events.bumper = events.bumper ?? []
  events.bumper.push({ x: bumper.x, y: bumper.y, points: bumper.points })
}

function checkDrain(state: GlassworksState, events: GlassworksEvents): void {
  let anyActive = false
  for (const ball of state.balls) {
    if (!ball.active) continue
    if (ball.y > DRAIN_Y) {
      if (state.ballSaveTimer > 0) {
        // Ball save: return it to the plunger rather than taking the ball.
        ball.x = TABLE_WIDTH - 3
        ball.y = TABLE_HEIGHT - 6
        ball.vx = 0
        ball.vy = -52
        anyActive = true
        continue
      }
      ball.active = false
    } else {
      anyActive = true
    }
  }

  if (anyActive) return

  state.ballsRemaining -= 1
  events.drained = true
  state.multiball = false

  if (state.ballsRemaining <= 0) {
    state.phase = 'over'
    events.gameOver = true
    return
  }

  state.balls = [newBall()]
  state.phase = 'plunger'
  state.tilted = false
  state.tiltTimer = 0
  state.nudgeMeter = 0
}

export function activeBallCount(state: GlassworksState): number {
  return state.balls.filter((ball) => ball.active).length
}
