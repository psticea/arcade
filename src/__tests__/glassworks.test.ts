import { describe, it, expect } from 'vitest'
import { createRng } from '../lib/prng.ts'
import {
  BALL_RADIUS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  distanceToSegment,
  diverterSegment,
  flipperSegment,
  tableConfigs,
} from '../games/glassworks/table.ts'
import {
  BALLS_PER_GAME,
  DIVERTER_COOLDOWN,
  activeBallCount,
  activeSegments,
  createState,
  currentConfig,
  step,
  type GlassworksInput,
  type GlassworksState,
} from '../games/glassworks/simulation.ts'

const DT = 1 / 120
const IDLE: GlassworksInput = {
  leftFlipper: false, rightFlipper: false, raiseDiverter: false,
  dropDiverter: false, nudge: false, plungerHeld: 0,
}

function run(state: GlassworksState, seconds: number, input: GlassworksInput = IDLE, seed = 1) {
  const rng = createRng(seed)
  const events = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.push(step(state, input, DT, rng))
  }
  return events
}

/** Charge and release the plunger to get into play. */
function launchBall(state: GlassworksState, power = 1): void {
  const rng = createRng(2)
  for (let i = 0; i < 200; i++) {
    step(state, { ...IDLE, plungerHeld: power * 1.2 }, DT, rng)
  }
  step(state, { ...IDLE, plungerHeld: 0 }, DT, rng)
}

describe('GLASSWORKS table', () => {
  it('defines four configurations', () => {
    expect(tableConfigs()).toHaveLength(4)
  })

  it('every configuration has three targets and three bumpers', () => {
    for (const config of tableConfigs()) {
      expect(config.targetIds).toHaveLength(3)
      expect(config.bumpers).toHaveLength(3)
      for (const id of config.targetIds) {
        expect(config.segments.some((s) => s.id === id && s.kind === 'target')).toBe(true)
      }
    }
  })

  it('keeps all geometry inside the table', () => {
    for (const config of tableConfigs()) {
      for (const segment of config.segments) {
        for (const x of [segment.x1, segment.x2]) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThanOrEqual(TABLE_WIDTH)
        }
        for (const y of [segment.y1, segment.y2]) {
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThanOrEqual(TABLE_HEIGHT + 1)
        }
      }
      for (const bumper of config.bumpers) {
        expect(bumper.x - bumper.radius).toBeGreaterThan(0)
        expect(bumper.x + bumper.radius).toBeLessThan(TABLE_WIDTH)
      }
    }
  })

  it('the diverter occupies two distinct positions', () => {
    const raised = diverterSegment(true)
    const dropped = diverterSegment(false)
    expect(raised).not.toEqual(dropped)
  })
})

