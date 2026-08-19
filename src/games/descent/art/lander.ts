import { clamp } from '../../../lib/math.ts'
import {
  FUEL_CAPACITY,
  LEG_SPREAD,
  MAX_SAFE_SPEED,
  SHIP_RADIUS,
  approachQuality,
  type DescentState,
} from '../simulation.ts'
import {
  EXHAUST,
  EXHAUST_HARD,
  HULL,
  HULL_DARK,
  LAMP,
  approachColour,
  css,
  shade,
  type Rgb,
} from './palette.ts'
import type { DescentFrame } from './frame.ts'

/**
 * The drone.
 *
 * It is a machine, not a triangle: a pressure hull, a lamp housing, two sprung
 * legs and an engine bell. Every part is also an instrument — the **legs**
 * compress on touchdown so a soft landing looks soft, the **flame** is the fuel
 * gauge, the **lamp** is how the cave is lit at all, and the **velocity vector**
 * off the hull is the only speed readout in the game.
 */

/** Half-width of the hull, in world units. */
const HULL_HALF = 0.62

export function drawLander(frame: DescentFrame, state: DescentState, hardBurn: boolean): void {
  const { ctx, view } = frame
  const { ship } = state
  const wrecked = state.phase === 'wrecked'

  drawLamp(frame, state)

  ctx.save()
  ctx.translate(ship.x, ship.y)
  ctx.rotate(ship.angle)

  if (!wrecked) drawExhaust(frame, state, hardBurn)
  drawLegs(frame, view.legs, wrecked)

  // --- Pressure hull ----------------------------------------------------------
  ctx.beginPath()
  ctx.moveTo(0, -SHIP_RADIUS * 1.15)
  ctx.lineTo(HULL_HALF * 0.72, -SHIP_RADIUS * 0.5)
  ctx.lineTo(HULL_HALF, SHIP_RADIUS * 0.35)
  ctx.lineTo(HULL_HALF * 0.6, SHIP_RADIUS * 0.72)
  ctx.lineTo(-HULL_HALF * 0.6, SHIP_RADIUS * 0.72)
  ctx.lineTo(-HULL_HALF, SHIP_RADIUS * 0.35)
  ctx.lineTo(-HULL_HALF * 0.72, -SHIP_RADIUS * 0.5)
  ctx.closePath()
  const shell = ctx.createLinearGradient(-HULL_HALF, -SHIP_RADIUS, HULL_HALF, SHIP_RADIUS)
  shell.addColorStop(0, css(HULL))
  shell.addColorStop(0.45, shade(HULL, -0.45))
  shell.addColorStop(1, css(HULL_DARK))
  ctx.fillStyle = wrecked ? css(HULL_DARK) : shell
  ctx.fill()
  ctx.strokeStyle = wrecked ? shade(HULL_DARK, 0.2) : css(HULL, 0.85)
  ctx.lineWidth = 0.07
  ctx.lineJoin = 'round'
  ctx.stroke()

  // Panel line and a rib, so the hull has scale at twenty pixels across.
  ctx.strokeStyle = css(HULL_DARK, 0.9)
  ctx.lineWidth = 0.05
  ctx.beginPath()
  ctx.moveTo(-HULL_HALF * 0.85, -SHIP_RADIUS * 0.1)
  ctx.lineTo(HULL_HALF * 0.85, -SHIP_RADIUS * 0.1)
  ctx.stroke()

  // --- Lamp housing -----------------------------------------------------------
  // Physically on the belly, pointing the way the drone is pointing, which is
  // why rotating to brake also swings the light off the ground you are aiming
  // at. That trade is the whole reason attitude matters.
  const lampGlow = wrecked ? 0.12 : view.lamp
  ctx.beginPath()
  ctx.ellipse(0, SHIP_RADIUS * 0.66, 0.24, 0.16, 0, 0, Math.PI * 2)
  ctx.fillStyle = css(LAMP, 0.9 * lampGlow)
  ctx.fill()

  // --- Attitude beacon --------------------------------------------------------
  // A single light on the crown that carries the approach colour, so the pilot
  // never has to look away from the drone to know how the landing is going.
  if (!wrecked) {
    const quality = approachQuality(state)
    const beacon = approachColour(quality)
    ctx.beginPath()
    ctx.arc(0, -SHIP_RADIUS * 1.15, 0.13, 0, Math.PI * 2)
    ctx.fillStyle = css(beacon, 0.95)
    ctx.fill()

    const glow = frame.glow
    glow.save()
    glow.translate(ship.x, ship.y)
    glow.rotate(ship.angle)
    glow.beginPath()
    glow.arc(0, -SHIP_RADIUS * 1.15, 0.34, 0, Math.PI * 2)
    glow.fillStyle = css(beacon, 0.7)
    glow.fill()
    glow.restore()
  }

  ctx.restore()

  if (!wrecked) drawVelocityVector(frame, state)
}

