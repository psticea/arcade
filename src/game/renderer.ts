import type { FallingWord } from './wordManager.ts'
import type { Particle } from './particleSystem.ts'

const GRID_SPACING = 64

export function renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  ctx.fillStyle = '#42647a'
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(247, 247, 243, 0.09)'
  ctx.lineWidth = 1
  const offset = (time * 10) % GRID_SPACING

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
    const paddingX = 10
    const paddingY = 7
    ctx.font = `900 ${fontSize}px Arial, sans-serif`
    ctx.textBaseline = 'top'

    const matched = word.text.slice(0, word.matchedChars)
    const remaining = word.text.slice(word.matchedChars)
    const textWidth = ctx.measureText(word.text).width
    const tileWidth = textWidth + paddingX * 2
    const tileHeight = fontSize + paddingY * 2

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(29, 41, 48, 0.38)'
    ctx.fillRect(word.x + 3, word.y + 3, tileWidth, tileHeight)
    ctx.fillStyle = word.targeted ? '#e7d796' : '#f7f7f3'
    ctx.fillRect(word.x, word.y, tileWidth, tileHeight)
    ctx.strokeStyle = '#1d2930'
    ctx.lineWidth = 2
    ctx.strokeRect(word.x, word.y, tileWidth, tileHeight)

    if (word.matchedChars > 0) {
      ctx.fillStyle = '#b05f50'
      ctx.fillText(matched, word.x + paddingX, word.y + paddingY)

      const matchedWidth = ctx.measureText(matched).width
      ctx.fillStyle = '#1d2930'
      ctx.fillText(remaining, word.x + paddingX + matchedWidth, word.y + paddingY)
    } else {
      ctx.fillStyle = '#1d2930'
      ctx.fillText(word.text, word.x + paddingX, word.y + paddingY)
    }
  }
}

export function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.globalAlpha = p.alpha
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
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
  ctx.fillStyle = '#b96858'
  ctx.fillRect(0, h - 58, w, 58)
  ctx.fillStyle = '#1d2930'
  ctx.fillRect(0, h - 58, w, 2)
}
