import { noise1 } from '../../../lib/noise.ts'
import { SHADE_KINDS, type Shade } from '../simulation.ts'
import {
  BURN, EMBER, EMBER_CORE, SHADE_BODY, SHADE_EDGE, SHADE_HUNGRY, css, mixRgb, type Rgb,
} from './palette.ts'
import { TAU, project, radiusAt, theta, type View } from './view.ts'

/**
 * Shades.
 *
 * They have to be readable against near-black rock in an unlit arc and against
 * a white-hot band in a furnace, which rules out doing it with hue. So the body
 * is always darker than anything behind it and the edge is always brighter, and
 * the three states differ in **silhouette** as well: a wisp is a smooth
 * teardrop, a maw is bigger with a crown of spines, and a hunter — the one that
 * is actually coming for you — grows a hard, spiked outline the moment it turns.
 * Greyscale the screen and you can still tell all three apart.
 */

const edge: Rgb = [0, 0, 0]

export function drawShade(
  ctx: CanvasRenderingContext2D,
  view: View,
  shade: Shade,
  time: number,
): void {
  const point = project(view, shade.angle, shade.climb)
  const spec = SHADE_KINDS[shade.kind]
  const hurt = 1 - shade.hp / spec.hp
  const size = view.unit * 5.2 * spec.size * (1 + shade.carried * 0.006)
  const hunting = shade.mode === 'hunting'
  const wobble = noise1(time * 2.4 + shade.id * 3.7)

  if (shade.mode === 'drinking') drawSiphon(ctx, view, shade, time)
  if (shade.mode === 'rising') drawWake(ctx, view, shade, size)

  // Body: a soft dark mass, drawn normally so it genuinely occludes the wall.
  const body = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 1.6)
  body.addColorStop(0, css(SHADE_BODY, 0.95))
  body.addColorStop(0.6, css(SHADE_BODY, 0.75))
  body.addColorStop(1, css(SHADE_BODY, 0))
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(point.x, point.y, size * 1.6, 0, TAU)
  ctx.fill()

  mixRgb(hunting ? SHADE_HUNGRY : SHADE_EDGE, EMBER_CORE, shade.sear * 0.7, edge)
  ctx.save()
  ctx.translate(point.x, point.y)
  ctx.strokeStyle = css(edge, 0.9)
  ctx.lineWidth = Math.max(1, view.unit * (hunting ? 1.7 : 1.2))
  ctx.lineJoin = 'round'

  if (hunting) spikedOutline(ctx, size, wobble)
  else teardrop(ctx, size, spec.size > 1.5, wobble)
  ctx.stroke()

  // Burning from inside out, so damage is visible before the kill.
  if (shade.sear > 0.02) {
    ctx.globalCompositeOperation = 'lighter'
    const heat = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.4)
    heat.addColorStop(0, css(BURN, 0.85 * shade.sear))
    heat.addColorStop(0.5, css(EMBER, 0.5 * shade.sear * (0.4 + hurt)))
    heat.addColorStop(1, css(EMBER, 0))
    ctx.fillStyle = heat
    ctx.beginPath()
    ctx.arc(0, 0, size * 1.4, 0, TAU)
    ctx.fill()
  }
  ctx.restore()

  // Light it has taken is carried visibly, so a fat shade is a bounty.
  if (shade.carried > 1) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const held = Math.min(1, shade.carried / 60)
    ctx.fillStyle = css(EMBER, 0.5 + held * 0.4)
    ctx.beginPath()
    ctx.arc(point.x, point.y, size * (0.24 + held * 0.3), 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}

function teardrop(
  ctx: CanvasRenderingContext2D,
  size: number,
  crowned: boolean,
  wobble: number,
): void {
  ctx.beginPath()
  ctx.moveTo(0, -size * (1.15 + wobble * 0.18))
  ctx.quadraticCurveTo(size * 1.05, -size * 0.2, size * 0.5, size * 0.85)
  ctx.quadraticCurveTo(0, size * 1.2, -size * 0.5, size * 0.85)
  ctx.quadraticCurveTo(-size * 1.05, -size * 0.2, 0, -size * (1.15 + wobble * 0.18))
  ctx.closePath()
  if (!crowned) return

  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.9 + (i / 4) * Math.PI * 0.8
    ctx.moveTo(Math.cos(a) * size * 0.85, Math.sin(a) * size * 0.85)
    ctx.lineTo(Math.cos(a) * size * 1.5, Math.sin(a) * size * 1.5)
  }
}

function spikedOutline(ctx: CanvasRenderingContext2D, size: number, wobble: number): void {
  ctx.beginPath()
  const points = 9
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * TAU
    const spike = i % 2 === 0 ? 1.45 : 0.72
    const r = size * spike * (0.92 + wobble * 0.16)
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** The trail a rising shade leaves, which is how you spot one in a dark lane. */
function drawWake(
  ctx: CanvasRenderingContext2D,
  view: View,
  shade: Shade,
  size: number,
): void {
  const t = theta(shade.angle)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 1; i <= 3; i++) {
    const climb = Math.max(0, shade.climb - i * 0.045)
    const r = radiusAt(view, climb)
    const x = Math.cos(t) * r
    const y = Math.sin(t) * r * view.squash + (1 - climb) * view.bowl
    ctx.fillStyle = css(SHADE_EDGE, 0.18 / i)
    ctx.beginPath()
    ctx.arc(x, y, size * (0.5 / i), 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * The thread of stolen light running from a drinking shade back up into the
 * lamp it is emptying. This is the single most important tell in the game: it
 * is how you notice a lamp is being drained from the far side of the ring.
 */
function drawSiphon(
  ctx: CanvasRenderingContext2D,
  view: View,
  shade: Shade,
  time: number,
): void {
  const t = theta(shade.angle)
  const x = Math.cos(t) * view.rim
  const y = Math.sin(t) * view.rim * view.squash
  const top = y - view.rim * 0.1

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = css(EMBER, 0.55)
  ctx.lineWidth = Math.max(1, view.unit * 1.3)
  ctx.beginPath()
  ctx.moveTo(x, top)
  ctx.quadraticCurveTo(x + Math.sin(time * 5) * view.unit * 3, (top + y) / 2, x, y)
  ctx.stroke()

  for (let i = 0; i < 3; i++) {
    const phase = ((time * 1.4 + i / 3) % 1)
    ctx.fillStyle = css(EMBER_CORE, 0.8 * (1 - phase))
    ctx.beginPath()
    ctx.arc(x, top + (y - top) * phase, view.unit * 1.6, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}
