import { describe, it, expect } from 'vitest'
import { createRng } from '../lib/prng.ts'
import {
  DOUBLE_FLIP_WINDOW,
  LATERAL_GRAVITY,
  MAX_SAME_WALL_RUN,
  MAX_SINK_SPEED,
  OBSTACLE_SPACING,
  PLAYER_RADIUS,
  PROXIMITY_BAND,
  SHAFT_WIDTH,
  SHOULDER_ABOVE,
  SHOULDER_BELOW,
  createState,
  distanceToStone,
  effectiveMultiplier,
  generateTo,
  reachAt,
  step,
  type BallastState,
} from '../games/ballast/simulation.ts'

const DT = 1 / 120

describe('BALLAST generation', () => {
  it('is deterministic for a seed', () => {
    const a = createState(createRng(5))
    const b = createState(createRng(5))
    expect(a.obstacles).toEqual(b.obstacles)
  })

  it('never lets one wall run clear for too long', () => {
    // Without this guard a long clear stretch becomes a risk-free multiplier
    // farm, which is the degenerate strategy the rules work hardest to prevent.
    for (let seed = 0; seed < 25; seed++) {
      const state = createState(createRng(seed))
      generateTo(state, 6000, createRng(seed + 1))
      const sorted = [...state.obstacles].sort((a, b) => a.depth - b.depth)
      let run = 0
      let previous: string | undefined
      for (const obstacle of sorted) {
        run = obstacle.side === previous ? run + 1 : 1
        previous = obstacle.side
        expect(run).toBeLessThanOrEqual(MAX_SAME_WALL_RUN)
      }
    }
  })

  it('keeps every gap reachable from the previous one', () => {
    // Consecutive teeth on opposite walls force a crossing. The player must be
    // able to cover it in the time between them, or the death is the
    // generator's fault rather than the player's timing.
    for (let seed = 0; seed < 25; seed++) {
      const state = createState(createRng(seed))
      generateTo(state, 6000, createRng(seed + 2))
      const sorted = [...state.obstacles].sort((a, b) => a.depth - b.depth)

      for (let i = 1; i < sorted.length; i++) {
        const previous = sorted[i - 1]!
        const current = sorted[i]!
        if (previous.side === current.side) continue

        const crossing = previous.reach + current.reach - SHAFT_WIDTH + PLAYER_RADIUS * 2
        if (crossing <= 0) continue

        const timeAvailable = (current.depth - previous.depth) / MAX_SINK_SPEED
        // Conservative: assume the player starts the crossing from rest.
        const reachable = 0.5 * LATERAL_GRAVITY * timeAvailable * timeAvailable
        expect(reachable).toBeGreaterThan(crossing)
      }
    }
  })

  it('teeth reach past the centre so the middle is never a free ride', () => {
    for (let seed = 0; seed < 25; seed++) {
      const state = createState(createRng(seed))
      generateTo(state, 6000, createRng(seed + 3))
      for (const obstacle of state.obstacles) {
        expect(obstacle.reach).toBeGreaterThan(SHAFT_WIDTH / 2 + PLAYER_RADIUS)
      }
    }
  })

  it('keeps a survivable channel at every depth', () => {
    for (let seed = 0; seed < 25; seed++) {
      const state = createState(createRng(seed))
      generateTo(state, 6000, createRng(seed + 2))
      for (const obstacle of state.obstacles) {
        // A single tooth must never span more than the shaft minus room to pass.
        expect(obstacle.reach).toBeLessThan(SHAFT_WIDTH - PLAYER_RADIUS * 2 - 8)
      }
    }
  })

  it('spaces obstacles apart', () => {
    const state = createState(createRng(9))
    generateTo(state, 4000, createRng(10))
    const sorted = [...state.obstacles].sort((a, b) => a.depth - b.depth)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.depth - sorted[i - 1]!.depth).toBeGreaterThan(OBSTACLE_SPACING - 10)
    }
  })

  it('generates ahead of the player as the run continues', () => {
    const state = createState(createRng(11))
    const initial = state.generatedTo
    const rng = createRng(12)
    for (let i = 0; i < 2000; i++) step(state, { flip: i % 60 === 0 }, DT, rng)
    expect(state.generatedTo).toBeGreaterThan(initial)
  })
})