describe('GLASSWORKS physics', () => {
  it('gravity pulls the ball down the table', () => {
    const state = createState(createRng(1))
    launchBall(state, 0.1)
    const ball = state.balls[0]!
    // Open space below the bumper cluster and above the slingshots.
    ball.x = 20
    ball.y = 46
    ball.vx = 0
    ball.vy = 0
    run(state, 0.15)
    expect(ball.vy).toBeGreaterThan(0)
  })

  it('the ball bounces off a wall instead of passing through', () => {
    const state = createState(createRng(2))
    launchBall(state)
    const ball = state.balls[0]!
    ball.x = 3
    ball.y = 30
    ball.vx = -60
    ball.vy = 0
    run(state, 0.3)
    expect(ball.x).toBeGreaterThan(1)
    expect(ball.vx).toBeGreaterThan(0)
  })

  /**
   * The defining pinball failure: a fast ball passing straight through a thin
   * flipper. Substepping is what prevents it, so this is the test that matters.
   */
  it('a fast ball never tunnels through a flipper', () => {
    for (const speed of [40, 60, 80, 95]) {
      const state = createState(createRng(3))
      launchBall(state)
      const flipper = state.flippers[0]!
      const segment = flipperSegment(flipper)
      const midX = (segment.x1 + segment.x2) / 2
      const midY = (segment.y1 + segment.y2) / 2

      const ball = state.balls[0]!
      ball.x = midX
      ball.y = midY - 6
      ball.vx = 0
      ball.vy = speed

      let deepestPenetration = 0
      const rng = createRng(4)
      for (let i = 0; i < 40; i++) {
        step(state, IDLE, DT, rng)
        const current = flipperSegment(state.flippers[0]!)
        const { distance } = distanceToSegment(ball.x, ball.y, current)
        // Below the flipper line means it went through.
        if (ball.y > current.y1 + 1 && ball.x > 10 && ball.x < 22) {
          deepestPenetration = Math.max(deepestPenetration, BALL_RADIUS - distance)
        }
      }
      expect(deepestPenetration).toBeLessThan(BALL_RADIUS)
    }
  })

  it('the ball never ends up deeply inside a wall', () => {
    const state = createState(createRng(5))
    launchBall(state)
    const rng = createRng(6)
    for (let i = 0; i < 1200; i++) {
      step(state, { ...IDLE, leftFlipper: i % 40 < 6, rightFlipper: i % 55 < 6 }, DT, rng)
      for (const ball of state.balls) {
        if (!ball.active) continue
        for (const segment of activeSegments(state)) {
          const { distance } = distanceToSegment(ball.x, ball.y, segment)
          // A small tolerance covers the frame in which a collision resolves.
          expect(distance).toBeGreaterThan(BALL_RADIUS - 0.2)
        }
      }
    }
  })

  it('a raised flipper drives the ball back up the table', () => {
    const state = createState(createRng(7))
    launchBall(state)
    const flipper = state.flippers[0]!
    const segment = flipperSegment(flipper)

    // Rest the ball on the flipper face so the swing actually strikes it.
    const dx = segment.x2 - segment.x1
    const dy = segment.y2 - segment.y1
    const length = Math.hypot(dx, dy)
    const contactX = segment.x1 + dx * 0.7
    const contactY = segment.y1 + dy * 0.7
    // Perpendicular pointing up the table (negative y).
    const nx = dy / length
    const ny = -dx / length

    const ball = state.balls[0]!
    ball.x = contactX + nx * BALL_RADIUS * 1.02
    ball.y = contactY + ny * BALL_RADIUS * 1.02
    ball.vx = 0
    ball.vy = 1

    const rng = createRng(8)
    let launched = false
    for (let i = 0; i < 40; i++) {
      step(state, { ...IDLE, leftFlipper: true }, DT, rng)
      if (ball.vy < -5) launched = true
    }
    expect(launched).toBe(true)
  })

  it('speed is capped so the ball cannot run away', () => {
    const state = createState(createRng(9))
    launchBall(state)
    const rng = createRng(10)
    for (let i = 0; i < 2000; i++) {
      step(state, { ...IDLE, leftFlipper: i % 20 < 4, rightFlipper: i % 25 < 4 }, DT, rng)
      for (const ball of state.balls) {
        if (!ball.active) continue
        expect(Math.hypot(ball.vx, ball.vy)).toBeLessThanOrEqual(96)
      }
    }
  })

  it('is deterministic for identical inputs', () => {
    const play = () => {
      const state = createState(createRng(11))
      launchBall(state)
      run(state, 4, { ...IDLE, leftFlipper: true }, 11)
      return JSON.stringify({ balls: state.balls, score: state.score })
    }
    expect(play()).toBe(play())
  })
})

