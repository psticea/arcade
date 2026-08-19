/**
 * Game feel: screen shake, hitstop and particles.
 *
 * Constants follow the "Art of Screenshake" / "Juice It or Lose It" numbers —
 * trauma-squared shake, short freeze frames on significant impacts, and small
 * pooled particle bursts. Shared by every game so the arcade feels consistent.
 */

export const TRAUMA_SMALL = 0.3
export const TRAUMA_BIG = 0.6
export const TRAUMA_CATASTROPHE = 1
const TRAUMA_DECAY_PER_SECOND = 6
const MAX_SHAKE_OFFSET = 16

export const HITSTOP_SMALL = 0.05
export const HITSTOP_LARGE = 0.1
export const HITSTOP_HUGE = 0.167

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
  active: boolean
}

export interface BurstOptions {
  count: number
  speed: [number, number]
  life: [number, number]
  size?: [number, number]
  hue: number
  /** Bias the emission around this angle in radians instead of full 360°. */
  angle?: number
  spread?: number
  /** Negative speeds pull particles inward, for pickup effects. */
  inward?: boolean
}

export interface Juice {
  /** Current shake offset, already scaled by trauma². */
  readonly shakeX: number
  readonly shakeY: number
  /** True while the simulation should be frozen for a freeze frame. */
  readonly frozen: boolean
  readonly particles: readonly Particle[]
  addTrauma(amount: number): void
  freeze(seconds: number): void
  burst(x: number, y: number, options: BurstOptions): void
  /** Advance shake, hitstop and particles. Returns false while frozen. */
  update(dt: number, random?: () => number): boolean
  reset(): void
}

export function createJuice(poolSize = 512): Juice {
  const particles: Particle[] = Array.from({ length: poolSize }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, hue: 0, active: false,
  }))
  let cursor = 0
  let trauma = 0
  let hitstop = 0
  let shakeX = 0
  let shakeY = 0

  return {
    get shakeX() { return shakeX },
    get shakeY() { return shakeY },
    get frozen() { return hitstop > 0 },
    particles,

    addTrauma(amount) {
      trauma = Math.min(1, trauma + amount)
    },

    freeze(seconds) {
      hitstop = Math.max(hitstop, seconds)
    },

    burst(x, y, options) {
      const { count, speed, life, hue, angle, spread = Math.PI * 2, inward } = options
      const size = options.size ?? [1.5, 3.5]
      for (let i = 0; i < count; i++) {
        const p = particles[cursor]
        cursor = (cursor + 1) % particles.length
        if (!p) continue
        const theta = angle === undefined
          ? Math.random() * Math.PI * 2
          : angle + (Math.random() - 0.5) * spread
        const magnitude = speed[0] + Math.random() * (speed[1] - speed[0])
        const signed = inward ? -magnitude : magnitude
        const duration = life[0] + Math.random() * (life[1] - life[0])
        p.x = inward ? x + Math.cos(theta) * 40 : x
        p.y = inward ? y + Math.sin(theta) * 40 : y
        p.vx = Math.cos(theta) * signed
        p.vy = Math.sin(theta) * signed
        p.life = duration
        p.maxLife = duration
        p.size = size[0] + Math.random() * (size[1] - size[0])
        p.hue = hue
        p.active = true
      }
    },

    update(dt, random = Math.random) {
      if (hitstop > 0) {
        hitstop -= dt
        // Particles keep animating during a freeze frame; only simulation stops.
        stepParticles(particles, dt)
        return false
      }

      if (trauma > 0) {
        trauma = Math.max(0, trauma - TRAUMA_DECAY_PER_SECOND * dt)
        const magnitude = MAX_SHAKE_OFFSET * trauma * trauma
        shakeX = (random() * 2 - 1) * magnitude
        shakeY = (random() * 2 - 1) * magnitude
      } else {
        shakeX = 0
        shakeY = 0
      }

      stepParticles(particles, dt)
      return true
    },

    reset() {
      trauma = 0
      hitstop = 0
      shakeX = 0
      shakeY = 0
      for (const p of particles) p.active = false
    },
  }
}

function stepParticles(particles: Particle[], dt: number): void {
  for (const p of particles) {
    if (!p.active) continue
    p.life -= dt
    if (p.life <= 0) {
      p.active = false
      continue
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 0.98
    p.vy *= 0.98
  }
}

/** Draw every live particle additively. Call inside a shaken transform. */
export function renderParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly Particle[],
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const p of particles) {
    if (!p.active) continue
    const t = p.life / p.maxLife
    ctx.globalAlpha = t
    ctx.fillStyle = `hsl(${p.hue} 100% ${50 + t * 30}%)`
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.restore()
}
