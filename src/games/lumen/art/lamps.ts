import { noise1 } from '../../../lib/noise.ts'
import {
  BOONS, LAMP_CAPACITY, LAMPS, TUNING, burnDepthAt, type LumenState, type Offer,
} from '../simulation.ts'
import {
  BURN, EMBER, EMBER_CORE, EMBER_DEEP, LANTERN, css, mixRgb, type Palette, type Rgb,
} from './palette.ts'
import { TAU, depthScale, radiusAt, theta, type View } from './view.ts'

/**
 * Light: the wedges the lamps cast, and the band where they add up to killing.
 *
 * The band is not an effect that approximates the rule — it is the rule, sampled.
 * `burnDepthAt` is the same function the simulation burns shades with, so what
 * you see glowing white on the wall is exactly the region a shade dies in. That
 * is the whole reason this game needs no numbers on screen: the most important
 * quantity in it is a shape.
 */

/** How many angular samples the burning band is traced with. */
const BAND_SAMPLES = 132
const bandDepth = new Float32Array(BAND_SAMPLES + 1)

const tint: Rgb = [0, 0, 0]

function lampBrightness(state: LumenState, index: number): number {
  const lamp = state.lamps[index]
  if (!lamp || lamp.fuel <= TUNING.darkFuel) return 0
  return lamp.fuel / LAMP_CAPACITY
}

/**
 * Enter the space in which the squashed rim is a true circle. Radial gradients
 * and arcs then work directly, which they cannot in the projected view. Valid
 * near the rim, which is the only place light and lamps live.
 */
function ringSpace(ctx: CanvasRenderingContext2D, view: View): void {
  ctx.translate(0, view.bowl * 0.16)
  ctx.scale(1, view.squash)
}

