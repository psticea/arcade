import {
  PLAYER_RADIUS,
  PROXIMITY_BAND,
  SHAFT_WIDTH,
  distanceToStone,
  effectiveMultiplier,
  visibleObstacles,
  type BallastState,
} from './simulation.ts'
import { glowDot, neonLine, neonPolyline, strokeNeonPath } from '../../lib/neon.ts'
import { renderParticles, type Juice } from '../../lib/juice.ts'
import { clamp } from '../../lib/math.ts'

/** Metres of shaft visible from top to bottom of the viewport. */
const VIEW_METRES = 170
/** The player sits high in the frame so most of the screen is read-ahead. */
const PLAYER_SCREEN_FRACTION = 0.32

export function render(
  ctx: CanvasRenderingContext2D,
  state: BallastState,
  juice: Juice,
  width: number,
  height: number,
): void {
  // One continuous hue journey: green-gold at the surface, near-black at depth.
  const depthFraction = clamp(state.depth / 2400, 0, 1)
  paintWater(ctx, width, height, depthFraction)

  const scale = height / VIEW_METRES
  const shaftPixels = SHAFT_WIDTH * scale
  const originX = (width - shaftPixels) / 2 + juice.shakeX
  const playerScreenY = height * PLAYER_SCREEN_FRACTION + juice.shakeY

  const toX = (x: number) => originX + x * scale
  const toY = (depth: number) => playerScreenY + (depth - state.depth) * scale

  drawSilt(ctx, state, width, height, depthFraction)
  drawWalls(ctx, state, toX, toY, height, depthFraction)
  drawObstacles(ctx, state, toX, toY, scale, depthFraction)
  drawPlayer(ctx, state, toX, playerScreenY, scale)

  renderParticles(ctx, juice.particles)
  drawMultiplier(ctx, state, toX, playerScreenY, scale)
}

