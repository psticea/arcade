import type { Rng } from '../../lib/prng.ts'
import { clamp } from '../../lib/math.ts'

/**
 * LUMEN — pure simulation.
 *
 * Tempest inverted. Nothing climbs the well to hurt you and nothing is
 * destroyed: motes of light rise from the deep, and if they crest the rim they
 * escape and the tunnel dims. You catch them. The richest motes sink instead of
 * rising, so the only way to reach them is to dive in after them — the
 * multiplier lives where it costs the most to go.
 */

export const LIGHT_CAPACITY = 100
export const DIVE_DURATION = 1.4
export const DIVE_DEPTH = 0.42
export const BLOOM_COOLDOWN = 0.34
export const GATHER_CHARGE_TIME = 0.4
export const SHADOW_TELEGRAPH = 0.5
export const SHADOW_DURATION = 0.8

const RIM_SPEED = 5.2
const LIGHT_PER_MOTE = 1
const LIGHT_PER_DEEP = 6
const LIGHT_PER_ESCAPE = -4
const LIGHT_IDLE_DRAIN = 1
const DIVE_LIGHT_COST = 2
const SPIRE_BLOCK_HEIGHT = 0.55

export type MoteKind = 'rising' | 'deep'

export interface Mote {
  /** Continuous position around the rim, in segment units. */
  angle: number
  /** 0 at the centre of the well, 1 at the rim. */
  depth: number
  kind: MoteKind
  speed: number
  drift: number
}

export interface Spire {
  segment: number
  /** 0..1 outward from the centre. Blocks dives past SPIRE_BLOCK_HEIGHT. */
  height: number
}

export interface ShadowLane {
  segment: number
  /** Counts down through the telegraph, then the active window. */
  timer: number
  active: boolean
}

export interface LumenInput {
  left: boolean
  right: boolean
  dive: boolean
  gatherHeld: number
  bloom: boolean
  bloomHeld: number
}

export interface LumenState {
  segments: number
  /** Segment count being morphed toward, mid-wave. */
  targetSegments: number
  morphProgress: number
  playerAngle: number
  playerDepth: number
  diveTimer: number
  motes: Mote[]
  spires: Spire[]
  shadows: ShadowLane[]
  light: number
  score: number
  multiplier: number
  deepCaught: number
  motesCaught: number
  motesEscaped: number
  spiresDissolved: number
  wave: number
  waveQuota: number
  waveResolved: number
  gatherCharges: number
  bloomCooldown: number
  /** Visual pulse radius for the last bloom, 0 when idle. */
  bloomPulse: number
  bloomWide: boolean
  spawnTimer: number
  elapsed: number
  alive: boolean
}

export function createState(_rng: Rng): LumenState {
  const segments = 16
  return {
    segments,
    targetSegments: segments,
    morphProgress: 1,
    playerAngle: 0,
    playerDepth: 1,
    diveTimer: 0,
    motes: [],
    spires: [],
    shadows: [],
    light: 60,
    score: 0,
    multiplier: 1,
    deepCaught: 0,
    motesCaught: 0,
    motesEscaped: 0,
    spiresDissolved: 0,
    wave: 0,
    waveQuota: waveQuotaFor(0),
    waveResolved: 0,
    gatherCharges: 1,
    bloomCooldown: 0,
    bloomPulse: 0,
    bloomWide: false,
    spawnTimer: 0.4,
    elapsed: 0,
    alive: true,
  }
}

export function waveQuotaFor(wave: number): number {
  return 12 + wave * 4
}

function spawnInterval(state: LumenState): number {
  return Math.max(0.28, 1.05 - state.wave * 0.07)
}

export interface LumenEvents {
  caught?: { kind: MoteKind; angle: number; depth: number }[]
  escaped?: number
  dived?: boolean
  diveBlocked?: boolean
  gathered?: boolean
  spireDissolved?: number
  waveCleared?: number
  morphed?: boolean
  died?: boolean
}

