import { describe, it, expect } from 'vitest'
import { createRng } from '../lib/prng.ts'
import {
  BOON_IDS,
  LAMPS,
  LAMP_CAPACITY,
  LANTERN_CAPACITY,
  TUNING,
  burnDepthAt,
  computeDerived,
  createState,
  darkLamps,
  illuminationAt,
  ringDelta,
  ringDistance,
  step,
  totalLight,
  wrapRing,
  type LumenInput,
  type LumenState,
} from '../games/lumen/simulation.ts'

const DT = 1 / 120
const IDLE: LumenInput = { left: false, right: false, pour: false, draw: false }

function run(state: LumenState, seconds: number, input: LumenInput = IDLE, seed = 1) {
  const rng = createRng(seed)
  const events = []
  for (let i = 0; i < Math.round(seconds / DT); i++) events.push(step(state, input, DT, rng))
  return events
}

/** Strip the light out of every brazier so a test starts from a known dark ring. */
function darken(state: LumenState): LumenState {
  for (const lamp of state.lamps) lamp.fuel = 0
  return state
}

/** Stop the Deep sending anything new up, so a test sees only what it placed. */
function quiet(state: LumenState): LumenState {
  state.phase = 'respite'
  state.phaseTimer = 9999
  state.shades = []
  return state
}

function light(state: LumenState, index: number, fuel: number): void {
  const lamp = state.lamps[index]
  if (lamp) lamp.fuel = fuel
}

describe('LUMEN ring geometry', () => {
  it('wraps rim positions', () => {
    expect(wrapRing(0)).toBe(0)
    expect(wrapRing(12)).toBe(0)
    expect(wrapRing(13)).toBe(1)
    expect(wrapRing(-1)).toBe(11)
  })

  it('measures the shortest way round', () => {
    expect(ringDistance(0, 1)).toBe(1)
    expect(ringDistance(0, 11)).toBe(1)
    expect(ringDistance(0, 6)).toBe(6)
    expect(ringDelta(11, 0)).toBe(1)
    expect(ringDelta(0, 11)).toBe(-1)
  })
})

/**
 * The load-bearing rule. If a single lamp can ever burn, the entire design
 * collapses into "pour everything into one fire", so this is asserted from
 * several directions rather than once.
 */
describe('LUMEN illumination', () => {
  it('one brazier, however full, never reaches the burning threshold', () => {
    const state = darken(createState(createRng(1)))
    light(state, 3, LAMP_CAPACITY)
    for (let i = 0; i <= 40; i++) {
      const angle = 3 - 2 + (i / 40) * 4
      expect(illuminationAt(state, angle, 1)).toBeLessThan(state.derived.threshold)
    }
    expect(burnDepthAt(state, 3)).toBe(0)
  })

  it('two adjacent braziers do', () => {
    const state = darken(createState(createRng(2)))
    light(state, 3, LAMP_CAPACITY)
    light(state, 4, LAMP_CAPACITY)
    expect(illuminationAt(state, 3.5, 1)).toBeGreaterThan(state.derived.threshold)
    expect(burnDepthAt(state, 3.5)).toBeGreaterThan(0.2)
  })

  it('two braziers with a gap between them do not', () => {
    const state = darken(createState(createRng(3)))
    light(state, 3, LAMP_CAPACITY)
    light(state, 5, LAMP_CAPACITY)
    expect(burnDepthAt(state, 4)).toBe(0)
  })

  it('a pair of half-full braziers is not enough — brightness has to be committed', () => {
    const state = darken(createState(createRng(4)))
    light(state, 3, LAMP_CAPACITY * 0.5)
    light(state, 4, LAMP_CAPACITY * 0.5)
    expect(burnDepthAt(state, 3.5)).toBe(0)
  })

  it('three adjacent braziers reach deeper down the wall than two', () => {
    const pair = darken(createState(createRng(5)))
    light(pair, 3, LAMP_CAPACITY)
    light(pair, 4, LAMP_CAPACITY)

    const triple = darken(createState(createRng(5)))
    light(triple, 3, LAMP_CAPACITY)
    light(triple, 4, LAMP_CAPACITY)
    light(triple, 5, LAMP_CAPACITY)

    expect(burnDepthAt(triple, 4)).toBeGreaterThan(burnDepthAt(pair, 3.5))
  })

  it('illumination falls off with depth, so the band has a floor', () => {
    const state = darken(createState(createRng(6)))
    light(state, 3, LAMP_CAPACITY)
    light(state, 4, LAMP_CAPACITY)
    const rim = illuminationAt(state, 3.5, 1)
    const mid = illuminationAt(state, 3.5, 0.5)
    expect(mid).toBeLessThan(rim)
    expect(illuminationAt(state, 3.5, 0)).toBe(0)
  })

  it('a brazier below the dark threshold casts nothing at all', () => {
    const state = darken(createState(createRng(7)))
    light(state, 3, TUNING.darkFuel)
    expect(illuminationAt(state, 3, 1)).toBe(0)
  })
})

