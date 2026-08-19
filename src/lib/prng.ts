/**
 * Seeded pseudo-random number generators.
 *
 * Every game draws randomness from here rather than `Math.random()` so that a run
 * is reproducible from its seed. That is what makes deterministic tests, daily-seed
 * challenges and replay verification possible.
 */

/** Hash a 32-bit integer into a well-distributed seed stream. */
export function splitmix32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x9e3779b9) | 0
    let t = a ^ (a >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ (t >>> 15)
    t = Math.imul(t, 0x735a2d97)
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296
  }
}

/**
 * sfc32 — 128-bit state, fast, and passes PractRand/BigCrush.
 * Preferred over mulberry32 because the larger state avoids short cycles.
 */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  let sa = a | 0
  let sb = b | 0
  let sc = c | 0
  let sd = d | 0
  return () => {
    const t = ((sa + sb) | 0) + sd | 0
    sd = (sd + 1) | 0
    sa = sb ^ (sb >>> 9)
    sb = (sc + (sc << 3)) | 0
    sc = (sc << 21) | (sc >>> 11)
    sc = (sc + t) | 0
    return (t >>> 0) / 4294967296
  }
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Float in [min, max). */
  range(min: number, max: number): number
  /** Integer in [min, max]. */
  int(min: number, max: number): number
  /** Uniform choice from a non-empty array. */
  pick<T>(items: readonly T[]): T
  /** True with the given probability. */
  chance(probability: number): boolean
}

/** Build a deterministic RNG from a numeric seed. */
export function createRng(seed: number): Rng {
  const seeder = splitmix32(seed)
  const next = sfc32(
    seeder() * 4294967296,
    seeder() * 4294967296,
    seeder() * 4294967296,
    seeder() * 4294967296,
  )
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]): T => {
      const value = items[Math.floor(next() * items.length)]
      if (value === undefined) throw new Error('pick() called with an empty array')
      return value
    },
    chance: (probability) => next() < probability,
  }
}

/** Turn an arbitrary string into a 32-bit seed (FNV-1a). */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Seed for today's daily challenge, stable for the whole UTC day. */
export function dailySeed(date: Date = new Date()): number {
  const iso = date.toISOString().slice(0, 10)
  return hashSeed(`arcade-daily-${iso}`)
}