/**
 * The legs.
 *
 * They splay from the hull and compress on contact. Suspension travel is the
 * cheapest possible way to make weight legible: the same landing at half the
 * speed visibly squats less, and a pilot reads that long before they read a
 * number.
 */
function drawLegs(frame: DescentFrame, compression: number, wrecked: boolean): void {
  const { ctx } = frame
  const travel = compression * 0.3
  const footY = SHIP_RADIUS * 1.25 - travel
  const splay = LEG_SPREAD + compression * 0.12

  ctx.strokeStyle = wrecked ? css(HULL_DARK) : shade(HULL, -0.35)
  ctx.lineWidth = 0.1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const side of [-1, 1]) {
    const kneeX = side * (HULL_HALF * 0.9 + splay * 0.25)
    const kneeY = SHIP_RADIUS * 0.55 - travel * 0.35
    ctx.beginPath()
    ctx.moveTo(side * HULL_HALF * 0.7, SHIP_RADIUS * 0.2)
    ctx.lineTo(kneeX, kneeY)
    ctx.lineTo(side * splay, footY)
    ctx.stroke()

    // A brace, and the footpad that actually meets the rock.
    ctx.beginPath()
    ctx.moveTo(side * HULL_HALF * 0.35, SHIP_RADIUS * 0.68)
    ctx.lineTo(kneeX, kneeY)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(side * splay - 0.14, footY)
    ctx.lineTo(side * splay + 0.14, footY)
    ctx.lineWidth = 0.13
    ctx.stroke()
    ctx.lineWidth = 0.1
  }
}

/** Flame length is the fuel gauge; there is no bar for it in the world. */
function drawExhaust(frame: DescentFrame, state: DescentState, hardBurn: boolean): void {
  const { ctx, view } = frame
  const { ship, fuel } = state
  if (ship.throttle <= 0.02 || fuel <= 0) return

  const fuelFraction = clamp(fuel / FUEL_CAPACITY, 0, 1)
  const length = (0.9 + ship.throttle * 1.9) * (0.4 + fuelFraction * 0.6) * (hardBurn ? 1.55 : 1)
  const flicker = 0.86 + Math.sin(view.time * 46) * 0.09 + Math.sin(view.time * 91) * 0.05
  const reach = length * flicker
  const hot: Rgb = hardBurn ? EXHAUST_HARD : EXHAUST
  const root = SHIP_RADIUS * 0.74

  // Engine bell.
  ctx.beginPath()
  ctx.moveTo(-0.2, root - 0.1)
  ctx.lineTo(0.2, root - 0.1)
  ctx.lineTo(0.28, root + 0.14)
  ctx.lineTo(-0.28, root + 0.14)
  ctx.closePath()
  ctx.fillStyle = css(HULL_DARK)
  ctx.fill()

  // Plume: a wide cool envelope with a tight white core inside it.
  ctx.beginPath()
  ctx.moveTo(-0.26, root)
  ctx.quadraticCurveTo(-0.1, root + reach * 0.7, 0, root + reach)
  ctx.quadraticCurveTo(0.1, root + reach * 0.7, 0.26, root)
  ctx.closePath()
  const plume = ctx.createLinearGradient(0, root, 0, root + reach)
  plume.addColorStop(0, css(LAMP, 0.95))
  plume.addColorStop(0.35, css(hot, 0.8))
  plume.addColorStop(1, css(hot, 0))
  ctx.fillStyle = plume
  ctx.fill()

  const glow = frame.glow
  glow.save()
  glow.translate(state.ship.x, state.ship.y)
  glow.rotate(state.ship.angle)
  glow.beginPath()
  glow.moveTo(-0.3, root)
  glow.quadraticCurveTo(-0.12, root + reach * 0.7, 0, root + reach * 1.1)
  glow.quadraticCurveTo(0.12, root + reach * 0.7, 0.3, root)
  glow.closePath()
  const bloom = glow.createLinearGradient(0, root, 0, root + reach)
  bloom.addColorStop(0, css(LAMP, 0.75))
  bloom.addColorStop(0.4, css(hot, 0.5))
  bloom.addColorStop(1, css(hot, 0))
  glow.fillStyle = bloom
  glow.fill()
  glow.restore()
}