describe('LUMEN the light economy', () => {
  it('opens with a working furnace so the first rule teaches itself', () => {
    const state = createState(createRng(8))
    expect(burnDepthAt(state, 5.5)).toBeGreaterThan(0)
    expect(ringDistance(state.keeper, 5.5)).toBeLessThan(0.01)
  })

  it('pouring moves light from the lantern into the brazier and conserves it', () => {
    const state = darken(createState(createRng(9)))
    state.lantern = 100
    state.keeper = 4
    const before = totalLight(state)
    run(state, 0.5, { ...IDLE, pour: true })
    expect(state.lamps[4]!.fuel).toBeGreaterThan(20)
    // Lamps burn while they are lit, so the total may only fall, never rise.
    expect(totalLight(state)).toBeLessThanOrEqual(before + 1e-9)
    expect(totalLight(state)).toBeGreaterThan(before - 5)
  })

  it('drawing pulls it back out again', () => {
    const state = darken(createState(createRng(10)))
    state.lantern = 0
    state.keeper = 4
    light(state, 4, 90)
    run(state, 0.5, { ...IDLE, draw: true })
    expect(state.lantern).toBeGreaterThan(30)
    expect(state.lamps[4]!.fuel).toBeLessThan(60)
  })

  it('neither the lantern nor a brazier can be overfilled', () => {
    const state = darken(createState(createRng(11)))
    state.lantern = LANTERN_CAPACITY
    state.keeper = 4
    light(state, 4, LAMP_CAPACITY)
    run(state, 1, { ...IDLE, draw: true })
    expect(state.lantern).toBeLessThanOrEqual(LANTERN_CAPACITY)

    const other = darken(createState(createRng(11)))
    other.lantern = LANTERN_CAPACITY
    other.keeper = 4
    run(other, 4, { ...IDLE, pour: true })
    expect(other.lamps[4]!.fuel).toBeLessThanOrEqual(LAMP_CAPACITY)
  })

  it('a bright brazier burns down faster than a dim one', () => {
    const bright = darken(createState(createRng(12)))
    light(bright, 4, 100)
    const dim = darken(createState(createRng(12)))
    light(dim, 4, 20)
    run(bright, 2)
    run(dim, 2)
    expect(100 - bright.lamps[4]!.fuel).toBeGreaterThan(20 - dim.lamps[4]!.fuel)
  })

  it('the run ends when there is no light left anywhere', () => {
    const state = darken(createState(createRng(13)))
    state.lantern = 0
    state.shades = []
    const events = run(state, 0.2)
    expect(state.alive).toBe(false)
    expect(events.some((e) => e.died)).toBe(true)
  })

  it('does not simulate once the ring is dark', () => {
    const state = darken(createState(createRng(14)))
    state.lantern = 0
    run(state, 0.2)
    const frozen = JSON.stringify(state)
    run(state, 2)
    expect(JSON.stringify(state)).toBe(frozen)
  })
})