export function step(state: LumenState, input: LumenInput, dt: number, rng: Rng): LumenEvents {
  const events: LumenEvents = {}
  if (!state.alive) return events

  state.elapsed += dt
  state.bloomCooldown = Math.max(0, state.bloomCooldown - dt)
  state.bloomPulse = Math.max(0, state.bloomPulse - dt * 3.2)
  if (state.morphProgress < 1) state.morphProgress = Math.min(1, state.morphProgress + dt / 1.2)

  movePlayer(state, input, dt)
  updateDive(state, input, dt, events)
  updateShadows(state, dt, rng)
  updateSpires(state, dt, rng)
  spawnMotes(state, dt, rng)
  moveMotes(state, dt, events)

  if (input.bloom && state.bloomCooldown <= 0) {
    bloom(state, input.bloomHeld > 0.18, events)
  }

  if (input.gatherHeld >= GATHER_CHARGE_TIME && state.gatherCharges > 0) {
    state.gatherCharges -= 1
    for (const mote of state.motes) {
      if (mote.kind === 'deep') mote.depth = Math.min(0.98, mote.depth + 0.4)
      else mote.depth = Math.max(0.1, mote.depth - 0.25)
    }
    events.gathered = true
  }

  // Idling drains light, so there is no safe state to sit in.
  changeLight(state, -LIGHT_IDLE_DRAIN * dt, events)

  if (state.waveResolved >= state.waveQuota) advanceWave(state, rng, events)

  return events
}

function movePlayer(state: LumenState, input: LumenInput, dt: number): void {
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (direction !== 0) {
    state.playerAngle = wrapAngle(state.playerAngle + direction * RIM_SPEED * dt, state.segments)
  }
}

function updateDive(state: LumenState, input: LumenInput, dt: number, events: LumenEvents): void {
  if (state.diveTimer > 0) {
    state.diveTimer = Math.max(0, state.diveTimer - dt)
    const phase = 1 - state.diveTimer / DIVE_DURATION
    // Ease down and back so the dive has weight at both ends.
    const curve = Math.sin(phase * Math.PI)
    state.playerDepth = 1 - (1 - DIVE_DEPTH) * curve
    return
  }

  state.playerDepth = 1
  if (!input.dive) return

  const blocking = state.spires.find(
    (spire) => segmentDistance(spire.segment, state.playerAngle, state.segments) < 0.7
      && spire.height >= SPIRE_BLOCK_HEIGHT,
  )
  if (blocking) {
    events.diveBlocked = true
    changeLight(state, -1.5, events)
    return
  }

  state.diveTimer = DIVE_DURATION
  changeLight(state, -DIVE_LIGHT_COST, events)
  events.dived = true
}

function updateShadows(state: LumenState, dt: number, rng: Rng): void {
  for (let i = state.shadows.length - 1; i >= 0; i--) {
    const shadow = state.shadows[i]
    if (!shadow) continue
    shadow.timer -= dt
    if (!shadow.active && shadow.timer <= 0) {
      shadow.active = true
      shadow.timer = SHADOW_DURATION
    } else if (shadow.active && shadow.timer <= 0) {
      state.shadows.splice(i, 1)
    }
  }

  const wanted = Math.min(3, 1 + Math.floor(state.wave / 2))
  if (state.shadows.length < wanted && rng.chance(dt * 0.55)) {
    state.shadows.push({
      segment: rng.int(0, state.segments - 1),
      timer: SHADOW_TELEGRAPH,
      active: false,
    })
  }
}

function updateSpires(state: LumenState, dt: number, rng: Rng): void {
  for (const spire of state.spires) {
    spire.height = Math.min(1, spire.height + dt * 0.055)
  }
  const wanted = Math.min(4, 1 + Math.floor(state.wave / 2))
  if (state.spires.length < wanted && rng.chance(dt * 0.4)) {
    state.spires.push({ segment: rng.int(0, state.segments - 1), height: 0.12 })
  }
}

function spawnMotes(state: LumenState, dt: number, rng: Rng): void {
  state.spawnTimer -= dt
  if (state.spawnTimer > 0) return
  state.spawnTimer = spawnInterval(state)

  const remaining = state.waveQuota - state.waveResolved - state.motes.length
  if (remaining <= 0) return

  // Roughly a quarter of motes sink instead of rising: those are the deep ones.
  const deep = rng.chance(0.26)
  state.motes.push({
    angle: rng.range(0, state.segments),
    depth: deep ? 0.62 : 0.08,
    kind: deep ? 'deep' : 'rising',
    speed: deep
      ? 0.055 + state.wave * 0.004
      : 0.075 + state.wave * 0.011 + rng.range(0, 0.03),
    drift: rng.range(-0.35, 0.35),
  })
}

function moveMotes(state: LumenState, dt: number, events: LumenEvents): void {
  let escaped = 0
  for (let i = state.motes.length - 1; i >= 0; i--) {
    const mote = state.motes[i]
    if (!mote) continue

    mote.angle = wrapAngle(mote.angle + mote.drift * dt, state.segments)
    mote.depth += (mote.kind === 'rising' ? mote.speed : -mote.speed) * dt

    if (mote.kind === 'rising' && mote.depth >= 1) {
      state.motes.splice(i, 1)
      state.motesEscaped += 1
      state.waveResolved += 1
      escaped += 1
    } else if (mote.kind === 'deep' && mote.depth <= 0.06) {
      // A deep mote that reaches the bottom is lost, but costs no light.
      state.motes.splice(i, 1)
      state.waveResolved += 1
    }
  }

  if (escaped > 0) {
    events.escaped = escaped
    changeLight(state, LIGHT_PER_ESCAPE * escaped, events)
    // Losing light halves the multiplier rather than erasing it.
    state.multiplier = Math.max(1, Math.floor(state.multiplier / 2))
  }
}