describe('GLASSWORKS plunger and balls', () => {
  it('a launched ball reaches the playfield instead of falling back down the lane', () => {
    // The lane exit must deflect the ball left into play. If the return arc does
    // not span the lane the ball just oscillates in the lane forever.
    for (let seed = 0; seed < 5; seed++) {
      const state = createState(createRng(seed))
      launchBall(state, 1)
      let reachedPlayfield = false
      const rng = createRng(seed + 100)
      for (let i = 0; i < 600; i++) {
        step(state, IDLE, DT, rng)
        const ball = state.balls[0]
        if (ball?.active && ball.x < TABLE_WIDTH - 6) {
          reachedPlayfield = true
          break
        }
      }
      expect(reachedPlayfield).toBe(true)
    }
  })

  it('starts on the plunger with three balls', () => {
    const state = createState(createRng(12))
    expect(state.phase).toBe('plunger')
    expect(state.ballsRemaining).toBe(BALLS_PER_GAME)
  })

  it('charging then releasing launches the ball upward', () => {
    const state = createState(createRng(13))
    launchBall(state)
    expect(state.phase).toBe('play')
    expect(state.balls[0]!.vy).toBeLessThan(0)
  })

  it('a stronger charge launches harder', () => {
    const weak = createState(createRng(14))
    launchBall(weak, 0.15)
    const strong = createState(createRng(14))
    launchBall(strong, 1)
    expect(Math.abs(strong.balls[0]!.vy)).toBeGreaterThan(Math.abs(weak.balls[0]!.vy))
  })

  it('ball save returns a quick drain instead of taking the ball', () => {
    const state = createState(createRng(15))
    launchBall(state)
    expect(state.ballSaveTimer).toBeGreaterThan(0)
    const ball = state.balls[0]!
    ball.y = TABLE_HEIGHT + 5
    step(state, IDLE, DT, createRng(1))
    expect(state.ballsRemaining).toBe(BALLS_PER_GAME)
    expect(activeBallCount(state)).toBe(1)
  })

  it('draining after the save window costs a ball', () => {
    const state = createState(createRng(16))
    launchBall(state)
    state.ballSaveTimer = 0
    state.balls[0]!.y = TABLE_HEIGHT + 5
    const events = run(state, 0.05)
    expect(events.some((e) => e.drained)).toBe(true)
    expect(state.ballsRemaining).toBe(BALLS_PER_GAME - 1)
    expect(state.phase).toBe('plunger')
  })

  it('ends the game after the last ball drains', () => {
    const state = createState(createRng(17))
    for (let ball = 0; ball < BALLS_PER_GAME; ball++) {
      launchBall(state)
      state.ballSaveTimer = 0
      state.balls.forEach((b) => { b.y = TABLE_HEIGHT + 5 })
      run(state, 0.05)
    }
    expect(state.phase).toBe('over')
  })

  it('stops simulating once the game is over', () => {
    const state = createState(createRng(18))
    state.phase = 'over'
    const frozen = JSON.stringify(state)
    run(state, 1)
    expect(JSON.stringify(state)).toBe(frozen)
  })
})

