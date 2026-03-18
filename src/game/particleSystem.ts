export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
  color: string
  life: number
  maxLife: number
}

const NEON_COLORS = ['#00fff2', '#ff00ff', '#ffff00', '#00ff88', '#ff4466', '#aa66ff']

export function spawnExplosion(x: number, y: number, wordLength: number): Particle[] {
  const count = 20 + wordLength * 4
  const particles: Particle[] = []

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8
    const speed = 80 + Math.random() * 220
    const life = 400 + Math.random() * 500

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      size: 2 + Math.random() * 5,
      color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)] ?? '#00fff2',
      life,
      maxLife: life,
    })
  }

  return particles
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vy: p.vy + 120 * dt,
      life: p.life - dt * 1000,
      alpha: Math.max(0, p.life / p.maxLife),
      size: p.size * (0.98 + 0.02 * (p.life / p.maxLife)),
    }))
    .filter((p) => p.life > 0)
}