describe('LUMEN the multiplier is the darkness', () => {
  it('counts unlit braziers', () => {
    const state = darken(createState(createRng(15)))
    state.lantern = 50
    step(state, IDLE, DT, createRng(1))
    expect(darkLamps(state)).toBe(LAMPS)
    expect(state.multiplier).toBe(LAMPS + 1)

    light(state, 0, 80)
    light(state, 1, 80)
    step(state, IDLE, DT, createRng(1))
    expect(state.multiplier).toBe(LAMPS - 1)
  })

  it('a fully lit ring is worth the least', () => {
    const state = createState(createRng(16))
    for (const lamp of state.lamps) lamp.fuel = 80
    step(state, IDLE, DT, createRng(1))
    expect(state.multiplier).toBe(1)
  })
})

describe('LUMEN shades', () => {
  it('rise out of the Deep and are slowed by light', () => {
    const dark = darken(createState(createRng(17)))
    dark.lantern = 200
    dark.shades = [{
      id: 1, angle: 4, climb: 0.1, kind: 'wisp', hp: 1, carried: 0,
      wander: 0, mode: 'rising', latched: -1, sear: 0, shelter: 0, sated: 0,
    }]
    run(dark, 2)

    const lit = darken(createState(createRng(17)))
    lit.lantern = 200
    light(lit, 4, LAMP_CAPACITY)
    light(lit, 5, LAMP_CAPACITY)
    lit.shades = [{
      id: 1, angle: 4, climb: 0.1, kind: 'wisp', hp: 1, carried: 0,
      wander: 0, mode: 'rising', latched: -1, sear: 0, shelter: 0, sated: 0,
    }]
    run(lit, 2)

    expect(dark.shades[0]!.climb).toBeGreaterThan(0.1)
    expect(lit.shades[0]!.climb).toBeLessThan(dark.shades[0]!.climb)
  })

  it('drift toward light rather than straight up', () => {
    const state = darken(createState(createRng(18)))
    state.lantern = 200
    light(state, 6, LAMP_CAPACITY)
    state.shades = [{
      id: 1, angle: 3, climb: 0.05, kind: 'wisp', hp: 1, carried: 0,
      wander: 0, mode: 'rising', latched: -1, sear: 0, shelter: 0, sated: 0,
    }]
    run(state, 2)
    expect(state.shades[0]!.angle).toBeGreaterThan(3.2)
  })

  it('latch onto a lit brazier at the rim and drink it dry', () => {
    const state = darken(createState(createRng(19)))
    state.lantern = 200
    light(state, 4, 80)
    state.shades = [{
      id: 1, angle: 4, climb: 0.99, kind: 'wisp', hp: 1, carried: 0,
      wander: 0, mode: 'rising', latched: -1, sear: 0, shelter: 0, sated: 0,
    }]
    const events = run(state, 1)
    expect(events.some((e) => e.latched === 4)).toBe(true)
    expect(state.shades[0]!.mode).toBe('drinking')
    expect(state.shades[0]!.carried).toBeGreaterThan(10)
    expect(state.lamps[4]!.fuel).toBeLessThan(70)
  })

  it('cannot be burned by the very brazier they are drinking — one lamp is never enough', () => {
    const state = quiet(darken(createState(createRng(20))))
    state.lantern = 200
    light(state, 4, LAMP_CAPACITY)
    state.shades = [{
      id: 1, angle: 4, climb: 1, kind: 'wisp', hp: 1, carried: 0,
      wander: 0, mode: 'drinking', latched: 4, sear: 0, shelter: 0, sated: 0,
    }]
    run(state, 1.5)
    expect(state.shades).toHaveLength(1)
    expect(state.shades[0]!.hp).toBe(1)
  })

  it('but a lit neighbour kills them where they stand', () => {
    const state = quiet(darken(createState(createRng(21))))
    state.lantern = 200
    light(state, 4, LAMP_CAPACITY)
    light(state, 5, LAMP_CAPACITY)
    state.shades = [{
      id: 1, angle: 4, climb: 1, kind: 'wisp', hp: 1, carried: 0,
      wander: 0, mode: 'drinking', latched: 4, sear: 0, shelter: 0, sated: 0,
    }]
    const events = run(state, 2)
    expect(events.some((e) => e.burned)).toBe(true)
    expect(state.shades).toHaveLength(0)
  })

  it('hunt the keeper when they surface in the dark, and steal from the lantern', () => {
    const state = darken(createState(createRng(22)))
    state.lantern = 120
    state.keeper = 0
    state.shades = [{
      id: 1, angle: 3, climb: 0.99, kind: 'wisp', hp: 1, carried: 0,
      wander: 0, mode: 'rising', latched: -1, sear: 0, shelter: 0, sated: 0,
    }]
    const events = run(state, 3)
    expect(events.some((e) => e.stolen !== undefined)).toBe(true)
    expect(state.lantern).toBeLessThan(120)
    expect(state.lightStolen).toBeGreaterThan(0)
  })

  it('give everything they took back when burned', () => {
    const state = darken(createState(createRng(23)))
    state.lantern = 0
    light(state, 4, LAMP_CAPACITY)
    light(state, 5, LAMP_CAPACITY)
    state.shades = [{
      id: 1, angle: 4.5, climb: 1, kind: 'wisp', hp: 1, carried: 40,
      wander: 0, mode: 'hunting', latched: -1, sear: 0, shelter: 0, sated: 5,
    }]
    state.keeper = 4.5
    run(state, 1)
    expect(state.shades).toHaveLength(0)
    expect(state.lantern).toBeGreaterThan(40)
    expect(state.score).toBeGreaterThan(0)
  })

  it('a maw takes far longer to burn than a wisp', () => {
    const build = (kind: 'wisp' | 'maw') => {
      const state = quiet(darken(createState(createRng(24))))
      state.lantern = 200
      state.keeper = 4.5
      light(state, 4, LAMP_CAPACITY)
      light(state, 5, LAMP_CAPACITY)
      state.shades = [{
        id: 1, angle: 4.5, climb: 1, kind, hp: kind === 'wisp' ? 1 : 3.6, carried: 0,
        wander: 0, mode: 'hunting', latched: -1, sear: 0, shelter: 0, sated: 99,
      }]
      return state
    }
    const wisp = build('wisp')
    const maw = build('maw')
    run(wisp, 0.8)
    run(maw, 0.8)
    expect(wisp.shades).toHaveLength(0)
    expect(maw.shades).toHaveLength(1)
  })

  it('spawn spread around the rim instead of clumping', () => {
    const state = createState(createRng(25))
    const rng = createRng(25)
    const seen = new Set<number>()
    for (let i = 0; i < 120 * 30; i++) {
      step(state, IDLE, DT, rng)
      for (const shade of state.shades) seen.add(Math.round(shade.angle) % LAMPS)
      state.lantern = 100
    }
    expect(seen.size).toBeGreaterThanOrEqual(9)
  })
})

