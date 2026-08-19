import { describe, it, expect } from 'vitest'
import { createRng } from '../lib/prng.ts'
import {
  LAMPS,
  TUNING,
  createState,
  ringDelta,
  ringDistance,
  step,
  type LumenInput,
  type LumenState,
} from '../games/lumen/simulation.ts'

/**
 * Balance, by simulation rather than by introspection.
 *
 * A systems game cannot be verified by playing it yourself, because you play it
 * the way you designed it. These are eight policies covering the shapes a real
 * player might settle into — one furnace, two, a big arc, a fully lit ring, a
 * plausible-looking spread with no adjacency in it, and two degenerate ones —
 * played out over many seeds. What we are looking for is a line of play that is
 * correct regardless of context, which would make every other option a trap.
 *
 * Runs at 60 Hz rather than 120 Hz purely for speed; the fixed-timestep tests in
 * `lumen.test.ts` establish that this does not change the outcome.
 */

const DT = 1 / 60
const LIMIT = 420
const SEEDS = 14

const NOTHING: LumenInput = { left: false, right: false, pour: false, draw: false }

type Policy = (state: LumenState) => LumenInput

function toward(state: LumenState, target: number): LumenInput {
  const delta = ringDelta(state.keeper, target)
  if (Math.abs(delta) < 0.06) return { ...NOTHING }
  return { left: delta < 0, right: delta > 0, pour: false, draw: false }
}

/** Every serious policy takes the sign nearest to it, and pays the walk for it. */
function claimOffer(state: LumenState): LumenInput | undefined {
  if (state.offers.length === 0) return undefined
  let best = state.offers[0]
  let nearest = Infinity
  for (const offer of state.offers) {
    const distance = ringDistance(state.keeper, offer.lamp)
    if (distance < nearest) {
      nearest = distance
      best = offer
    }
  }
  if (!best) return undefined
  const move = toward(state, best.lamp)
  move.pour = nearest <= TUNING.claimReach * 0.6
  return move
}

/**
 * Grow toward a ring shape, in order, and only when it can be afforded.
 *
 * A policy that tries to open a fourth fire out of a two-fire budget spreads
 * its light so thin that nothing burns and it dies in forty seconds — which is
 * true of a player too, and is not what we are trying to measure. So each of
 * these tops up what is already burning, and only opens the next brazier once
 * everything lit is nearly full and there is spare light in the lantern.
 */
function grow(order: readonly number[]): Policy {
  return (state) => {
    const offer = claimOffer(state)
    if (offer) return offer

    const active: number[] = []
    for (const index of order) {
      if ((state.lamps[index]?.fuel ?? 0) > TUNING.darkFuel) active.push(index)
    }
    if (active.length === 0) active.push(order[0] ?? 0)

    let choice = active[0] ?? 0
    let lowest = Infinity
    for (const index of active) {
      const fuel = state.lamps[index]?.fuel ?? 0
      if (fuel < lowest) {
        lowest = fuel
        choice = index
      }
    }

    const next = order.find((index) => !active.includes(index))
    if (next !== undefined && lowest >= 92 && state.lantern >= 90) choice = next

    const move = toward(state, choice)
    move.pour = ringDistance(state.keeper, choice) <= 0.3
    return move
  }
}

/** Never light anything: pull every brazier into the lantern and sit on it. */
const hoard: Policy = (state) => {
  let target = 0
  let most = -1
  for (let i = 0; i < LAMPS; i++) {
    const fuel = state.lamps[i]?.fuel ?? 0
    if (fuel > most) {
      most = fuel
      target = i
    }
  }
  if (most <= 0) return { ...NOTHING }
  const move = toward(state, target)
  move.draw = ringDistance(state.keeper, target) <= 0.3
  return move
}

/** A player who has not worked anything out yet. The floor of the game. */
function flail(seed: number): Policy {
  const rng = createRng(seed ^ 0x9e37)
  let hold: LumenInput = { ...NOTHING }
  let left = 0
  return () => {
    left -= DT
    if (left <= 0) {
      left = rng.range(0.2, 0.9)
      hold = {
        left: rng.chance(0.3),
        right: rng.chance(0.3),
        pour: rng.chance(0.5),
        draw: rng.chance(0.15),
      }
    }
    return hold
  }
}

interface Outcome {
  score: number
  seconds: number
  watch: number
  burned: number
}

function playOut(seed: number, policy: Policy): Outcome {
  const rng = createRng(seed)
  const state = createState(rng)
  let seconds = 0
  while (state.alive && seconds < LIMIT) {
    step(state, policy(state), DT, rng)
    seconds += DT
  }
  return { score: state.score, seconds, watch: state.watch + 1, burned: state.burned }
}

interface Report {
  name: string
  median: number
  best: number
  seconds: number
  burned: number
  survived: number
}

