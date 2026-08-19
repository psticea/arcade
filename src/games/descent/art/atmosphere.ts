import { clamp } from '../../../lib/math.ts'
import type { DescentState } from '../simulation.ts'
import { css, shade, EXHAUST, EXHAUST_HARD, LAMP } from './palette.ts'
import type { DescentFrame } from './frame.ts'
import type { Camera } from './view.ts'

/**
 * Everything between the camera and the rock: dust, haze, and the screen-space
 * furniture that has to stay upright while the world rolls.
 */

/** Ground-effect dust, in world space so it stays stuck to the rock. */
export function drawDust(frame: DescentFrame): void {
  const { ctx, view } = frame
  ctx.save()
  for (const mote of view.dust) {
    if (mote.life <= 0) continue
    const t = mote.life / mote.maxLife
    const colour = mote.heat > 0.5 ? EXHAUST_HARD : EXHAUST
    ctx.globalAlpha = t * 0.55
    ctx.fillStyle = shade(colour, -0.25 - (1 - t) * 0.35)
    const size = mote.size * (1 + (1 - t) * 1.6)
    ctx.fillRect(mote.x - size / 2, mote.y - size / 2, size, size)
  }
  ctx.restore()

  // The brightest motes light the rock a little, which is what sells the blast
  // as heat rather than as grey confetti.
  const light = frame.light
  light.save()
  for (const mote of view.dust) {
    if (mote.life <= 0) continue
    const t = mote.life / mote.maxLife
    if (t < 0.5) continue
    const reach = mote.size * 9
    const halo = light.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, reach)
    halo.addColorStop(0, css(mote.heat > 0.5 ? EXHAUST_HARD : EXHAUST, 0.28 * t))
    halo.addColorStop(1, css(EXHAUST, 0))
    light.fillStyle = halo
    light.fillRect(mote.x - reach, mote.y - reach, reach * 2, reach * 2)
  }
  light.restore()
}

/**
 * Distance haze.
 *
 * Drawn in screen space after the world, so it fogs whatever is far from the
 * drone regardless of how the camera is rolled. Without it the cave has no
 * sense of air in it and the parallax layers read as flat cut-outs.
 */
export function drawHaze(frame: DescentFrame): void {
  const { ctx, palette } = frame
  const gradient = ctx.createRadialGradient(
    frame.width / 2, frame.height * 0.42, frame.height * 0.12,
    frame.width / 2, frame.height * 0.5, frame.height * 0.95,
  )
  gradient.addColorStop(0, css(palette.haze, 0))
  gradient.addColorStop(0.55, css(palette.haze, 0.16))
  gradient.addColorStop(1, css(palette.haze, 0.42))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, frame.width, frame.height)
}

export function drawVignette(frame: DescentFrame): void {
  const { ctx, palette } = frame
  const gradient = ctx.createRadialGradient(
    frame.width / 2, frame.height * 0.42, frame.height * 0.2,
    frame.width / 2, frame.height * 0.5, frame.height * 0.86,
  )
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(0.6, `rgba(0,0,0,${0.2 + palette.depth * 0.1})`)
  gradient.addColorStop(1, `rgba(0,0,0,${0.68 + palette.depth * 0.14})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, frame.width, frame.height)
}

/**
 * The gravity indicator.
 *
 * The camera rolls with the drone, so "down" moves. This is a marker pinned to
 * the edge of the frame that always points the way gravity does — the one piece
 * of screen-space instrumentation the game has, and it exists because losing
 * track of down on a phone is unfair rather than difficult.
 */
export function drawGravityArc(frame: DescentFrame, camera: Camera): void {
  const { ctx, palette } = frame
  const cx = frame.width / 2
  const cy = frame.height * 0.42
  const down = camera.angle + Math.PI / 2
  const point = edgePoint(frame, cx, cy, down, 16)

  ctx.save()
  ctx.translate(point.x, point.y)
  ctx.rotate(down)
  ctx.fillStyle = css(palette.rim, 0.5)
  ctx.beginPath()
  ctx.moveTo(9, 0)
  ctx.lineTo(-5, -6)
  ctx.lineTo(-2, 0)
  ctx.lineTo(-5, 6)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Where a ray from the anchor leaves the frame, inset by `margin`. */
function edgePoint(
  frame: DescentFrame,
  cx: number, cy: number,
  angle: number, margin: number,
): { x: number; y: number } {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const left = margin
  const right = frame.width - margin
  const top = margin
  const bottom = frame.height - margin

  let t = Infinity
  if (dx > 1e-6) t = Math.min(t, (right - cx) / dx)
  if (dx < -1e-6) t = Math.min(t, (left - cx) / dx)
  if (dy > 1e-6) t = Math.min(t, (bottom - cy) / dy)
  if (dy < -1e-6) t = Math.min(t, (top - cy) / dy)
  if (!Number.isFinite(t)) t = 0
  return { x: cx + dx * t, y: cy + dy * t }
}

/**
 * Off-screen pad markers.
 *
 * Zoomed in for a landing, the other pads leave the frame. A chevron pinned to
 * the edge pointing at each one keeps the choice of where to land alive instead
 * of quietly removing it whenever the camera tightens.
 */
export function drawPadMarkers(
  frame: DescentFrame,
  state: DescentState,
  camera: Camera,
): void {
  const { ctx, palette } = frame
  const cx = frame.width / 2
  const cy = frame.height * 0.42

  for (const pad of state.terrain.pads) {
    const centre = (pad.left + pad.right) / 2
    const onScreen = centre > frame.viewLeft && centre < frame.viewRight
      && pad.y > frame.viewTop && pad.y < frame.viewBottom
    if (onScreen) continue

    const angle = Math.atan2(pad.y - camera.y, centre - camera.x) + camera.angle
    const point = edgePoint(frame, cx, cy, angle, 26)
    const pips = pad.multiplier === 8 ? 3 : pad.multiplier === 3 ? 2 : 1

    ctx.save()
    ctx.translate(point.x, point.y)
    ctx.rotate(angle)
    ctx.fillStyle = css(palette.seam, 0.42)
    ctx.beginPath()
    ctx.moveTo(7, 0)
    ctx.lineTo(-4, -5)
    ctx.lineTo(-4, 5)
    ctx.closePath()
    ctx.fill()

    // Worth, as pips stacked across the chevron. Still no text in the world.
    ctx.fillStyle = css(palette.seam, 0.65)
    for (let i = 0; i < pips; i++) {
      ctx.beginPath()
      ctx.arc(-10, (i - (pips - 1) / 2) * 4.6, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

/**
 * A flash of white when the run ends, and a slow drain of colour after it.
 * The impact should be felt before the score screen arrives.
 */
export function drawImpact(frame: DescentFrame, state: DescentState): void {
  const { ctx, view } = frame
  if (state.phase === 'wrecked') {
    const t = clamp(view.wreckedFor / 1.2, 0, 1)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = css(EXHAUST_HARD, (1 - t) * 0.28)
    ctx.fillRect(0, 0, frame.width, frame.height)
    ctx.restore()
    ctx.fillStyle = `rgba(4,3,6,${t * 0.5})`
    ctx.fillRect(0, 0, frame.width, frame.height)
    return
  }

  if (view.landFlash > 0.001) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = css(LAMP, view.landFlash * view.landFlash * 0.16)
    ctx.fillRect(0, 0, frame.width, frame.height)
    ctx.restore()
  }
  if (view.scrapeFlash > 0.001) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = css(EXHAUST, view.scrapeFlash * 0.12)
    ctx.fillRect(0, 0, frame.width, frame.height)
    ctx.restore()
  }
}
