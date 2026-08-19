import { describe, it, expect } from 'vitest'
import { createRng } from '../lib/prng.ts'
import {
  DIVE_DURATION,
  GATHER_CHARGE_TIME,
  LIGHT_CAPACITY,
  createState,
  isDiving,
  segmentDistance,
  step,
  waveQuotaFor,
  wrapAngle,
  type LumenInput,
  type LumenState,
} from '../games/lumen/simulation.ts'

const DT = 1 / 120
const IDLE: LumenInput = {
  left: false, right: false, dive: false, gatherHeld: 0, bloom: false, bloomHeld: 0,
}

function run(state: LumenState, seconds: number, input: LumenInput = IDLE, seed = 1) {
  const rng = createRng(seed)
  const events = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.push(step(state, input, DT, rng))
  }
  return events
}

/**
 * Take the player to the deepest point of a dive and clear the well.
 * Depth below the rim is only reachable by diving, which is the whole point of
 * the deep-mote economy, so tests that involve the well have to go there.
 */
function diveToBottom(state: LumenState): void {
  const rng = createRng(99)
  step(state, { ...IDLE, dive: true }, DT, rng)
  for (let i = 0; i < Math.round(DIVE_DURATION / 2 / DT); i++) {
    step(state, IDLE, DT, rng)
  }
  state.motes = []
  state.spires = []
  state.shadows = []
  state.bloomCooldown = 0
}

describe('LUMEN geometry', () => {
  it('wraps rim positions', () => {
    expect(wrapAngle(0, 16)).toBe(0)
    expect(wrapAngle(16, 16)).toBe(0)
    expect(wrapAngle(17, 16)).toBe(1)
    expect(wrapAngle(-1, 16)).toBe(15)
  })

  it('measures the shortest way round the rim', () => {
    expect(segmentDistance(0, 1, 16)).toBe(1)
    expect(segmentDistance(0, 15, 16)).toBe(1)
    expect(segmentDistance(0, 8, 16)).toBe(8)
    expect(segmentDistance(2, 2, 16)).toBe(0)
  })
})

describe('LUMEN core loop', () => {
  it('starts lit and alive', () => {
    const state = createState(createRng(1))
    expect(state.alive).toBe(true)
    expect(state.light).toBeGreaterThan(0)
    expect(state.multiplier).toBe(1)
  })

  it('is deterministic for identical seeds and inputs', () => {
    const play = () => {
      const state = createState(createRng(7))
      run(state, 4, IDLE, 7)
      return JSON.stringify(state)
    }
    expect(play()).toBe(play())
  })

  it('idling drains light — there is no safe state', () => {
    const state = createState(createRng(2))
    const before = state.light
    run(state, 2)
    expect(state.light).toBeLessThan(before)
  })

  it('runs out of light eventually and ends the run', () => {
    const state = createState(createRng(3))
    state.light = 2
    const events = run(state, 5)
    expect(state.alive).toBe(false)
    expect(events.some((e) => e.died)).toBe(true)
  })

  it('does not simulate once dark', () => {
    const state = createState(createRng(4))
    state.light = 0.5
    run(state, 3)
    expect(state.alive).toBe(false)
    const frozen = JSON.stringify(state)
    run(state, 2)
    expect(JSON.stringify(state)).toBe(frozen)
  })

  it('moves the player around the rim and wraps', () => {
    const state = createState(createRng(5))
    run(state, 0.5, { ...IDLE, right: true })
    expect(state.playerAngle).toBeGreaterThan(0)
    const state2 = createState(createRng(5))
    run(state2, 0.5, { ...IDLE, left: true })
    expect(state2.playerAngle).toBeGreaterThan(state2.segments - 5)
  })

  it('spawns motes over time', () => {
    const state = createState(createRng(6))
    run(state, 3)
    expect(state.motes.length).toBeGreaterThan(0)
  })

  it('spawns both rising and deep motes', () => {
    const state = createState(createRng(8))
    let sawRising = false
    let sawDeep = false
    const rng = createRng(8)
    for (let i = 0; i < 4000; i++) {
      step(state, IDLE, DT, rng)
      for (const mote of state.motes) {
        if (mote.kind === 'rising') sawRising = true
        if (mote.kind === 'deep') sawDeep = true
      }
      state.light = 80
    }
    expect(sawRising).toBe(true)
    expect(sawDeep).toBe(true)
  })
})