describe('BALLAST physics', () => {
  it('gravity accelerates laterally rather than teleporting', () => {
    const state = createState(createRng(1))
    state.pull = 'right'
    const rng = createRng(1)
    const speeds: number[] = []
    for (let i = 0; i < 30; i++) {
      step(state, { flip: false }, DT, rng)
      speeds.push(state.vx)
    }
    expect(speeds[0]!).toBeGreaterThan(0)
    expect(speeds[29]!).toBeGreaterThan(speeds[0]!)
  })

  it('crossing the shaft takes a measurable, tuned time', () => {
    const state = createState(createRng(2))
    state.x = SHAFT_WIDTH / 2
    state.vx = 0
    state.pull = 'right'
    const rng = createRng(2)
    let elapsed = 0
    while (state.alive && elapsed < 5) {
      step(state, { flip: false }, DT, rng)
      elapsed += DT
      if (state.x > SHAFT_WIDTH - PROXIMITY_BAND) break
    }
    // Long enough that a late flip is fatal, short enough to stay tense.
    expect(elapsed).toBeGreaterThan(0.2)
    expect(elapsed).toBeLessThan(3)
  })

  it('a flip reverses the pull', () => {
    const state = createState(createRng(3))
    const before = state.pull
    step(state, { flip: true }, DT, createRng(1))
    expect(state.pull).not.toBe(before)
    expect(state.flips).toBe(1)
  })

  it('sink speed rises with depth and is capped', () => {
    const state = createState(createRng(4))
    const initial = state.sinkSpeed
    const rng = createRng(4)
    for (let i = 0; i < 4000 && state.alive; i++) step(state, { flip: i % 45 === 0 }, DT, rng)
    expect(state.sinkSpeed).toBeGreaterThan(initial)
    expect(state.sinkSpeed).toBeLessThanOrEqual(62)
  })

  it('contact with stone ends the run', () => {
    const state = createState(createRng(6))
    state.x = PLAYER_RADIUS - 1
    const events = step(state, { flip: false }, DT, createRng(1))
    expect(events.died).toBe(true)
    expect(state.alive).toBe(false)
  })

  it('does not simulate once the run is over', () => {
    const state = createState(createRng(7))
    state.x = -5
    step(state, { flip: false }, DT, createRng(1))
    const frozen = JSON.stringify(state)
    for (let i = 0; i < 100; i++) step(state, { flip: true }, DT, createRng(1))
    expect(JSON.stringify(state)).toBe(frozen)
  })

  it('is deterministic for identical seeds and inputs', () => {
    const play = () => {
      const state = createState(createRng(8))
      const rng = createRng(8)
      for (let i = 0; i < 2000; i++) step(state, { flip: i % 50 === 0 }, DT, rng)
      return JSON.stringify(state)
    }
    expect(play()).toBe(play())
  })
})

describe('BALLAST tooth profile', () => {
  const tooth = { depth: 500, side: 'left' as const, reach: 58, height: 18 }

  it('is at full reach across the middle of the tooth', () => {
    expect(reachAt(tooth, 500)).toBe(58)
    expect(reachAt(tooth, 500 - tooth.height * SHOULDER_ABOVE * 0.9)).toBe(58)
    expect(reachAt(tooth, 500 + tooth.height * SHOULDER_BELOW * 0.9)).toBe(58)
  })

  it('returns to the wall at both ends', () => {
    // A tooth that did not close on the wall would leave a sliver of stone
    // hanging in open water, which is the kind of death nobody can read.
    expect(reachAt(tooth, 500 - tooth.height)).toBe(0)
    expect(reachAt(tooth, 500 + tooth.height)).toBe(0)
    expect(reachAt(tooth, 500 + tooth.height * 2)).toBe(0)
  })

  it('never widens as you move away from the centre', () => {
    let previous = Infinity
    for (let t = 0; t <= 1; t += 0.02) {
      const value = reachAt(tooth, 500 + t * tooth.height)
      expect(value).toBeLessThanOrEqual(previous + 1e-9)
      previous = value
    }
  })

  it('sweeps back further above than below', () => {
    // The long upper sweep and compact lower haunch are what make the form read
    // as an arch springing out of the wall rather than a shelf bolted to it.
    const above = reachAt(tooth, 500 - tooth.height * 0.5)
    const below = reachAt(tooth, 500 + tooth.height * 0.5)
    expect(above).toBeLessThan(below)
  })

  it('collision follows the drawn profile, not a bounding box', () => {
    // The player threading the shoulder of a tooth must actually survive there,
    // or the silhouette is lying about where the stone is.
    const state = createState(createRng(40))
    state.obstacles = [{ ...tooth }]
    state.depth = 500 + tooth.height * 0.92
    // Well inside the tooth's full reach, but past where it has tapered away.
    state.x = tooth.reach - 10
    expect(distanceToStone(state)).toBeGreaterThan(0)

    state.depth = 500
    expect(distanceToStone(state)).toBeLessThan(0)
  })
})