function evaluate(name: string, build: (seed: number) => Policy): Report {
  const outcomes: Outcome[] = []
  for (let i = 0; i < SEEDS; i++) {
    const seed = 1000 + i * 7717
    outcomes.push(playOut(seed, build(seed)))
  }
  const scores = outcomes.map((o) => o.score).sort((a, b) => a - b)
  const mean = (pick: (o: Outcome) => number) =>
    outcomes.reduce((sum, o) => sum + pick(o), 0) / outcomes.length
  return {
    name,
    median: scores[Math.floor(scores.length / 2)] ?? 0,
    best: scores[scores.length - 1] ?? 0,
    seconds: Math.round(mean((o) => o.seconds)),
    burned: Math.round(mean((o) => o.burned)),
    survived: outcomes.filter((o) => o.seconds >= LIMIT).length,
  }
}

/**
 * Open the next fire one watch at a time.
 *
 * This is the shape a competent player converges on: hold a pair while the
 * Deep is only sending wisps, and add a third and fourth brazier as the maws
 * start arriving, paying multiplier for a band deep enough to kill them. If
 * this does not beat both the fixed shapes, the escalation is not doing its job.
 */
function adaptive(order: readonly number[]): Policy {
  return (state) => {
    const allowed = Math.min(order.length, 2 + Math.max(0, Math.floor((state.watch - 2) / 2)))
    return grow(order.slice(0, allowed))(state)
  }
}

const POLICIES: { name: string; build: (seed: number) => Policy }[] = [
  { name: 'pair', build: () => grow([5, 6]) },
  { name: 'triple', build: () => grow([5, 6, 4]) },
  { name: 'quad', build: () => grow([5, 6, 4, 7]) },
  { name: 'arc of six', build: () => grow([5, 6, 4, 7, 3, 8]) },
  { name: 'two fires', build: () => grow([5, 6, 11, 0]) },
  { name: 'full ring', build: () => grow([5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11]) },
  { name: 'adaptive', build: () => adaptive([5, 6, 4, 7, 3, 8]) },
  { name: 'alternating', build: () => grow([5, 7, 9, 11, 1, 3]) },
  { name: 'hoard', build: () => hoard },
  { name: 'flail', build: flail },
]

const reports = POLICIES.map((policy) => evaluate(policy.name, policy.build))
const find = (name: string): Report => {
  const report = reports.find((r) => r.name === name)
  if (!report) throw new Error(`no report for ${name}`)
  return report
}

describe('LUMEN balance', () => {
  it('reports the spread across ring shapes', () => {
    const rows = [...reports].sort((a, b) => b.median - a.median)
    const table = rows.map((r) =>
      `${r.name.padEnd(12)} median ${String(r.median).padStart(9)}`
      + `  best ${String(r.best).padStart(9)}`
      + `  ${String(r.seconds).padStart(3)}s  burned ${String(r.burned).padStart(3)}`
      + `  survived ${r.survived}/${SEEDS}`).join('\n')
    // eslint-disable-next-line no-console
    console.log(`\nLUMEN balance — ${SEEDS} seeds, ${LIMIT}s cap\n${table}\n`)
    expect(rows).toHaveLength(POLICIES.length)
  })

  /**
   * The strongest single shape the simulation finds is a fully-fuelled adjacent
   * pair. That is fine — it is the shape the game *opens* in, so it had better
   * work — as long as it does not run away with it. It does not: holding the
   * pair scores a little more, and growing the ring as the watches escalate
   * survives a little longer and has the higher ceiling.
   */
  it('has no dominant strategy: holding and growing are within a stone\'s throw', () => {
    const pair = find('pair')
    const grown = find('adaptive')
    expect(pair.median / grown.median).toBeLessThan(1.6)
    expect(grown.seconds).toBeGreaterThan(pair.seconds * 0.85)
    expect(grown.best).toBeGreaterThan(pair.best * 0.8)
  })

  it('has no dead option either: every shape with adjacency in it scores', () => {
    for (const name of ['pair', 'triple', 'quad', 'arc of six', 'two fires', 'full ring']) {
      expect(find(name).median).toBeGreaterThan(0)
    }
  })

  /**
   * The trap, and it is the opposite of what it looks like. Opening a fourth
   * fire is not the cautious play — light is conserved, so a ring you cannot
   * fund runs every brazier below the threshold and kills nothing at all.
   */
  it('over-lighting starves: a ring you cannot fund is worse than two you can', () => {
    expect(find('full ring').median).toBeLessThan(find('pair').median / 5)
    expect(find('full ring').seconds).toBeLessThan(find('pair').seconds / 2)
  })

  it('the spread with no adjacency in it is the trap it looks like it is not', () => {
    // Six lit braziers, none of them touching: plenty of light, nothing dies.
    expect(find('alternating').burned).toBeLessThan(find('pair').burned / 10)
  })

  it('hoarding light is not a way to survive', () => {
    expect(find('hoard').seconds).toBeLessThan(LIMIT * 0.2)
    expect(find('hoard').median).toBeLessThan(find('pair').median / 20)
  })

  it('the night always wins: nothing lasts the cap on every seed', () => {
    for (const report of reports) expect(report.survived).toBeLessThan(SEEDS / 2)
  })

  it('a competent policy clears several watches', () => {
    expect(find('adaptive').seconds).toBeGreaterThan(TUNING.watchLength * 4)
  })
})