describe('LUMEN catching', () => {
  it('a bloom catches a mote in reach and scores', () => {
    const state = createState(createRng(9))
    // Just short of the rim: a mote that reaches depth 1 has already escaped.
    state.motes = [{ angle: state.playerAngle, depth: 0.95, kind: 'rising', speed: 0, drift: 0 }]
    const events = step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    expect(events.caught).toHaveLength(1)
    expect(state.score).toBe(100)
    expect(state.motesCaught).toBe(1)
  })

  it('a bloom misses a mote on the far side of the rim', () => {
    const state = createState(createRng(9))
    state.motes = [{
      angle: wrapAngle(state.playerAngle + state.segments / 2, state.segments),
      depth: 0.95, kind: 'rising', speed: 0, drift: 0,
    }]
    const events = step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    expect(events.caught).toBeUndefined()
    expect(state.score).toBe(0)
  })

  it('a bloom misses a mote at the wrong depth', () => {
    const state = createState(createRng(9))
    state.motes = [{ angle: state.playerAngle, depth: 0.3, kind: 'deep', speed: 0, drift: 0 }]
    const events = step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    expect(events.caught).toBeUndefined()
  })

  it('deep motes are worth four times a rising mote and add light', () => {
    const rising = createState(createRng(10))
    rising.motes = [{ angle: rising.playerAngle, depth: 0.95, kind: 'rising', speed: 0, drift: 0 }]
    step(rising, { ...IDLE, bloom: true }, DT, createRng(1))

    const deep = createState(createRng(10))
    diveToBottom(deep)
    deep.light = 50
    deep.motes = [{ angle: deep.playerAngle, depth: deep.playerDepth, kind: 'deep', speed: 0, drift: 0 }]
    const lightBefore = deep.light
    step(deep, { ...IDLE, bloom: true }, DT, createRng(1))

    expect(deep.score).toBe(rising.score * 4)
    expect(deep.light).toBeGreaterThan(lightBefore)
  })

  it('the multiplier climbs only with deep motes', () => {
    const state = createState(createRng(11))
    diveToBottom(state)
    for (let i = 0; i < 5; i++) {
      state.motes = [{
        angle: state.playerAngle, depth: state.playerDepth, kind: 'deep', speed: 0, drift: 0,
      }]
      state.bloomCooldown = 0
      step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    }
    expect(state.deepCaught).toBe(5)
    expect(state.multiplier).toBe(2)

    const risingOnly = createState(createRng(11))
    for (let i = 0; i < 8; i++) {
      risingOnly.motes = [{
        angle: risingOnly.playerAngle, depth: 0.95, kind: 'rising', speed: 0, drift: 0,
      }]
      risingOnly.bloomCooldown = 0
      step(risingOnly, { ...IDLE, bloom: true }, DT, createRng(1))
    }
    expect(risingOnly.multiplier).toBe(1)
  })

  it('a shadow lane blocks the bloom entirely', () => {
    const state = createState(createRng(12))
    state.shadows = [{ segment: Math.round(state.playerAngle), timer: 5, active: true }]
    state.motes = [{ angle: state.playerAngle, depth: 0.95, kind: 'rising', speed: 0, drift: 0 }]
    const events = step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    expect(events.caught).toBeUndefined()
    expect(state.motes).toHaveLength(1)
  })

  it('respects the bloom cooldown', () => {
    const state = createState(createRng(13))
    state.motes = [{ angle: state.playerAngle, depth: 0.95, kind: 'rising', speed: 0, drift: 0 }]
    step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    state.motes = [{ angle: state.playerAngle, depth: 0.95, kind: 'rising', speed: 0, drift: 0 }]
    const events = step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    expect(events.caught).toBeUndefined()
  })

  it('a wide bloom reaches further round the rim than a tight one', () => {
    const makeState = () => {
      const state = createState(createRng(14))
      state.motes = [{
        angle: wrapAngle(state.playerAngle + 2, state.segments),
        depth: 0.95, kind: 'rising', speed: 0, drift: 0,
      }]
      return state
    }
    const tight = makeState()
    step(tight, { ...IDLE, bloom: true, bloomHeld: 0 }, DT, createRng(1))
    expect(tight.motes).toHaveLength(1)

    const wide = makeState()
    step(wide, { ...IDLE, bloom: true, bloomHeld: 0.3 }, DT, createRng(1))
    expect(wide.motes).toHaveLength(0)
  })
})

describe('LUMEN escapes', () => {
  it('a mote that crests the rim escapes and drains light', () => {
    const state = createState(createRng(15))
    state.motes = [{ angle: 0, depth: 0.99, kind: 'rising', speed: 2, drift: 0 }]
    const before = state.light
    const events = run(state, 0.2)
    expect(events.some((e) => e.escaped)).toBe(true)
    expect(state.motesEscaped).toBe(1)
    expect(state.light).toBeLessThan(before - 3)
  })

  it('an escape halves the multiplier rather than erasing it', () => {
    const state = createState(createRng(16))
    state.multiplier = 8
    state.motes = [{ angle: 0, depth: 0.99, kind: 'rising', speed: 2, drift: 0 }]
    run(state, 0.2)
    expect(state.multiplier).toBe(4)
  })

  it('the multiplier never falls below one', () => {
    const state = createState(createRng(17))
    state.multiplier = 1
    state.motes = [{ angle: 0, depth: 0.99, kind: 'rising', speed: 2, drift: 0 }]
    run(state, 0.2)
    expect(state.multiplier).toBe(1)
  })
})