function paintWater(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  depthFraction: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  const top = mixColour([46, 74, 52], [3, 8, 14], depthFraction)
  const bottom = mixColour([10, 30, 38], [1, 3, 7], depthFraction)
  gradient.addColorStop(0, `rgb(${top[0]}, ${top[1]}, ${top[2]})`)
  gradient.addColorStop(1, `rgb(${bottom[0]}, ${bottom[1]}, ${bottom[2]})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

function mixColour(a: number[], b: number[], t: number): number[] {
  return [0, 1, 2].map((i) => Math.round((a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * t))
}

/** Silt drifting upward is the only cue for how fast you are sinking. */
function drawSilt(
  ctx: CanvasRenderingContext2D,
  state: BallastState,
  width: number,
  height: number,
  depthFraction: number,
): void {
  ctx.save()
  ctx.fillStyle = `rgba(200, 230, 255, ${0.3 - depthFraction * 0.16})`
  for (let layer = 1; layer <= 3; layer++) {
    const speed = state.sinkSpeed * layer * 0.55
    const count = 26
    const size = layer * 0.7
    for (let i = 0; i < count; i++) {
      const seedX = (i * 97.13 * layer) % width
      const drift = (state.depth * speed * 0.06 + i * 31.7) % (height + 40)
      ctx.fillRect(seedX, height - drift, size, size * 2.4)
    }
  }
  ctx.restore()
}

function drawWalls(
  ctx: CanvasRenderingContext2D,
  state: BallastState,
  toX: (x: number) => number,
  toY: (depth: number) => number,
  height: number,
  depthFraction: number,
): void {
  const leftX = toX(0)
  const rightX = toX(SHAFT_WIDTH)
  const stone = `rgba(${Math.round(28 - depthFraction * 20)}, ${Math.round(34 - depthFraction * 24)}, ${Math.round(48 - depthFraction * 34)}, 1)`

  ctx.fillStyle = stone
  ctx.fillRect(0, 0, leftX, height)
  ctx.fillRect(rightX, 0, ctx.canvas.width - rightX, height)

  // Courses of masonry give the walls scale and show the descent speed.
  ctx.save()
  ctx.strokeStyle = `rgba(150, 190, 210, ${0.16 - depthFraction * 0.1})`
  ctx.lineWidth = 1
  ctx.beginPath()
  const course = 18
  const first = Math.floor((state.depth - 120) / course) * course
  for (let d = first; d < state.depth + 320; d += course) {
    const y = toY(d)
    ctx.moveTo(0, y)
    ctx.lineTo(leftX, y)
    ctx.moveTo(rightX, y)
    ctx.lineTo(ctx.canvas.width, y)
  }
  ctx.stroke()
  ctx.restore()

  const edge = `rgba(190, 225, 235, ${0.75 - depthFraction * 0.35})`
  neonLine(ctx, leftX, 0, leftX, height, { color: edge, width: 2, glow: 1 })
  neonLine(ctx, rightX, 0, rightX, height, { color: edge, width: 2, glow: 1 })
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  state: BallastState,
  toX: (x: number) => number,
  toY: (depth: number) => number,
  scale: number,
  depthFraction: number,
): void {
  for (const obstacle of visibleObstacles(state)) {
    const halfHeight = obstacle.height * scale
    const y = toY(obstacle.depth)
    const tipX = obstacle.side === 'left' ? toX(obstacle.reach) : toX(SHAFT_WIDTH - obstacle.reach)
    const baseX = obstacle.side === 'left' ? toX(0) : toX(SHAFT_WIDTH)

    ctx.beginPath()
    ctx.moveTo(baseX, y - halfHeight)
    ctx.lineTo(tipX, y)
    ctx.lineTo(baseX, y + halfHeight)
    ctx.closePath()
    ctx.fillStyle = `rgba(${Math.round(26 - depthFraction * 18)}, ${Math.round(32 - depthFraction * 22)}, ${Math.round(44 - depthFraction * 30)}, 1)`
    ctx.fill()
    strokeNeonPath(ctx, {
      color: `rgba(190, 225, 235, ${0.7 - depthFraction * 0.3})`,
      width: 1.8,
      glow: 0.9,
    })
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: BallastState,
  toX: (x: number) => number,
  screenY: number,
  scale: number,
): void {
  const x = toX(state.x)
  const radius = PLAYER_RADIUS * scale
  const distance = distanceToStone(state)
  const proximity = clamp(1 - distance / PROXIMITY_BAND, 0, 1)

  // Turbulence near the stone teaches wall-riding without a word of tutorial.
  if (proximity > 0) {
    const rings = 3
    for (let i = 0; i < rings; i++) {
      const phase = (state.elapsed * 3 + i / rings) % 1
      ctx.beginPath()
      ctx.arc(x, screenY, radius * (1 + phase * 2.4), 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(124, 245, 192, ${(1 - phase) * proximity * 0.5})`
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  const trail = 5
  for (let i = trail; i > 0; i--) {
    ctx.beginPath()
    ctx.arc(x - state.vx * scale * 0.012 * i, screenY - i * radius * 0.55, radius * (1 - i * 0.13), 0, Math.PI * 2)
    ctx.fillStyle = `rgba(124, 245, 192, ${0.06 * (trail - i)})`
    ctx.fill()
  }

  glowDot(ctx, x, screenY, radius, proximity > 0.6 ? '#ffe6a3' : '#7cf5c0', 1.4 + proximity)

  // A short line showing which wall gravity is pulling toward.
  const pullX = state.pull === 'right' ? radius * 2.4 : -radius * 2.4
  neonLine(ctx, x, screenY, x + pullX, screenY, {
    color: '#7cf5c0', width: 2, glow: 1.2, alpha: 0.55,
  })
}

/** The multiplier is drawn in the world beside the player, not in the HUD. */
function drawMultiplier(
  ctx: CanvasRenderingContext2D,
  state: BallastState,
  toX: (x: number) => number,
  screenY: number,
  scale: number,
): void {
  const value = effectiveMultiplier(state)
  if (value < 1.15) return

  const x = toX(state.x)
  const radius = PLAYER_RADIUS * scale
  ctx.save()
  ctx.font = 'bold 15px Orbitron, monospace'
  ctx.textAlign = 'center'
  const heat = clamp((value - 1) / 12, 0, 1)
  ctx.fillStyle = `rgba(${Math.round(124 + heat * 131)}, ${Math.round(245 - heat * 45)}, ${Math.round(192 - heat * 100)}, 0.95)`
  ctx.fillText(`x${value.toFixed(1)}`, x, screenY - radius * 2.6)
  ctx.restore()
}

/** Bright arcs on the walls marking the earning ribbon. */
export function drawBandGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const scale = height / VIEW_METRES
  const shaftPixels = SHAFT_WIDTH * scale
  const originX = (width - shaftPixels) / 2
  const band = PROXIMITY_BAND * scale
  const gradientLeft = ctx.createLinearGradient(originX, 0, originX + band, 0)
  gradientLeft.addColorStop(0, 'rgba(124, 245, 192, 0.10)')
  gradientLeft.addColorStop(1, 'rgba(124, 245, 192, 0)')
  ctx.fillStyle = gradientLeft
  ctx.fillRect(originX, 0, band, height)

  const rightEdge = originX + shaftPixels
  const gradientRight = ctx.createLinearGradient(rightEdge, 0, rightEdge - band, 0)
  gradientRight.addColorStop(0, 'rgba(124, 245, 192, 0.10)')
  gradientRight.addColorStop(1, 'rgba(124, 245, 192, 0)')
  ctx.fillStyle = gradientRight
  ctx.fillRect(rightEdge - band, 0, band, height)
  void neonPolyline
}
