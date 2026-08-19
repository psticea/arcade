import {
  MAX_SAFE_SPEED,
  SHIP_RADIUS,
  TERRAIN_STEP,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  approachQuality,
  normaliseAngle,
  padAt,
  terrainHeightAt,
  type DescentState,
} from './simulation.ts'
import { glowDot, neonLine, neonPolyline, strokeNeonPath } from '../../lib/neon.ts'
import { renderParticles, type Juice } from '../../lib/juice.ts'
import { clamp, damp } from '../../lib/math.ts'

export interface Camera {
  angle: number
  /** World units visible vertically. Drives zoom. */
  view: number
}

export function createCamera(): Camera {
  return { angle: 0, view: 46 }
}

/**
 * The camera is locked to the ship: rotating swings the whole world around you.
 * It is damped rather than rigid so the horizon stays readable while turning.
 *
 * Zoom is driven by altitude so the ground under the drone is always in frame,
 * pulling in tight for the final approach — the same automatic close-up the
 * original Lunar Lander used.
 */
export function updateCamera(camera: Camera, state: DescentState, dt: number): void {
  camera.angle = damp(camera.angle, -state.ship.angle, 9, dt)

  const ground = terrainHeightAt(state.terrain, state.ship.x)
  const altitude = Math.max(0, ground - state.ship.y)
  const framed = clamp(altitude * 2.3 + 13, 17, 62)
  const target = state.surveying ? 72 : framed
  camera.view = damp(camera.view, target, 4, dt)
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: DescentState,
  camera: Camera,
  juice: Juice,
  width: number,
  height: number,
): void {
  ctx.fillStyle = '#04050c'
  ctx.fillRect(0, 0, width, height)

  const scale = height / camera.view
  const ship = state.ship

  ctx.save()
  ctx.translate(width / 2 + juice.shakeX, height * 0.4 + juice.shakeY)
  ctx.rotate(camera.angle)
  ctx.scale(scale, scale)
  ctx.translate(-ship.x, -ship.y)

  drawStars(ctx, state)
  drawTerrain(ctx, state, scale)
  drawPads(ctx, state)
  drawShip(ctx, state)
  drawVelocityVector(ctx, state)
  renderParticles(ctx, juice.particles)

  ctx.restore()

  drawHorizonTicks(ctx, camera, width, height)
}

/** A faint starfield gives the rotation something to read against. */
function drawStars(ctx: CanvasRenderingContext2D, state: DescentState): void {
  ctx.save()
  ctx.fillStyle = 'rgba(180, 200, 255, 0.5)'
  for (let i = 0; i < 60; i++) {
    const x = ((i * 37.7) % WORLD_WIDTH)
    const y = ((i * 13.3) % (WORLD_HEIGHT * 0.5))
    const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(state.elapsed * 0.6 + i))
    ctx.globalAlpha = twinkle * 0.5
    ctx.fillRect(x, y, 0.12, 0.12)
  }
  ctx.restore()
}

function drawTerrain(ctx: CanvasRenderingContext2D, state: DescentState, scale: number): void {
  const points = state.terrain.heights.map((y, i) => ({ x: i * TERRAIN_STEP, y }))

  // Filled rock below the silhouette keeps the ground readable in greyscale.
  ctx.beginPath()
  ctx.moveTo(0, WORLD_HEIGHT + 10)
  for (const point of points) ctx.lineTo(point.x, point.y)
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT + 10)
  ctx.closePath()
  ctx.fillStyle = '#0a0d18'
  ctx.fill()

  ctx.lineWidth = 2 / scale
  neonPolyline(ctx, points, { color: '#5d7fb8', width: 2 / scale, glow: 0.8, alpha: 0.9 })
}

function drawPads(ctx: CanvasRenderingContext2D, state: DescentState): void {
  const quality = approachQuality(state)
  const targetPad = padAt(state.terrain, state.ship.x)

  for (const pad of state.terrain.pads) {
    const isTarget = targetPad === pad
    // Green / amber / red is the only velocity instrument in the game.
    const colour = isTarget
      ? quality > 0.66 ? '#3dff9e' : quality > 0.33 ? '#ffd166' : '#ff4d6d'
      : '#ffb000'

    neonLine(ctx, pad.left, pad.y, pad.right, pad.y, {
      color: colour,
      width: 0.34,
      glow: isTarget ? 2.4 : 1.1,
      alpha: isTarget ? 1 : 0.55,
    })

    // Multiplier shown as tick marks, so there is still no text in the world.
    const ticks = pad.multiplier === 8 ? 3 : pad.multiplier === 3 ? 2 : 1
    for (let i = 0; i < ticks; i++) {
      const x = pad.left + (pad.right - pad.left) * ((i + 1) / (ticks + 1))
      neonLine(ctx, x, pad.y + 0.3, x, pad.y + 1.1, {
        color: colour,
        width: 0.16,
        glow: 1,
        alpha: isTarget ? 0.9 : 0.4,
      })
    }
  }
}