describe('LUMEN diving', () => {
  it('a dive leaves the rim and returns', () => {
    const state = createState(createRng(18))
    const events = step(state, { ...IDLE, dive: true }, DT, createRng(1))
    expect(events.dived).toBe(true)
    expect(isDiving(state)).toBe(true)

    run(state, DIVE_DURATION * 0.5)
    expect(state.playerDepth).toBeLessThan(0.9)

    run(state, DIVE_DURATION)
    expect(isDiving(state)).toBe(false)
    expect(state.playerDepth).toBeCloseTo(1, 5)
  })

  it('diving costs light', () => {
    const state = createState(createRng(19))
    const before = state.light
    step(state, { ...IDLE, dive: true }, DT, createRng(1))
    expect(state.light).toBeLessThan(before - 1)
  })

  it('a tall spire blocks the dive', () => {
    const state = createState(createRng(20))
    state.spires = [{ segment: Math.round(state.playerAngle), height: 0.9 }]
    const events = step(state, { ...IDLE, dive: true }, DT, createRng(1))
    expect(events.diveBlocked).toBe(true)
    expect(isDiving(state)).toBe(false)
  })

  it('a short spire does not block the dive', () => {
    const state = createState(createRng(20))
    state.spires = [{ segment: Math.round(state.playerAngle), height: 0.2 }]
    const events = step(state, { ...IDLE, dive: true }, DT, createRng(1))
    expect(events.dived).toBe(true)
  })

  it('a bloom from inside the well dissolves a spire', () => {
    const state = createState(createRng(21))
    diveToBottom(state)
    state.spires = [{ segment: Math.round(state.playerAngle), height: 0.8 }]
    const events = step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    expect(events.spireDissolved).toBeDefined()
    expect(state.spires).toHaveLength(0)
    expect(state.spiresDissolved).toBe(1)
  })

  it('a bloom from the rim cannot reach a spire', () => {
    const state = createState(createRng(21))
    state.spires = [{ segment: Math.round(state.playerAngle), height: 0.8 }]
    state.playerDepth = 1
    step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    expect(state.spires).toHaveLength(1)
  })
})

describe('LUMEN waves', () => {
  it('quotas grow with the wave number', () => {
    expect(waveQuotaFor(1)).toBeGreaterThan(waveQuotaFor(0))
    expect(waveQuotaFor(5)).toBeGreaterThan(waveQuotaFor(1))
  })

  it('clearing a wave pays a bonus and raises the quota', () => {
    const state = createState(createRng(22))
    state.waveResolved = state.waveQuota
    const events = step(state, IDLE, DT, createRng(3))
    expect(events.waveCleared).toBe(1)
    expect(state.wave).toBe(1)
    expect(state.score).toBeGreaterThan(0)
    expect(state.waveResolved).toBe(0)
    expect(state.waveQuota).toBe(waveQuotaFor(1))
  })

  it('the gather charge is restored each wave', () => {
    const state = createState(createRng(23))
    state.gatherCharges = 0
    state.waveResolved = state.waveQuota
    step(state, IDLE, DT, createRng(3))
    expect(state.gatherCharges).toBe(1)
  })

  it('gather pulls deep motes up and rising motes back down', () => {
    const state = createState(createRng(24))
    state.motes = [
      { angle: 0, depth: 0.5, kind: 'deep', speed: 0, drift: 0 },
      { angle: 1, depth: 0.8, kind: 'rising', speed: 0, drift: 0 },
    ]
    const events = step(state, { ...IDLE, gatherHeld: GATHER_CHARGE_TIME }, DT, createRng(1))
    expect(events.gathered).toBe(true)
    expect(state.motes[0]!.depth).toBeGreaterThan(0.5)
    expect(state.motes[1]!.depth).toBeLessThan(0.8)
    expect(state.gatherCharges).toBe(0)
  })

  it('light never exceeds capacity', () => {
    const state = createState(createRng(25))
    diveToBottom(state)
    state.light = LIGHT_CAPACITY
    state.motes = [{
      angle: state.playerAngle, depth: state.playerDepth, kind: 'deep', speed: 0, drift: 0,
    }]
    step(state, { ...IDLE, bloom: true }, DT, createRng(1))
    expect(state.light).toBeLessThanOrEqual(LIGHT_CAPACITY)
  })
})