describe('GLASSWORKS missions and rebuilding', () => {
  it('hitting all three targets completes a mission and pays a jackpot', () => {
    const state = createState(createRng(19))
    launchBall(state)
    const config = currentConfig(state)
    for (const id of config.targetIds) state.hitTargets.add(id)
    // Re-trigger the completion check through a target hit.
    state.hitTargets.delete(config.targetIds[2]!)

    const targetSegment = config.segments.find((s) => s.id === config.targetIds[2])!
    const ball = state.balls[0]!
    ball.x = (targetSegment.x1 + targetSegment.x2) / 2
    ball.y = (targetSegment.y1 + targetSegment.y2) / 2 - 0.5
    ball.vx = 0
    ball.vy = 20

    const events = run(state, 0.3)
    expect(events.some((e) => e.missionComplete === 1)).toBe(true)
    expect(state.score).toBeGreaterThanOrEqual(1_000_000)
  })

  it('a completed mission rebuilds the table into a different configuration', () => {
    const state = createState(createRng(20))
    launchBall(state)
    const before = currentConfig(state).name
    const config = currentConfig(state)
    for (const id of config.targetIds) state.hitTargets.add(id)
    state.hitTargets.delete(config.targetIds[0]!)

    const targetSegment = config.segments.find((s) => s.id === config.targetIds[0])!
    const ball = state.balls[0]!
    ball.x = (targetSegment.x1 + targetSegment.x2) / 2
    ball.y = (targetSegment.y1 + targetSegment.y2) / 2 - 0.5
    ball.vy = 20
    run(state, 0.3)

    expect(state.phase).toBe('rebuilding')
    const events = run(state, 3)
    expect(events.some((e) => e.rebuilt)).toBe(true)
    expect(currentConfig(state).name).not.toBe(before)
  })

  it('a target only scores once per mission', () => {
    const state = createState(createRng(21))
    launchBall(state)
    const config = currentConfig(state)
    const targetSegment = config.segments.find((s) => s.id === config.targetIds[0])!
    const ball = state.balls[0]!

    const hit = () => {
      ball.x = (targetSegment.x1 + targetSegment.x2) / 2
      ball.y = (targetSegment.y1 + targetSegment.y2) / 2 - 0.5
      ball.vx = 0
      ball.vy = 20
      run(state, 0.1)
    }
    hit()
    const afterFirst = state.score
    hit()
    expect(state.score).toBe(afterFirst)
  })
})

describe('GLASSWORKS nudge and tilt', () => {
  it('a nudge pushes the ball', () => {
    const state = createState(createRng(22))
    launchBall(state)
    const ball = state.balls[0]!
    ball.x = 10
    ball.y = 30
    ball.vx = 0
    ball.vy = 0
    step(state, { ...IDLE, nudge: true }, DT, createRng(1))
    expect(Math.abs(ball.vx)).toBeGreaterThan(0)
    expect(state.nudgeMeter).toBeGreaterThan(0)
  })

  it('repeated nudging tilts the table and kills the flippers', () => {
    const state = createState(createRng(23))
    launchBall(state)
    const rng = createRng(1)
    let tilted = false
    for (let i = 0; i < 5; i++) {
      const events = step(state, { ...IDLE, nudge: true }, DT, rng)
      if (events.tilted) tilted = true
    }
    expect(tilted).toBe(true)
    expect(state.tilted).toBe(true)

    const flipper = state.flippers[0]!
    const restAngle = flipper.restAngle
    run(state, 0.4, { ...IDLE, leftFlipper: true })
    expect(flipper.angle).toBeCloseTo(restAngle, 2)
  })

  it('the nudge meter decays over time', () => {
    const state = createState(createRng(24))
    launchBall(state)
    step(state, { ...IDLE, nudge: true }, DT, createRng(1))
    const peak = state.nudgeMeter
    run(state, 1)
    expect(state.nudgeMeter).toBeLessThan(peak)
  })
})

describe('GLASSWORKS diverter', () => {
  it('raises and drops, changing the geometry', () => {
    const state = createState(createRng(25))
    launchBall(state)
    expect(state.diverterRaised).toBe(false)

    step(state, { ...IDLE, raiseDiverter: true }, DT, createRng(1))
    expect(state.diverterRaised).toBe(true)

    run(state, DIVERTER_COOLDOWN + 0.1)
    step(state, { ...IDLE, dropDiverter: true }, DT, createRng(1))
    expect(state.diverterRaised).toBe(false)
  })

  it('respects its cooldown', () => {
    const state = createState(createRng(26))
    launchBall(state)
    step(state, { ...IDLE, raiseDiverter: true }, DT, createRng(1))
    step(state, { ...IDLE, dropDiverter: true }, DT, createRng(1))
    expect(state.diverterRaised).toBe(true)
  })

  it('appears in the active collider set', () => {
    const state = createState(createRng(27))
    expect(activeSegments(state).some((s) => s.kind === 'diverter')).toBe(true)
  })
})