export function drawLight(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: LumenState,
  time: number,
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ringSpace(ctx, view)

  const glow = ctx.createRadialGradient(0, 0, view.rim * 0.2, 0, 0, view.rim)
  glow.addColorStop(0, css(EMBER_DEEP, 0.02))
  glow.addColorStop(0.5, css(EMBER_DEEP, 0.16))
  glow.addColorStop(0.82, css(EMBER, 0.34))
  glow.addColorStop(1, css(EMBER_CORE, 0.46))

  for (let i = 0; i < LAMPS; i++) {
    const brightness = lampBrightness(state, i)
    if (brightness <= 0) continue

    const half = state.derived.coneHalf
      * (TUNING.coneFloor + (1 - TUNING.coneFloor) * brightness)
    const reach = state.derived.reach
      * (TUNING.reachFloor + (1 - TUNING.reachFloor) * brightness)
    const inner = radiusAt(view, Math.max(0, 1 - reach))
    // Flicker is per lamp and slow: a synchronised flicker looks like a fault.
    const flicker = 0.92 + noise1(time * 3.1 + i * 9.4) * 0.16

    for (const [width, alpha] of [[1, 0.22], [0.66, 0.22], [0.34, 0.24]] as const) {
      const spread = (half * width / LAMPS) * TAU
      const centre = theta(i)
      ctx.globalAlpha = alpha * brightness * flicker
      ctx.beginPath()
      ctx.arc(0, 0, view.rim, centre - spread, centre + spread)
      ctx.arc(0, 0, inner, centre + spread, centre - spread, true)
      ctx.closePath()
      ctx.fillStyle = glow
      ctx.fill()
    }
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

/**
 * The burning band, traced from the live illumination field.
 *
 * Contiguous runs of "this angle burns" are drawn as one ribbon each, so a
 * furnace reads as a single wide mouth rather than as a row of slices, and the
 * gap where you snuffed a lamp reads as a gap.
 */
export function drawBurnBand(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: LumenState,
  time: number,
): void {
  let any = false
  for (let i = 0; i <= BAND_SAMPLES; i++) {
    const angle = (i / BAND_SAMPLES) * LAMPS
    const depth = burnDepthAt(state, angle)
    bandDepth[i] = depth
    if (depth > 0) any = true
  }
  if (!any) return

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ringSpace(ctx, view)

  const heat = ctx.createRadialGradient(0, 0, view.deep, 0, 0, view.rim)
  heat.addColorStop(0, css(BURN, 0))
  heat.addColorStop(0.5, css(EMBER, 0.1))
  heat.addColorStop(0.85, css(BURN, 0.2))
  heat.addColorStop(1, css(BURN, 0.34))

  const pulse = 0.88 + 0.12 * Math.sin(time * 6)
  let start = -1

  for (let i = 0; i <= BAND_SAMPLES + 1; i++) {
    const index = i % (BAND_SAMPLES + 1)
    const inside = i <= BAND_SAMPLES && (bandDepth[index] ?? 0) > 0
    if (inside && start < 0) start = i
    if (inside || start < 0) continue

    ribbon(ctx, view, start, i - 1, heat, pulse)
    start = -1
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

function ribbon(
  ctx: CanvasRenderingContext2D,
  view: View,
  from: number,
  to: number,
  fill: CanvasGradient,
  pulse: number,
): void {
  ctx.beginPath()
  for (let i = from; i <= to; i++) {
    const angle = (i / BAND_SAMPLES) * LAMPS
    const t = theta(angle)
    const r = radiusAt(view, 1 - (bandDepth[i] ?? 0))
    ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r)
  }
  for (let i = to; i >= from; i--) {
    const angle = (i / BAND_SAMPLES) * LAMPS
    const t = theta(angle)
    ctx.lineTo(Math.cos(t) * view.rim, Math.sin(t) * view.rim)
  }
  ctx.closePath()

  ctx.globalAlpha = pulse
  ctx.fillStyle = fill
  ctx.fill()

  // The inner edge is the line a shade has to cross to start dying, so it gets
  // the brightest stroke in the game.
  ctx.beginPath()
  for (let i = from; i <= to; i++) {
    const angle = (i / BAND_SAMPLES) * LAMPS
    const t = theta(angle)
    const r = radiusAt(view, 1 - (bandDepth[i] ?? 0))
    ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r)
  }
  ctx.globalAlpha = 0.95 * pulse
  ctx.strokeStyle = css(BURN, 1)
  ctx.lineWidth = Math.max(1.5, view.unit * 2.4) / view.squash
  ctx.stroke()
}

/**
 * The braziers themselves, as props standing on the rim: iron, a bowl, a flame
 * whose height is the fuel, and a pool of light on the snow at its feet. The
 * flame is the only fuel gauge in the game and it is legible from the far side
 * of the ring.
 */
export function drawBrazier(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: LumenState,
  index: number,
  palette: Palette,
  time: number,
): void {
  const lamp = state.lamps[index]
  if (!lamp) return
  const t = theta(index)
  const x = Math.cos(t) * view.rim
  const y = Math.sin(t) * view.rim * view.squash
  const brightness = lamp.fuel / LAMP_CAPACITY
  const lit = lamp.fuel > TUNING.darkFuel
  const scale = depthScale(index)
  const height = view.rim * (0.15 + brightness * 0.06) * scale
  const u = view.unit * scale

  if (lit) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const pool = ctx.createRadialGradient(x, y, 0, x, y, view.rim * (0.1 + brightness * 0.1))
    pool.addColorStop(0, css(EMBER, 0.3 * brightness))
    pool.addColorStop(1, css(EMBER, 0))
    ctx.fillStyle = pool
    ctx.fillRect(x - view.rim * 0.32, y - view.rim * 0.32, view.rim * 0.64, view.rim * 0.64)
    ctx.restore()
  }

  // Contact shadow. Without it the brazier floats.
  ctx.fillStyle = css(palette.rockDark, 0.7)
  ctx.beginPath()
  ctx.ellipse(x, y + u, u * 5, u * 2, 0, 0, TAU)
  ctx.fill()

  mixRgb(palette.rockDark, lit ? EMBER_DEEP : palette.rock, lit ? 0.35 : 0.75, tint)
  ctx.strokeStyle = css(tint)
  ctx.lineWidth = u * 2.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - u * 4, y + u)
  ctx.lineTo(x, y - height * 0.72)
  ctx.lineTo(x + u * 4, y + u)
  ctx.moveTo(x, y + u)
  ctx.lineTo(x, y - height * 0.72)
  ctx.stroke()

  // The bowl.
  ctx.beginPath()
  ctx.moveTo(x - u * 5.4, y - height * 0.74)
  ctx.lineTo(x + u * 5.4, y - height * 0.74)
  ctx.lineTo(x + u * 3.2, y - height * 0.54)
  ctx.lineTo(x - u * 3.2, y - height * 0.54)
  ctx.closePath()
  ctx.fillStyle = css(tint)
  ctx.fill()

  if (!lit) {
    if (lamp.fuel > 0) {
      ctx.fillStyle = css(EMBER_DEEP, 0.55)
      ctx.beginPath()
      ctx.arc(x, y - height * 0.78, u * 1.5, 0, TAU)
      ctx.fill()
    }
    return
  }

  drawFlame(ctx, x, y - height * 0.76, u, height, brightness, lamp.flare, index, time)
}

function drawFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  height: number,
  brightness: number,
  flare: number,
  seed: number,
  time: number,
): void {
  const dance = noise1(time * 6 + seed * 5.3)
  const tall = height * (0.26 + brightness * 0.26) * (0.88 + dance * 0.24) * (1 + flare * 0.22)
  const wide = u * (4.4 + brightness * 3)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const [scale, colour, alpha] of [
    [1.3, EMBER_DEEP, 0.42],
    [1, EMBER, 0.72],
    [0.52, EMBER_CORE, 0.95],
  ] as const) {
    const lean = (dance - 0.5) * u * 2 * scale
    ctx.beginPath()
    ctx.moveTo(x - wide * scale * 0.5, y)
    ctx.quadraticCurveTo(x - wide * scale * 0.55, y - tall * scale * 0.6, x + lean, y - tall * scale)
    ctx.quadraticCurveTo(x + wide * scale * 0.55, y - tall * scale * 0.6, x + wide * scale * 0.5, y)
    ctx.closePath()
    ctx.fillStyle = css(colour, alpha)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * The three offer braziers of a respite: cold, unlit stones with a sign hanging
 * over them. Placed a third of the ring apart, so choosing one is also choosing
 * how long to be away from the fire you are keeping alive.
 */
export function drawOffer(
  ctx: CanvasRenderingContext2D,
  view: View,
  offer: Offer,
  palette: Palette,
  claim: number,
  time: number,
): void {
  const t = theta(offer.lamp)
  const x = Math.cos(t) * view.rim
  const y = Math.sin(t) * view.rim * view.squash
  const u = view.unit
  const lift = view.rim * 0.2
  const bob = Math.sin(time * 1.6 + offer.lamp) * u * 1.5

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const halo = ctx.createRadialGradient(x, y - lift + bob, 0, x, y - lift + bob, view.rim * 0.2)
  halo.addColorStop(0, css(LANTERN, 0.3 + claim * 0.5))
  halo.addColorStop(1, css(LANTERN, 0))
  ctx.fillStyle = halo
  ctx.fillRect(x - view.rim * 0.24, y - lift - view.rim * 0.24, view.rim * 0.48, view.rim * 0.48)
  ctx.restore()

  ctx.strokeStyle = css(palette.snowShadow)
  ctx.lineWidth = u * 1.6
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - lift * 0.62)
  ctx.stroke()

  ctx.save()
  ctx.translate(x, y - lift + bob)
  ctx.strokeStyle = css(BURN, 0.85)
  ctx.fillStyle = css(BURN, 0.85)
  ctx.lineWidth = u * 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  drawGlyph(ctx, BOONS[offer.boon].glyph, u * 4.6)
  ctx.restore()

  if (claim > 0) {
    ctx.beginPath()
    ctx.arc(x, y - lift + bob, u * 7.5, -Math.PI / 2, -Math.PI / 2 + TAU * claim)
    ctx.strokeStyle = css(EMBER_CORE, 0.95)
    ctx.lineWidth = u * 2
    ctx.stroke()
  }
}

/**
 * Boon signs. Vector glyphs rather than words, because three labels around a
 * circle on a 390px screen is unreadable — the name is written once, large, at
 * the bottom of the screen for whichever brazier you are standing at.
 */
function drawGlyph(ctx: CanvasRenderingContext2D, glyph: string, r: number): void {
  ctx.beginPath()
  switch (glyph) {
    case 'drop':
      ctx.moveTo(0, -r)
      ctx.quadraticCurveTo(r * 0.8, r * 0.2, 0, r * 0.8)
      ctx.quadraticCurveTo(-r * 0.8, r * 0.2, 0, -r)
      ctx.fill()
      return
    case 'lens':
      ctx.ellipse(0, 0, r * 0.95, r * 0.55, 0, 0, TAU)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-r, 0)
      ctx.lineTo(r, 0)
      ctx.stroke()
      return
    case 'prism':
      ctx.moveTo(0, -r)
      ctx.lineTo(r * 0.9, r * 0.7)
      ctx.lineTo(-r * 0.9, r * 0.7)
      ctx.closePath()
      ctx.stroke()
      return
    case 'flame':
      ctx.moveTo(0, -r)
      ctx.quadraticCurveTo(r * 0.75, -r * 0.1, 0, r * 0.8)
      ctx.quadraticCurveTo(-r * 0.75, -r * 0.1, 0, -r)
      ctx.stroke()
      return
    case 'eye':
      ctx.moveTo(-r, 0)
      ctx.quadraticCurveTo(0, -r * 0.9, r, 0)
      ctx.quadraticCurveTo(0, r * 0.9, -r, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.28, 0, TAU)
      ctx.fill()
      return
    case 'shield':
      ctx.moveTo(0, -r)
      ctx.lineTo(r * 0.8, -r * 0.5)
      ctx.lineTo(r * 0.8, r * 0.2)
      ctx.lineTo(0, r)
      ctx.lineTo(-r * 0.8, r * 0.2)
      ctx.lineTo(-r * 0.8, -r * 0.5)
      ctx.closePath()
      ctx.stroke()
      return
    case 'spark':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU
        ctx.moveTo(Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.22)
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      ctx.stroke()
      return
    default:
      for (let i = 0; i < 3; i++) {
        const y = (i - 1) * r * 0.55
        ctx.moveTo(-r, y)
        ctx.quadraticCurveTo(0, y - r * 0.4, r * (0.6 + i * 0.2), y)
      }
      ctx.stroke()
  }
}