describe('BALLAST multiplier', () => {
  it('climbs only inside the proximity band', () => {
    // Only the shaft walls, so the distances are unambiguous.
    const centre = createState(createRng(20))
    centre.obstacles = []
    const rng = createRng(20)
    for (let i = 0; i < 200; i++) {
      centre.x = SHAFT_WIDTH / 2
      centre.vx = 0
      centre.generatedTo = 1e9
      step(centre, { flip: false }, DT, rng)
    }
    expect(centre.multiplier).toBeCloseTo(1, 3)

    const rider = createState(createRng(20))
    rider.obstacles = []
    const rng2 = createRng(20)
    for (let i = 0; i < 200; i++) {
      rider.x = SHAFT_WIDTH - PLAYER_RADIUS - 2
      rider.vx = 0
      rider.generatedTo = 1e9
      step(rider, { flip: false }, DT, rng2)
      if (!rider.alive) break
    }
    expect(rider.multiplier).toBeGreaterThan(1.2)
  })

  it('a flip resets the multiplier', () => {
    const state = createState(createRng(21))
    state.multiplier = 9
    step(state, { flip: true }, DT, createRng(1))
    expect(state.multiplier).toBe(1)
  })

  it('a double flip inside the grace window preserves the multiplier', () => {
    const state = createState(createRng(22))
    state.multiplier = 9
    const rng = createRng(1)
    step(state, { flip: true }, DT, rng)
    expect(state.multiplier).toBe(1)
    const events = step(state, { flip: true }, DT, rng)
    expect(events.doubleFlip).toBe(true)
    expect(state.multiplier).toBe(9)
  })

  it('a second flip after the window does not restore the multiplier', () => {
    const state = createState(createRng(23))
    state.multiplier = 9
    const rng = createRng(1)
    step(state, { flip: true }, DT, rng)
    for (let i = 0; i < Math.ceil(DOUBLE_FLIP_WINDOW / DT) + 4; i++) {
      step(state, { flip: false }, DT, rng)
    }
    const events = step(state, { flip: true }, DT, rng)
    expect(events.doubleFlip).toBeUndefined()
    expect(state.multiplier).toBe(1)
  })

  it('has diminishing returns above the soft cap', () => {
    const state = createState(createRng(24))
    state.multiplier = 8
    const atCap = effectiveMultiplier(state)
    state.multiplier = 16
    const doubled = effectiveMultiplier(state)
    expect(doubled).toBeGreaterThan(atCap)
    // Doubling the raw multiplier must not double the effective one.
    expect(doubled).toBeLessThan(atCap * 2)
  })

  it('records where the best multiplier broke', () => {
    const state = createState(createRng(25))
    state.multiplier = 7
    state.depth = 420
    step(state, { flip: true }, DT, createRng(1))
    expect(state.bestMultiplier).toBeCloseTo(7, 3)
    expect(state.bestMultiplierDepth).toBeCloseTo(420, 0)
  })
})

/**
 * Scripted policies, run headless. The brief's central risk is that one of these
 * turns out to be strictly dominant, and none of them will show up while playing
 * the game the way it was intended to be played.
 *
 * Every policy navigates the slalom and every policy has human limits — a
 * reaction delay and imprecise position sense. Both matter: a policy without
 * lookahead only proves a blind player dies, and a policy with perfect
 * execution shows no risk in skimming the stone, which makes the tightest line
 * dominate for reasons no player would recognise.
 */
type Pilot = (state: BallastState, dt: number) => boolean

/** The next tooth the player has to clear. */
function nextObstacle(state: BallastState) {
  let next: { depth: number; side: 'left' | 'right'; reach: number; height: number } | undefined
  for (const obstacle of state.obstacles) {
    // Stay on the safe side until the tooth is fully behind us — switching
    // while still level with it steers straight through the stone.
    if (obstacle.depth + obstacle.height < state.depth) continue
    if (!next || obstacle.depth < next.depth) next = obstacle
  }
  return next
}

/**
 * Hold a line `margin` metres past the tip of the next tooth. A small margin
 * skims the stone for maximum earning with no room for error; a large one is
 * safe but earns almost nothing.
 */
function makePilot(margin: number, seed: number): Pilot {
  const noise = createRng(seed + 5000)
  let sinceDecision = 0
  const REACTION = 0.075
  const SLOPPINESS = 3

  return (state, dt) => {
    sinceDecision += dt
    if (sinceDecision < REACTION) return false
    sinceDecision = 0

    const next = nextObstacle(state)
    const target = !next
      ? SHAFT_WIDTH / 2
      : next.side === 'left'
        ? Math.min(SHAFT_WIDTH - PLAYER_RADIUS, next.reach + PLAYER_RADIUS + margin)
        : Math.max(PLAYER_RADIUS, SHAFT_WIDTH - next.reach - PLAYER_RADIUS - margin)

    const perceivedX = state.x + noise.range(-SLOPPINESS, SLOPPINESS)
    const stopping = perceivedX
      + Math.sign(state.vx) * (state.vx * state.vx) / (2 * LATERAL_GRAVITY)

    return (state.pull === 'right' && stopping > target)
      || (state.pull === 'left' && stopping < target)
  }
}

