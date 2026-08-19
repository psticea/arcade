import {
  LANTERN_CAPACITY, TUNING, ringDistance, type LumenState,
} from '../simulation.ts'
import {
  BURN, EMBER, EMBER_CORE, LANTERN, css, type Palette,
} from './palette.ts'
import { TAU, depthScale, theta, type View } from './view.ts'

/**
 * The keeper.
 *
 * Small, dark, hooded, and carrying the only cool light in the scene — which is
 * deliberate: the lantern is your reserve, so the amount of light you are
 * holding is painted on your own body and never needs a number. Run it dry and
 * the figure goes almost black, which is the correct amount of alarming.
 */

export function drawKeeper(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: LumenState,
  palette: Palette,
  input: { pour: boolean; draw: boolean },
  time: number,
): void {
  const t = theta(state.keeper)
  const x = Math.cos(t) * view.rim
  const y = Math.sin(t) * view.rim * view.squash
  const scale = depthScale(state.keeper)
  const u = view.unit * scale
  const height = view.rim * 0.115 * scale
  const charge = state.lantern / LANTERN_CAPACITY
  const sway = Math.sin(time * 2.2) * u * 0.3

  drawReachMarker(ctx, view, state, time)

  ctx.fillStyle = css(palette.rockDark, 0.72)
  ctx.beginPath()
  ctx.ellipse(x, y + u * 0.8, u * 4.4, u * 1.7, 0, 0, TAU)
  ctx.fill()

  // Lantern first: it is the light source, so it sits behind the body it lights.
  const lanternX = x + (Math.sin(t) >= 0 ? -u * 4.6 : u * 4.6)
  const lanternY = y - height * 0.5 + sway
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const glow = ctx.createRadialGradient(
    lanternX, lanternY, 0,
    lanternX, lanternY, view.rim * (0.06 + charge * 0.12),
  )
  glow.addColorStop(0, css(LANTERN, 0.32 + charge * 0.5))
  glow.addColorStop(1, css(LANTERN, 0))
  ctx.fillStyle = glow
  ctx.fillRect(
    lanternX - view.rim * 0.2, lanternY - view.rim * 0.2,
    view.rim * 0.4, view.rim * 0.4,
  )
  ctx.restore()

  // Body: a hooded wedge. Kept as one silhouette so it survives being 12px tall.
  ctx.beginPath()
  ctx.moveTo(x, y - height)
  ctx.quadraticCurveTo(x + u * 3.4, y - height * 0.45, x + u * 2.6, y + u * 0.6)
  ctx.lineTo(x - u * 2.6, y + u * 0.6)
  ctx.quadraticCurveTo(x - u * 3.4, y - height * 0.45, x, y - height)
  ctx.closePath()
  ctx.fillStyle = css(palette.rockDark)
  ctx.fill()
  ctx.strokeStyle = css(BURN, 0.72)
  ctx.lineWidth = Math.max(1, u * 0.9)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y - height * 0.94, u * 1.5, 0, TAU)
  ctx.fillStyle = css(palette.rockDark)
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = css(LANTERN, 0.8)
  ctx.lineWidth = Math.max(1, u * 0.8)
  ctx.beginPath()
  ctx.moveTo(x + (lanternX - x) * 0.2, y - height * 0.62)
  ctx.lineTo(lanternX, lanternY - u * 1.6)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(lanternX, lanternY, u * 1.9, 0, TAU)
  ctx.fillStyle = css(LANTERN, 0.35 + charge * 0.6)
  ctx.fill()
  ctx.strokeStyle = css(LANTERN, 0.9)
  ctx.stroke()

  if (input.pour || input.draw) {
    drawStream(ctx, view, state, lanternX, lanternY, input.pour, time)
  }
}

/**
 * A bracket around the brazier the keeper would pour into.
 *
 * The rim is continuous but pouring snaps to the nearest lamp, and without this
 * the boundary between "this lamp" and "the next one" is invisible — which is
 * the kind of thing that makes a game feel like it ignored your input.
 */
function drawReachMarker(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: LumenState,
  time: number,
): void {
  const index = Math.round(state.keeper) % 12
  const t = theta(index)
  const x = Math.cos(t) * view.rim
  const y = Math.sin(t) * view.rim * view.squash
  const near = ringDistance(state.keeper, index) <= TUNING.claimReach
  const u = view.unit * depthScale(index)
  const pulse = near ? 0.55 + 0.2 * Math.sin(time * 5) : 0.22

  ctx.save()
  ctx.strokeStyle = css(EMBER_CORE, pulse)
  ctx.lineWidth = Math.max(1, u * 1.1)
  ctx.lineCap = 'round'
  const w = u * 5.5
  const h = u * 2.4
  ctx.beginPath()
  for (const sx of [-1, 1]) {
    ctx.moveTo(x + sx * w, y + u * 1.6 - h)
    ctx.lineTo(x + sx * w, y + u * 1.6)
    ctx.lineTo(x + sx * (w - h * 0.8), y + u * 1.6)
  }
  ctx.stroke()
  ctx.restore()
}

/** Light in transit, so a pour is visible rather than merely audible. */
function drawStream(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: LumenState,
  lanternX: number,
  lanternY: number,
  pouring: boolean,
  time: number,
): void {
  const index = Math.round(state.keeper) % 12
  const t = theta(index)
  const targetX = Math.cos(t) * view.rim
  const targetY = Math.sin(t) * view.rim * view.squash - view.rim * 0.09

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const colour = pouring ? EMBER : LANTERN
  for (let i = 0; i < 5; i++) {
    const phase = ((time * 2.6 + i / 5) % 1)
    const p = pouring ? phase : 1 - phase
    const x = lanternX + (targetX - lanternX) * p
    const y = lanternY + (targetY - lanternY) * p - Math.sin(p * Math.PI) * view.rim * 0.05
    ctx.fillStyle = css(colour, 0.85 * (1 - Math.abs(p - 0.5) * 0.8))
    ctx.beginPath()
    ctx.arc(x, y, view.unit * (1.4 + Math.sin(p * Math.PI) * 1.2), 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}
