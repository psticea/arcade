/** Small math helpers shared by the games. */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Shortest signed difference between two angles, in radians. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

/** Frame-rate independent exponential smoothing. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt))
}

export interface Vec2 {
  x: number
  y: number
}

export function length(x: number, y: number): number {
  return Math.hypot(x, y)
}

/** Closest point to (px,py) on segment (ax,ay)-(bx,by). */
export function closestPointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): Vec2 {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return { x: ax, y: ay }
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1)
  return { x: ax + dx * t, y: ay + dy * t }
}

export function formatScore(score: number): string {
  return Math.floor(score).toLocaleString('en-US')
}
