import { hash2, noise1 } from '../../../lib/noise.ts'
import {
  BOONS, TUNING, offerUnderKeeper, totalLight, type LumenState,
} from '../simulation.ts'
import { BURN, EMBER_CORE, LANTERN, css, type Palette } from './palette.ts'
import type { View } from './view.ts'

/**
 * Weather, vignette and the only words on the play surface.
 *
 * The game runs wordless except during a respite, where three signs have to be
 * told apart. Their glyphs are in the world; the name and the effect of the one
 * you are standing at are written once, large, in the empty sky above the
 * caldera — which is legible on a 390px screen and never overlaps the thumbs.
 */

const DISPLAY = "'Orbitron', 'Segoe UI', system-ui, sans-serif"
const FLAKES = 90

/** Snow blowing across the whole frame, in front of everything. */
export function drawSnow(
  ctx: CanvasRenderingContext2D,
  view: View,
  palette: Palette,
  time: number,
  calm: boolean,
): void {
  const { width, height } = view
  const speed = calm ? 0.25 : 1
  ctx.save()
  for (let i = 0; i < FLAKES; i++) {
    const depth = 0.35 + hash2(i, 5) * 0.65
    const fall = ((time * (14 + depth * 46) * speed) + hash2(i, 6) * height) % (height + 40)
    const drift = noise1(time * 0.25 * speed + i * 0.7) * width * 0.06 * depth
    const x = (hash2(i, 7) * width + drift + time * 9 * depth * speed) % (width + 30) - 15
    const y = fall - 20
    ctx.globalAlpha = 0.1 + depth * 0.4
    ctx.fillStyle = css(palette.snow)
    ctx.beginPath()
    ctx.arc(x, y, depth * view.unit * 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Vignette, plus a warning pulse when there is almost no light left anywhere. */
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: LumenState,
  time: number,
): void {
  const { width, height } = view
  const gradient = ctx.createRadialGradient(
    width / 2, height * 0.55, Math.min(width, height) * 0.28,
    width / 2, height * 0.55, Math.max(width, height) * 0.78,
  )
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, 'rgba(0,0,0,0.62)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const light = totalLight(state)
  if (light > 70) return
  // A slow breath, never a strobe: this triggers exactly when a player is
  // panicking, which is the worst possible moment to flash a screen.
  const urgency = (1 - light / 70) * (0.45 + 0.25 * Math.sin(time * 2.6))
  const warn = ctx.createRadialGradient(
    width / 2, height * 0.55, Math.min(width, height) * 0.34,
    width / 2, height * 0.55, Math.max(width, height) * 0.7,
  )
  warn.addColorStop(0, 'rgba(120,10,30,0)')
  warn.addColorStop(1, `rgba(150,16,40,${(0.5 * urgency).toFixed(3)})`)
  ctx.fillStyle = warn
  ctx.fillRect(0, 0, width, height)
}

/**
 * The respite: what the sign you are standing at will do, or a nudge toward the
 * three of them if you are not standing at one.
 */
export function drawOfferPanel(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: LumenState,
): void {
  if (state.offers.length === 0) return
  const offer = offerUnderKeeper(state)
  const y = Math.max(58, view.horizon * 0.52)
  const centre = view.width / 2

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (!offer) {
    ctx.font = `600 ${Math.round(11 * view.unit)}px ${DISPLAY}`
    ctx.fillStyle = css(LANTERN, 0.75)
    ctx.letterSpacing = '0.24em'
    ctx.fillText('THREE SIGNS · STAND AT ONE AND POUR', centre, y)
    ctx.restore()
    return
  }

  const boon = BOONS[offer.boon]
  ctx.font = `700 ${Math.round(23 * view.unit)}px ${DISPLAY}`
  ctx.letterSpacing = '0.2em'
  ctx.fillStyle = css(BURN, 0.96)
  ctx.fillText(boon.name, centre, y)

  ctx.font = `500 ${Math.round(11.5 * view.unit)}px ${DISPLAY}`
  ctx.letterSpacing = '0.1em'
  ctx.fillStyle = css(EMBER_CORE, 0.82)
  ctx.fillText(boon.blurb.toUpperCase(), centre, y + 24 * view.unit)

  if (state.claim > 0) {
    const width = 120 * view.unit
    ctx.fillStyle = css(BURN, 0.22)
    ctx.fillRect(centre - width / 2, y + 38 * view.unit, width, 3 * view.unit)
    ctx.fillStyle = css(BURN, 0.95)
    ctx.fillRect(
      centre - width / 2, y + 38 * view.unit,
      width * Math.min(1, state.claim / TUNING.claimTime), 3 * view.unit,
    )
  }
  ctx.restore()
}

/** "WATCH 4" as it begins, held for a couple of seconds then gone. */
export function drawWatchTitle(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: LumenState,
  fade: number,
): void {
  if (fade <= 0) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, fade)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${Math.round(30 * view.unit)}px ${DISPLAY}`
  ctx.letterSpacing = '0.34em'
  ctx.fillStyle = css(BURN, 0.9)
  ctx.fillText(`WATCH ${state.watch + 1}`, view.width / 2, view.horizon * 0.42)
  ctx.restore()
}