/** Ignores the slalom entirely and tries to sit in the middle of the shaft. */
function centrePilot(): Pilot {
  return (state) => {
    const middle = SHAFT_WIDTH / 2
    return (state.pull === 'right' && state.x > middle)
      || (state.pull === 'left' && state.x < middle)
  }
}

const MARGINS = {
  reckless: 2,
  greedy: 5,
  balanced: 8,
  cautious: 16,
  timid: 30,
} as const

function playMargin(margin: number, seed: number, maxSeconds = 90): BallastState {
  const rng = createRng(seed)
  const state = createState(rng)
  const pilot = makePilot(margin, seed)
  const frames = Math.round(maxSeconds / DT)
  for (let frame = 0; frame < frames && state.alive; frame++) {
    step(state, { flip: pilot(state, DT) }, DT, rng)
  }
  return state
}

function playPilot(pilot: Pilot, seed: number, maxSeconds = 90): BallastState {
  const rng = createRng(seed)
  const state = createState(rng)
  const frames = Math.round(maxSeconds / DT)
  for (let frame = 0; frame < frames && state.alive; frame++) {
    step(state, { flip: pilot(state, DT) }, DT, rng)
  }
  return state
}

const SEEDS = 16

function averageMarginScore(margin: number): number {
  let total = 0
  for (let seed = 0; seed < SEEDS; seed++) total += playMargin(margin, seed).score
  return total / SEEDS
}

describe('BALLAST balance — no policy may dominate', () => {
  it('ignoring the slalom to sit in the centre scores almost nothing', () => {
    // If safe centre play pays, the proximity multiplier is not doing its job
    // and the level geometry is handing out a free ride.
    let centreTotal = 0
    for (let seed = 0; seed < SEEDS; seed++) {
      centreTotal += playPilot(centrePilot(), seed).score
    }
    const centre = centreTotal / SEEDS
    expect(averageMarginScore(MARGINS.balanced)).toBeGreaterThan(centre * 4)
  })

  it('has an interior optimum — neither extreme wins', () => {
    // The recklessly tight line dies before it can bank anything, and the timid
    // line never enters the earning band. A balanced margin must beat both, or
    // one of them is a dominant strategy.
    const balanced = averageMarginScore(MARGINS.balanced)
    expect(balanced).toBeGreaterThan(averageMarginScore(MARGINS.reckless))
    expect(balanced).toBeGreaterThan(averageMarginScore(MARGINS.timid))
  })

  it('leaning greedy pays better than playing it safe', () => {
    // The whole game is "the stone is where the money is". If caution won,
    // there would be no reason to ever approach the masonry.
    expect(averageMarginScore(MARGINS.greedy))
      .toBeGreaterThan(averageMarginScore(MARGINS.cautious))
  })

  it('high-frequency flipping scores worse than a committed line', () => {
    // If micro-flipping wins, the multiplier reset is too cheap.
    let microTotal = 0
    for (let seed = 0; seed < SEEDS; seed++) {
      const base = makePilot(MARGINS.balanced, seed)
      let frame = 0
      const micro: Pilot = (state, dt) => {
        frame += 1
        return base(state, dt) || frame % 9 === 0
      }
      microTotal += playPilot(micro, seed).score
    }
    expect(averageMarginScore(MARGINS.balanced)).toBeGreaterThan(microTotal / SEEDS)
  })

  it('always double-flipping does not beat using it sparingly', () => {
    // If it wins, the grace window is too generous and needs shortening.
    let doubleTotal = 0
    for (let seed = 0; seed < SEEDS; seed++) {
      const base = makePilot(MARGINS.balanced, seed)
      let frame = 0
      const spammer: Pilot = (state, dt) => {
        frame += 1
        return base(state, dt) || frame % 24 === 0 || frame % 24 === 1
      }
      doubleTotal += playPilot(spammer, seed).score
    }
    expect(averageMarginScore(MARGINS.balanced)).toBeGreaterThan(doubleTotal / SEEDS)
  })

  it('never flipping is the worst policy of all', () => {
    let neverTotal = 0
    for (let seed = 0; seed < SEEDS; seed++) {
      neverTotal += playPilot(() => false, seed).score
    }
    const never = neverTotal / SEEDS
    expect(averageMarginScore(MARGINS.balanced)).toBeGreaterThan(never)
    expect(averageMarginScore(MARGINS.cautious)).toBeGreaterThan(never)
  })

  it('every policy eventually dies — the shaft is not survivable forever', () => {
    for (const margin of Object.values(MARGINS)) {
      expect(playMargin(margin, 0, 400).alive).toBe(false)
    }
    expect(playPilot(centrePilot(), 0, 400).alive).toBe(false)
  })
})