function drawShip(ctx: CanvasRenderingContext2D, state: DescentState): void {
  const { ship, fuel } = state
  ctx.save()
  ctx.translate(ship.x, ship.y)
  ctx.rotate(ship.angle)

  if (ship.throttle > 0.02 && fuel > 0) {
    // Fuel is the length of the flame. There is no gauge in the world.
    const fuelFraction = clamp(fuel / 100, 0, 1)
    const flame = (1.4 + ship.throttle * 2.2) * (0.35 + fuelFraction * 0.65)
    const flicker = 0.85 + Math.sin(state.elapsed * 40) * 0.15
    ctx.beginPath()
    ctx.moveTo(-0.34, 0.55)
    ctx.lineTo(0, 0.55 + flame * flicker)
    ctx.lineTo(0.34, 0.55)
    strokeNeonPath(ctx, { color: '#ffb000', width: 0.16, glow: 2.2 })
  }

  ctx.beginPath()
  ctx.moveTo(0, -0.95)
  ctx.lineTo(0.68, 0.55)
  ctx.lineTo(-0.68, 0.55)
  ctx.closePath()
  strokeNeonPath(ctx, { color: '#e9ecf5', width: 0.14, glow: 1.4 })

  neonLine(ctx, -0.68, 0.55, -0.85, 0.95, { color: '#9fb4d8', width: 0.1, glow: 1 })
  neonLine(ctx, 0.68, 0.55, 0.85, 0.95, { color: '#9fb4d8', width: 0.1, glow: 1 })

  ctx.restore()
}

/**
 * Velocity is a line from the nose: length is speed, direction is travel.
 * It turns red past the survivable impact speed, replacing a numeric readout.
 */
function drawVelocityVector(ctx: CanvasRenderingContext2D, state: DescentState): void {
  const { ship } = state
  const speed = Math.hypot(ship.vx, ship.vy)
  if (speed < 0.08) return

  const length = Math.min(speed * 1.5, 14)
  const nx = ship.vx / speed
  const ny = ship.vy / speed
  const tooFast = speed > MAX_SAFE_SPEED
  const colour = tooFast ? '#ff4d6d' : speed > MAX_SAFE_SPEED * 0.6 ? '#ffd166' : '#3dff9e'

  neonLine(ctx, ship.x, ship.y, ship.x + nx * length, ship.y + ny * length, {
    color: colour, width: 0.13, glow: 1.6, alpha: 0.9,
  })

  const tipX = ship.x + nx * length
  const tipY = ship.y + ny * length
  const wing = 0.45
  neonLine(ctx, tipX, tipY, tipX - nx * wing + ny * wing * 0.6, tipY - ny * wing - nx * wing * 0.6,
    { color: colour, width: 0.12, glow: 1.4, alpha: 0.9 })
  neonLine(ctx, tipX, tipY, tipX - nx * wing - ny * wing * 0.6, tipY - ny * wing + nx * wing * 0.6,
    { color: colour, width: 0.12, glow: 1.4, alpha: 0.9 })

  glowDot(ctx, ship.x, ship.y, SHIP_RADIUS * 0.14, colour, 1.2)
}

/** A fixed screen-space horizon marker so "which way is down" stays legible. */
function drawHorizonTicks(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
): void {
  const cx = width / 2
  const cy = height * 0.4
  const radius = Math.min(width, height) * 0.36

  ctx.save()
  ctx.translate(cx, cy)
  const down = camera.angle + Math.PI / 2
  const x = Math.cos(down) * radius
  const y = Math.sin(down) * radius

  ctx.globalAlpha = 0.5
  ctx.strokeStyle = 'rgba(233, 236, 245, 0.6)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, radius, down - 0.14, down + 0.14)
  ctx.stroke()

  ctx.globalAlpha = 0.8
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(233, 236, 245, 0.8)'
  ctx.fill()
  ctx.restore()
}

export function tiltDegrees(state: DescentState): number {
  return Math.abs(normaliseAngle(state.ship.angle)) * (180 / Math.PI)
}
