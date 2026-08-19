import { GRID_SIZE, type CoilState } from './simulation.ts'
import { glowDot, neonLine, neonPolyline } from '../../lib/neon.ts'
import { renderParticles, type Juice } from '../../lib/juice.ts'
import { clamp } from '../../lib/math.ts'

const SAFE_COLOR = '#4d7fff'
const HOT_COLOR = '#ff3d81'
const SNAKE_COLOR = '#00ff88'

/** Ease the arena rotation so the turn is readable rather than a snap. */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: CoilState,
  juice: Juice,
  width: number,
  height: number,
): void {
  ctx.fillStyle = '#03040a'
  ctx.fillRect(0, 0, width, height)

  const board = Math.min(width, height) * 0.82
  const cell = board / GRID_SIZE
  const centerX = width / 2
  const centerY = height / 2

  // Rotation is applied here and nowhere else: the simulation never turns, so
  // the player's keys keep their old meaning while the picture does not.
  const settled = state.rotationSteps
  const previous = (settled + 3) % 4
  const progress = easeInOut(clamp(state.rotationProgress, 0, 1))
  const angle = (previous + (settled - previous + 4) % 4 * progress) * (Math.PI / 2)

  ctx.save()
  ctx.translate(centerX + juice.shakeX, centerY + juice.shakeY)
  ctx.rotate(angle)
  ctx.translate(-board / 2, -board / 2)

  drawArena(ctx, state, board, cell)
  drawPickups(ctx, state, cell)
  drawSnake(ctx, state, cell)

  ctx.restore()

  ctx.save()
  ctx.translate(centerX - board / 2 + juice.shakeX, centerY - board / 2 + juice.shakeY)
  renderParticles(ctx, juice.particles)
  ctx.restore()

  drawPhasePips(ctx, state, width, height)
}

function drawArena(
  ctx: CanvasRenderingContext2D,
  state: CoilState,
  board: number,
  cell: number,
): void {
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = 'rgba(120, 160, 200, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 1; i < GRID_SIZE; i++) {
    ctx.moveTo(i * cell, 0)
    ctx.lineTo(i * cell, board)
    ctx.moveTo(0, i * cell)
    ctx.lineTo(board, i * cell)
  }
  ctx.stroke()
  ctx.restore()

  // The border pulses as a rotation approaches — the turn is always telegraphed.
  const imminent = Number.isFinite(state.untilRotation)
  const pulse = imminent ? 0.5 + 0.5 * Math.sin(state.elapsed * 14) : 0
  const borderColor = imminent ? '#ffd166' : 'rgba(120, 160, 200, 0.75)'
  neonPolyline(ctx, [
    { x: 0, y: 0 },
    { x: board, y: 0 },
    { x: board, y: board },
    { x: 0, y: board },
  ], { color: borderColor, width: 2, glow: 1 + pulse * 2, close: true, alpha: 0.7 + pulse * 0.3 })
}

function drawPickups(ctx: CanvasRenderingContext2D, state: CoilState, cell: number): void {
  for (const pickup of state.pickups) {
    const x = (pickup.x + 0.5) * cell
    const y = (pickup.y + 0.5) * cell
    const hot = pickup.kind === 'hot'
    const pulse = hot ? 1 + Math.sin(state.elapsed * 9) * 0.18 : 1
    glowDot(ctx, x, y, cell * (hot ? 0.3 : 0.24) * pulse, hot ? HOT_COLOR : SAFE_COLOR, hot ? 1.4 : 0.8)
    if (hot) {
      // A ring marks the hot pickup as the one worth chasing.
      ctx.beginPath()
      ctx.arc(x, y, cell * 0.55 * pulse, 0, Math.PI * 2)
      ctx.strokeStyle = HOT_COLOR
      ctx.globalAlpha = 0.4
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
}

function drawSnake(ctx: CanvasRenderingContext2D, state: CoilState, cell: number): void {
  const phasing = state.phaseTimer > 0
  const points = state.snake.map((c) => ({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell }))
  if (points.length > 1) {
    neonPolyline(ctx, points, {
      color: phasing ? '#ffffff' : SNAKE_COLOR,
      width: cell * 0.56,
      glow: phasing ? 2 : 1,
      alpha: phasing ? 0.85 : 1,
    })
  }

  const head = points[0]
  if (!head) return
  glowDot(ctx, head.x, head.y, cell * 0.34, phasing ? '#ffffff' : '#b6ffd8', 1.5)

  // A short antenna showing which way the head is committed to travel.
  neonLine(
    ctx,
    head.x, head.y,
    head.x + state.direction.x * cell * 0.9,
    head.y + state.direction.y * cell * 0.9,
    { color: phasing ? '#ffffff' : SNAKE_COLOR, width: 2, glow: 1.4, alpha: 0.7 },
  )
}

function drawPhasePips(
  ctx: CanvasRenderingContext2D,
  state: CoilState,
  width: number,
  height: number,
): void {
  const radius = 6
  const gap = 20
  const baseX = width / 2 - gap / 2
  const y = height - 34

  for (let i = 0; i < 2; i++) {
    const filled = i < state.phaseCharges
    const x = baseX + i * gap
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.strokeStyle = filled ? '#ffffff' : 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    if (filled) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fill()
    }
  }

  ctx.font = '9px Orbitron, monospace'
  ctx.fillStyle = 'rgba(233,236,245,0.32)'
  ctx.textAlign = 'center'
  ctx.fillText('PHASE', width / 2, y + 22)
  ctx.textAlign = 'left'
}
