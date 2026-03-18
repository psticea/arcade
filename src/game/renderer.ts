import type { FallingWord } from './wordManager.ts'
import type { Particle } from './particleSystem.ts'

const GRID_SPACING = 60
const GRID_ALPHA = 0.06

export function renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  ctx.fillStyle = '#0a0a1a'
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = `rgba(0, 255, 242, ${GRID_ALPHA})`
  ctx.lineWidth = 1
  const offset = (time * 8) % GRID_SPACING

  for (let y = offset; y < h; y += GRID_SPACING) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  for (let x = 0; x < w; x += GRID_SPACING) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
}

export function renderWords(ctx: CanvasRenderingContext2D, words: FallingWord[]): void {
  for (const word of words) {
    const fontSize = 22
    ctx.font = `700 ${fontSize}px 'Inter', sans-serif`
    ctx.textBaseline = 'top'

    const matched = word.text.slice(0, word.matchedChars)
    const remaining = word.text.slice(word.matchedChars)

    if (word.matchedChars > 0) {
      ctx.shadowColor = '#00fff2'
      ctx.shadowBlur = 16
      ctx.fillStyle = '#00fff2'
      ctx.fillText(matched, word.x, word.y)

      const matchedWidth = ctx.measureText(matched).width
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.fillText(remaining, word.x + matchedWidth, word.y)
    } else {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.3)'
      ctx.shadowBlur = 8
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.fillText(word.text, word.x, word.y)
    }

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }
}

export function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.globalAlpha = p.alpha
    ctx.shadowColor = p.color
    ctx.shadowBlur = 12
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

export function renderDangerZone(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createLinearGradient(0, h - 80, 0, h)
  gradient.addColorStop(0, 'rgba(255, 0, 50, 0)')
  gradient.addColorStop(1, 'rgba(255, 0, 50, 0.15)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, h - 80, w, 80)
}
