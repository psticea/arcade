/**
 * Deterministic hash noise.
 *
 * The masonry needs per-block variation that is *stable* — a block must not
 * shimmer as it scrolls, so its tone has to be a pure function of its position
 * rather than anything sampled per frame. Everything here is integer-hashed and
 * allocation-free.
 */

/** Hash two integers to [0, 1). */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)
  h = Math.imul(h ^ (h >>> 15), 0x2545f491)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

/** Hash three integers to [0, 1). Useful for "channel" variation on one block. */
export function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b9)
  h = Math.imul(h ^ (h >>> 15), 0x2545f491)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Smooth 1D value noise. */
export function noise1(x: number): number {
  const i = Math.floor(x)
  const f = smooth(x - i)
  return hash2(i, 0) * (1 - f) + hash2(i + 1, 0) * f
}

/** Smooth 2D value noise in [0, 1). */
export function noise2(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = hash2(ix, iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1)
  const d = hash2(ix + 1, iy + 1)
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}

/** Layered value noise. Three octaves is enough for stone and for water. */
export function fbm2(x: number, y: number, octaves = 3): number {
  let sum = 0
  let amplitude = 0.5
  let total = 0
  let fx = x
  let fy = y
  for (let i = 0; i < octaves; i++) {
    sum += noise2(fx, fy) * amplitude
    total += amplitude
    amplitude *= 0.5
    fx *= 2.03
    fy *= 2.03
  }
  return sum / total
}