describe('LUMEN watches and signs', () => {
  it('offers three distinct signs a third of the ring apart', () => {
    const state = createState(createRng(26))
    state.phaseTimer = 0
    step(state, IDLE, DT, createRng(2))
    expect(state.phase).toBe('respite')
    expect(state.offers).toHaveLength(3)

    const boons = state.offers.map((o) => o.boon)
    expect(new Set(boons).size).toBe(3)
    const lamps = state.offers.map((o) => o.lamp).sort((a, b) => a - b)
    expect(ringDistance(lamps[0]!, lamps[1]!)).toBe(4)
  })

  it('a sign is claimed by standing at it and pouring, and applies immediately', () => {
    const state = createState(createRng(27))
    state.phaseTimer = 0
    step(state, IDLE, DT, createRng(2))
    const offer = state.offers[0]!
    state.keeper = offer.lamp
    state.lantern = 100

    const events = run(state, TUNING.claimTime + 0.1, { ...IDLE, pour: true })
    expect(events.some((e) => e.boon === offer.boon)).toBe(true)
    expect(state.boons[offer.boon]).toBe(1)
    expect(state.offers).toHaveLength(0)
    expect(state.derived).toEqual(computeDerived(state.boons))
  })

  it('every boon is reachable — none is dead weight the bag never deals', () => {
    const state = createState(createRng(28))
    const rng = createRng(28)
    const dealt = new Set<string>()
    for (let i = 0; i < 40; i++) {
      state.phaseTimer = 0
      state.phase = 'watch'
      step(state, IDLE, DT, rng)
      for (const offer of state.offers) dealt.add(offer.boon)
      state.offers = []
      state.phase = 'watch'
    }
    expect(dealt.size).toBe(BOON_IDS.length)
  })

  it('each boon changes exactly the thing it says it changes', () => {
    const base = computeDerived({
      oil: 0, mirror: 0, prism: 0, wick: 0, vigil: 0, iron: 0, ember: 0, gale: 0,
    })
    expect(computeDerived({ ...base, oil: 1 } as never).lampDecay).toBeLessThan(base.lampDecay)
    expect(computeDerived({
      oil: 0, mirror: 1, prism: 0, wick: 0, vigil: 0, iron: 0, ember: 0, gale: 0,
    }).coneHalf).toBeGreaterThan(base.coneHalf)
    expect(computeDerived({
      oil: 0, mirror: 0, prism: 1, wick: 0, vigil: 0, iron: 0, ember: 0, gale: 0,
    }).threshold).toBeLessThan(base.threshold)
    expect(computeDerived({
      oil: 0, mirror: 0, prism: 0, wick: 1, vigil: 0, iron: 0, ember: 0, gale: 0,
    }).pourRate).toBeGreaterThan(base.pourRate)
    expect(computeDerived({
      oil: 0, mirror: 0, prism: 0, wick: 0, vigil: 0, iron: 1, ember: 0, gale: 0,
    }).huntSpeed).toBeLessThan(base.huntSpeed)
  })

  it('a watch ends into a respite, pays out, and then the next watch begins', () => {
    const state = createState(createRng(29))
    state.phaseTimer = 0
    const ended = step(state, IDLE, DT, createRng(2))
    expect(ended.watchEnded).toBe(0)
    expect(state.score).toBeGreaterThan(0)

    state.phaseTimer = 0
    const began = step(state, IDLE, DT, createRng(2))
    expect(began.watchBegan).toBe(1)
    expect(state.watch).toBe(1)
    expect(state.phase).toBe('watch')
  })

  it('nothing new climbs out during a respite', () => {
    const state = createState(createRng(30))
    state.lantern = 200
    state.phase = 'respite'
    state.phaseTimer = 60
    state.shades = []
    run(state, 8)
    expect(state.shades).toHaveLength(0)
  })
})