/**
 * The lamp cone, drawn into the light map.
 *
 * This is the game's key light and its main reason for being dark at all: the
 * cave is only visible where the drone is pointing, so attitude is not just a
 * landing constraint, it is *where you can see*.
 */
function drawLamp(frame: DescentFrame, state: DescentState): void {
  const light = frame.light
  const { ship } = state
  const strength = state.phase === 'wrecked' ? 0.25 : frame.view.lamp
  const reach = 26

  light.save()
  light.translate(ship.x, ship.y)
  light.rotate(ship.angle)

  // The cone is built from overlapping soft discs down its axis rather than a
  // clipped wedge. A clipped wedge has straight sides, and straight sides read
  // as a grey polygon lying on the floor instead of as light.
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const distance = reach * t
    const radius = 1.6 + reach * t * 0.36
    // Near-linear falloff: squaring it collapsed the cone into a blob around
    // the hull and threw away the whole point of having a directional lamp.
    const fade = (1 - t * 0.86) * 0.3 * strength
    if (fade <= 0.004) continue
    const disc = light.createRadialGradient(0, distance, 0, 0, distance, radius)
    disc.addColorStop(0, css(LAMP, fade))
    disc.addColorStop(0.5, css(LAMP, fade * 0.55))
    disc.addColorStop(1, css(LAMP, 0))
    light.fillStyle = disc
    light.fillRect(-radius, distance - radius, radius * 2, radius * 2)
  }

  // A hot core right under the lamp, so the rock immediately below the drone is
  // fully exposed on the final few metres of an approach.
  const core = light.createRadialGradient(0, 2, 0, 0, 2, 8)
  core.addColorStop(0, css(LAMP, 0.85 * strength))
  core.addColorStop(0.4, css(LAMP, 0.3 * strength))
  core.addColorStop(1, css(LAMP, 0))
  light.fillStyle = core
  light.fillRect(-8, 2 - 8, 16, 16)

  // And a small omnidirectional pool so the hull is never a silhouette in its
  // own shadow. Deliberately tight — widen it and the lamp stops mattering.
  const pool = light.createRadialGradient(0, 0, 0, 0, 0, 4)
  pool.addColorStop(0, css(LAMP, 0.4 * strength))
  pool.addColorStop(1, css(LAMP, 0))
  light.fillStyle = pool
  light.fillRect(-4, -4, 8, 8)
  light.restore()
}

/**
 * Velocity as a line from the hull: length is speed, direction is travel.
 * It turns red past the survivable impact speed, which replaces a readout.
 */
function drawVelocityVector(frame: DescentFrame, state: DescentState): void {
  const { ctx } = frame
  const { ship } = state
  const speed = Math.hypot(ship.vx, ship.vy)
  if (speed < 0.1) return

  const length = Math.min(speed * 1.5, 14)
  const nx = ship.vx / speed
  const ny = ship.vy / speed
  const colour: Rgb = speed > MAX_SAFE_SPEED
    ? approachColour(0)
    : speed > MAX_SAFE_SPEED * 0.6 ? approachColour(0.5) : approachColour(1)

  const tipX = ship.x + nx * length
  const tipY = ship.y + ny * length

  ctx.save()
  ctx.strokeStyle = css(colour, 0.75)
  ctx.lineWidth = 0.1
  ctx.lineCap = 'round'
  ctx.setLineDash([0.5, 0.34])
  ctx.beginPath()
  ctx.moveTo(ship.x + nx * SHIP_RADIUS * 1.4, ship.y + ny * SHIP_RADIUS * 1.4)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()
  ctx.setLineDash([])

  const wing = 0.5
  ctx.beginPath()
  ctx.moveTo(tipX - nx * wing + ny * wing * 0.55, tipY - ny * wing - nx * wing * 0.55)
  ctx.lineTo(tipX, tipY)
  ctx.lineTo(tipX - nx * wing - ny * wing * 0.55, tipY - ny * wing + nx * wing * 0.55)
  ctx.stroke()
  ctx.restore()

  const glow = frame.glow
  glow.strokeStyle = css(colour, 0.5)
  glow.lineWidth = 0.16
  glow.lineCap = 'round'
  glow.beginPath()
  glow.moveTo(tipX - nx * wing + ny * wing * 0.55, tipY - ny * wing - nx * wing * 0.55)
  glow.lineTo(tipX, tipY)
  glow.lineTo(tipX - nx * wing - ny * wing * 0.55, tipY - ny * wing + nx * wing * 0.55)
  glow.stroke()
}