function bloom(state: LumenState, wide: boolean, events: LumenEvents): void {
  state.bloomCooldown = BLOOM_COOLDOWN
  state.bloomPulse = 1
  state.bloomWide = wide

  const angularReach = wide ? 2.6 : 1.4
  const depthReach = wide ? 0.16 : 0.24
  const inShadow = state.shadows.some(
    (shadow) => shadow.active
      && segmentDistance(shadow.segment, state.playerAngle, state.segments) < 0.7,
  )
  if (inShadow) return

  const caught: { kind: MoteKind; angle: number; depth: number }[] = []
  for (let i = state.motes.length - 1; i >= 0; i--) {
    const mote = state.motes[i]
    if (!mote) continue
    const angular = segmentDistance(mote.angle, state.playerAngle, state.segments)
    if (angular > angularReach) continue
    if (Math.abs(mote.depth - state.playerDepth) > depthReach) continue

    state.motes.splice(i, 1)
    state.waveResolved += 1
    caught.push({ kind: mote.kind, angle: mote.angle, depth: mote.depth })

    if (mote.kind === 'deep') {
      state.deepCaught += 1
      state.score += Math.round(400 * state.multiplier)
      changeLight(state, LIGHT_PER_DEEP, events)
      state.multiplier = 1 + Math.floor(state.deepCaught / 5)
    } else {
      state.motesCaught += 1
      state.score += Math.round(100 * state.multiplier)
      changeLight(state, LIGHT_PER_MOTE, events)
    }
  }

  // A bloom also dissolves a spire in reach, returning its light to the well.
  for (let i = state.spires.length - 1; i >= 0; i--) {
    const spire = state.spires[i]
    if (!spire) continue
    if (segmentDistance(spire.segment, state.playerAngle, state.segments) > angularReach) continue
    if (state.playerDepth > 0.75) continue
    state.spires.splice(i, 1)
    state.spiresDissolved += 1
    state.score += Math.round(150 * state.multiplier)
    changeLight(state, 3, events)
    events.spireDissolved = spire.segment
  }

  if (caught.length > 0) events.caught = caught
}

function advanceWave(state: LumenState, rng: Rng, events: LumenEvents): void {
  state.score += Math.round(1000 * state.multiplier * (1 + state.spiresDissolved))
  state.wave += 1
  state.waveQuota = waveQuotaFor(state.wave)
  state.waveResolved = 0
  state.gatherCharges = 1
  state.spiresDissolved = 0
  events.waveCleared = state.wave

  // The web breathes: the segment count changes under the player's feet.
  const options = [12, 14, 16, 18, 20]
  const next = options[rng.int(0, options.length - 1)] ?? 16
  if (next !== state.segments) {
    const scale = next / state.segments
    state.playerAngle = wrapAngle(state.playerAngle * scale, next)
    for (const mote of state.motes) mote.angle = wrapAngle(mote.angle * scale, next)
    for (const spire of state.spires) {
      spire.segment = Math.floor(wrapAngle(spire.segment * scale, next))
    }
    state.shadows = []
    state.segments = next
    state.targetSegments = next
    state.morphProgress = 0
    events.morphed = true
  }
}

function changeLight(state: LumenState, delta: number, events: LumenEvents): void {
  state.light = clamp(state.light + delta, 0, LIGHT_CAPACITY)
  if (state.light <= 0 && state.alive) {
    state.alive = false
    events.died = true
  }
}

/** Wrap a continuous segment position into 0..segments. */
export function wrapAngle(angle: number, segments: number): number {
  const wrapped = angle % segments
  return wrapped < 0 ? wrapped + segments : wrapped
}

/** Shortest distance between two positions on the rim, in segment units. */
export function segmentDistance(a: number, b: number, segments: number): number {
  const raw = Math.abs(wrapAngle(a, segments) - wrapAngle(b, segments))
  return Math.min(raw, segments - raw)
}

export function isDiving(state: LumenState): boolean {
  return state.diveTimer > 0
}

export function shadowAt(state: LumenState, segment: number): ShadowLane | undefined {
  return state.shadows.find(
    (shadow) => segmentDistance(shadow.segment, segment, state.segments) < 0.7,
  )
}