describe('LUMEN determinism', () => {
  it('replays exactly from the same seed and inputs', () => {
    const play = () => {
      const state = createState(createRng(31))
      run(state, 12, { ...IDLE, right: true, pour: true }, 31)
      return JSON.stringify(state)
    }
    expect(play()).toBe(play())
  })

  it('reaches the same place at 30, 60 and 144 Hz', () => {
    const play = (hz: number) => {
      const state = createState(createRng(32))
      const rng = createRng(32)
      const dt = 1 / hz
      for (let i = 0; i < Math.round(20 * hz); i++) step(state, { ...IDLE, pour: true }, dt, rng)
      return state
    }
    const slow = play(30)
    const normal = play(60)
    const fast = play(144)

    for (const other of [normal, fast]) {
      expect(other.watch).toBe(slow.watch)
      expect(Math.abs(other.lantern - slow.lantern)).toBeLessThan(6)
      expect(Math.abs(totalLight(other) - totalLight(slow))).toBeLessThan(16)
    }
  })

  it('survives a mid-run snapshot and restore', () => {
    const state = createState(createRng(33))
    run(state, 9, { ...IDLE, right: true, pour: true }, 33)

    const saved: LumenState = JSON.parse(JSON.stringify(state))
    const continued = () => {
      const clone: LumenState = JSON.parse(JSON.stringify(saved))
      run(clone, 5, { ...IDLE, pour: true }, 99)
      return JSON.stringify(clone)
    }
    expect(continued()).toBe(continued())
  })
})
