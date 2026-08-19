import { describe, it, expect } from 'vitest'
import { createRng } from '../lib/prng.ts'
import {
  GRID_SIZE,
  ROTATE_EVERY,
  createState,
  step,
  type CoilInput,
  type CoilState,
} from '../games/coil/simulation.ts'

const DT = 1 / 120

/**
 * A competent bot: head for a pickup, but only into cells that keep enough of
 * the board reachable (flood fill). Without that lookahead any greedy snake bot
 * traps itself, which would tell us nothing about whether the game is playable.
 */
function greedyPolicy(state: CoilState, prefer: 'hot' | 'safe' | 'nearest'): CoilInput {
  const head = state.snake[0]
  if (!head) return { dx: 0, dy: 0, phase: false }

  const target = pickTarget(state, prefer)
  const options: { dx: number; dy: number }[] = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ]

  const body = state.snake.slice(0, -1)
  const occupied = new Set(body.map((c) => `${c.x},${c.y}`))

  const legal = options.filter((option) => {
    if (option.dx === -state.direction.x && option.dy === -state.direction.y) return false
    const nx = head.x + option.dx
    const ny = head.y + option.dy
    if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) return false
    return !occupied.has(`${nx},${ny}`)
  })

  if (legal.length === 0) return { dx: state.direction.x, dy: state.direction.y, phase: false }

  const scored = legal.map((option) => {
    const nx = head.x + option.dx
    const ny = head.y + option.dy
    const space = reachableCells(nx, ny, occupied)
    const distance = target
      ? Math.abs(nx - target.x) + Math.abs(ny - target.y)
      : 0
    return { option, space, distance }
  })

  // Never take a move that boxes the snake into less room than its own length.
  const roomy = scored.filter((s) => s.space > state.snake.length)
  const pool = roomy.length > 0 ? roomy : scored
  pool.sort((a, b) => a.distance - b.distance || b.space - a.space)

  const best = pool[0]
  return best
    ? { ...best.option, phase: false }
    : { dx: state.direction.x, dy: state.direction.y, phase: false }
}

/** Flood fill from a cell, counting how much of the board stays reachable. */
function reachableCells(startX: number, startY: number, occupied: Set<string>): number {
  const seen = new Set<string>([`${startX},${startY}`])
  const queue: [number, number][] = [[startX, startY]]
  let count = 0
  while (queue.length > 0) {
    const cell = queue.pop()
    if (!cell) break
    const [x, y] = cell
    count += 1
    if (count > GRID_SIZE * GRID_SIZE) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      const key = `${nx},${ny}`
      if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue
      if (occupied.has(key) || seen.has(key)) continue
      seen.add(key)
      queue.push([nx, ny])
    }
  }
  return count
}

function pickTarget(state: CoilState, prefer: 'hot' | 'safe' | 'nearest') {
  if (prefer === 'nearest') {
    const head = state.snake[0]
    if (!head) return undefined
    return [...state.pickups].sort((a, b) =>
      (Math.abs(a.x - head.x) + Math.abs(a.y - head.y)) -
      (Math.abs(b.x - head.x) + Math.abs(b.y - head.y)))[0]
  }
  return state.pickups.find((p) => p.kind === prefer) ?? state.pickups[0]
}

function playBot(seed: number, prefer: 'hot' | 'safe' | 'nearest', seconds = 45) {
  const rng = createRng(seed)
  const state = createState(rng, 'endless')
  const steps = Math.round(seconds / DT)

  // The policy is only recomputed when the head actually moves. Deciding at the
  // simulation rate would run the flood fill ~20x more often than needed.
  let decision: CoilInput = { dx: 0, dy: 0, phase: false }
  let lastHeadKey = ''

  for (let i = 0; i < steps && state.alive; i++) {
    const head = state.snake[0]
    const headKey = head ? `${head.x},${head.y}` : ''
    if (headKey !== lastHeadKey) {
      lastHeadKey = headKey
      decision = greedyPolicy(state, prefer)
    }
    step(state, decision, DT, rng)
  }
  return state
}

describe('COIL playability', () => {
  it('a competent bot scores on every seed and does well on most', () => {
    const results = Array.from({ length: 20 }, (_, seed) => playBot(seed, 'nearest', 25))

    // Every run must score — if a seed produced an unreachable board this fails.
    for (const state of results) {
      expect(state.score).toBeGreaterThan(0)
    }

    // A single naive bot can loop on an occasional seed, so judge the median
    // rather than pretending the test bot is a good player.
    const eaten = results.map((s) => s.pickupsEaten).sort((a, b) => a - b)
    const median = eaten[Math.floor(eaten.length / 2)] ?? 0
    expect(median).toBeGreaterThanOrEqual(4)
  })

  it('never enters an invalid state', () => {
    for (let seed = 0; seed < 20; seed++) {
      const state = playBot(seed, 'nearest', 20)
      const seen = new Set<string>()
      for (const cell of state.snake) {
        expect(cell.x).toBeGreaterThanOrEqual(0)
        expect(cell.y).toBeGreaterThanOrEqual(0)
        expect(cell.x).toBeLessThan(GRID_SIZE)
        expect(cell.y).toBeLessThan(GRID_SIZE)
        seen.add(`${cell.x},${cell.y}`)
      }
      // A living snake must never occupy the same cell twice.
      if (state.alive) expect(seen.size).toBe(state.snake.length)
    }
  })

  it('the greedy hot-chasing line outscores the safe-only line', () => {
    // The multiplier lives where it is most dangerous to go, so chasing hot
    // pickups must pay materially better than always taking the open one.
    let hotTotal = 0
    let safeTotal = 0
    for (let seed = 0; seed < 8; seed++) {
      hotTotal += playBot(seed, 'hot', 25).score
      safeTotal += playBot(seed, 'safe', 25).score
    }
    expect(hotTotal).toBeGreaterThan(safeTotal * 2)
  })

  it('triggers arena rotations during a normal run', () => {
    const rotated = Array.from({ length: 10 }, (_, seed) => playBot(seed, 'nearest', 30))
      .some((state) => state.pickupsEaten >= ROTATE_EVERY && state.rotationSteps !== 0)
    expect(rotated).toBe(true)
  })
})
