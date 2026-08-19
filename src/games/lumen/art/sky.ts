import { fbm2, hash2, noise1 } from '../../../lib/noise.ts'
import { EMBER, css, mixRgb, type Palette, type Rgb } from './palette.ts'
import type { View } from './view.ts'

/** Firelight thrown outward onto the snow, tying the ring to the ground. */
const EMBER_SPILL: Rgb = EMBER

/**
 * Everything outside the caldera: sky, stars, aurora, the ridge on the horizon
 * and the snow plateau the rim sits in.
 *
 * This exists because a circular playfield centred on a phone screen leaves
 * four dead corners, and dead corners are what make a game look like a
 * prototype. It is also where the passage of the night is legible: the aurora
 * thins, the snow greys and the stars come out as the watches go by.
 *
 * The star field is baked into an offscreen canvas once per size, because a few
 * hundred sub-pixel arcs per frame is real money on a mid-range phone and the
 * stars do not move.
 */

const STAR_SEED = 0x5eed

let starCanvas: HTMLCanvasElement | undefined
let starKey = ''

function starField(width: number, height: number): HTMLCanvasElement | undefined {
  if (typeof document === 'undefined') return undefined
  const key = `${width}x${height}`
  if (starCanvas && starKey === key) return starCanvas

  const canvas = starCanvas ?? document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const count = Math.round((width * height) / 2600)
  for (let i = 0; i < count; i++) {
    const x = hash2(i, STAR_SEED) * width
    const y = Math.pow(hash2(i, STAR_SEED + 1), 1.6) * height
    const magnitude = hash2(i, STAR_SEED + 2)
    const radius = 0.4 + magnitude * magnitude * 1.5
    // A few stars get a faint colour cast; a uniformly white field looks fake.
    const tint = hash2(i, STAR_SEED + 3)
    ctx.fillStyle = tint > 0.86
      ? 'rgba(198,214,255,1)'
      : tint < 0.1 ? 'rgba(255,224,196,1)' : 'rgba(240,246,255,1)'
    ctx.globalAlpha = 0.2 + magnitude * 0.7
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  starCanvas = canvas
  starKey = key
  return canvas
}

export function drawSky(
  ctx: CanvasRenderingContext2D,
  view: View,
  palette: Palette,
  time: number,
  glow: number,
): void {
  const { width, height, horizon } = view

  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon + height * 0.08))
  sky.addColorStop(0, css(palette.skyHigh))
  sky.addColorStop(1, css(palette.skyLow))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  const stars = starField(width, height)
  if (stars) {
    ctx.save()
    // Clipped to the sky: stars on the snowfield read as dust on the lens.
    ctx.beginPath()
    ctx.rect(0, 0, width, Math.max(1, horizon))
    ctx.clip()
    ctx.globalAlpha = 0.5 + palette.night * 0.45
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(stars, 0, 0, width, height)
    ctx.restore()
  }

  drawAurora(ctx, view, palette, time)
  drawRidge(ctx, view, palette)
  drawPlateau(ctx, view, palette, glow)
}

const curtainMix: Rgb = [0, 0, 0]
const plateauDeep: Rgb = [0, 0, 0]

/**
 * Three curtains of aurora, warped by 1D value noise and blended additively so
 * the place two of them cross goes white on its own rather than being painted
 * white. Slow — a full drift takes about half a minute — because fast aurora
 * reads as a screensaver.
 *
 * The vertical structure comes from varying each curtain's opacity column by
 * column rather than from drawing rays over it. Discrete rays, which is the
 * obvious way to do it, come out as hard straight streaks and the whole sky
 * reads as rain on a window.
 */
function drawAurora(
  ctx: CanvasRenderingContext2D,
  view: View,
  palette: Palette,
  time: number,
): void {
  if (palette.aurora <= 0.02) return
  const { width, horizon } = view
  const columns = 34
  const span = width * 1.2
  const originX = -width * 0.1

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, width, Math.max(1, horizon))
  ctx.clip()
  ctx.globalCompositeOperation = 'lighter'

  for (let band = 0; band < 3; band++) {
    const warmth = band === 1 ? 0.85 : band === 2 ? 0.35 : 0.05
    mixRgb(palette.auroraCold, palette.auroraWarm, warmth, curtainMix)

    const drift = time * (0.05 + band * 0.022)
    const top = horizon * (-0.15 + band * 0.1)
    const depth = horizon * (0.7 + band * 0.16)

    const gradient = ctx.createLinearGradient(0, top, 0, top + depth)
    gradient.addColorStop(0, css(curtainMix, 0))
    gradient.addColorStop(0.3, css(curtainMix, 0.42 * palette.aurora))
    gradient.addColorStop(0.75, css(curtainMix, 0.2 * palette.aurora))
    gradient.addColorStop(1, css(curtainMix, 0))
    ctx.fillStyle = gradient

    const edge = (t: number) => top + noise1(t * 2.6 + drift + band * 17) * horizon * 0.34
    const foot = (t: number) =>
      top + depth * (0.6 + noise1(t * 2.1 + drift * 0.8 + band * 31) * 0.72)

    for (let i = 0; i < columns; i++) {
      const t0 = i / columns
      const t1 = (i + 1.02) / columns
      const x0 = originX + t0 * span
      const x1 = originX + t1 * span
      // Folds in the curtain: the same noise field, sampled much finer.
      const fold = noise1(t0 * 14 + drift * 3 + band * 7)
      ctx.globalAlpha = 0.35 + fold * fold * 0.65

      ctx.beginPath()
      ctx.moveTo(x0, edge(t0))
      ctx.lineTo(x1, edge(t1))
      ctx.lineTo(x1, foot(t1))
      ctx.lineTo(x0, foot(t0))
      ctx.closePath()
      ctx.fill()
    }
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

const ridgeNear: Rgb = [0, 0, 0]
const ridgeFar: Rgb = [0, 0, 0]

/** Two ranges of hills so the horizon has depth instead of being a line. */
function drawRidge(ctx: CanvasRenderingContext2D, view: View, palette: Palette): void {
  const { width, horizon, height } = view
  mixRgb(palette.rock, palette.skyLow, 0.55, ridgeFar)
  mixRgb(palette.rockDark, palette.rock, 0.4, ridgeNear)

  for (let layer = 0; layer < 2; layer++) {
    const amplitude = horizon * (layer === 0 ? 0.1 : 0.16)
    const base = horizon - (layer === 0 ? horizon * 0.03 : 0)
    ctx.beginPath()
    ctx.moveTo(-2, height)
    ctx.lineTo(-2, base)
    for (let x = -2; x <= width + 2; x += 8) {
      const n = fbm2(x * 0.0055 + layer * 40, layer * 9.5, 3)
      ctx.lineTo(x, base - Math.pow(n, 1.4) * amplitude)
    }
    ctx.lineTo(width + 2, height)
    ctx.closePath()
    ctx.fillStyle = css(layer === 0 ? ridgeFar : ridgeNear)
    ctx.fill()
  }
}

/**
 * The snowfield. Brightest at the horizon where it faces the open sky, settling
 * into blue shadow toward the viewer — but never into black, because a caldera
 * floating on a dark rectangle looks like a cut-out rather than a hole in the
 * ground. The warm ring near the rim is the lamps spilling outward, and it is
 * what actually joins the two together.
 */
function drawPlateau(
  ctx: CanvasRenderingContext2D,
  view: View,
  palette: Palette,
  glow: number,
): void {
  const { width, height, horizon, cx, cy, rim } = view

  mixRgb(palette.snowShadow, palette.rockDark, 0.55, plateauDeep)
  const ground = ctx.createLinearGradient(0, horizon, 0, height)
  ground.addColorStop(0, css(palette.snow, 0.95))
  ground.addColorStop(0.22, css(palette.snowShadow))
  ground.addColorStop(1, css(plateauDeep))
  ctx.fillStyle = ground
  ctx.fillRect(0, horizon - 1, width, height - horizon + 1)

  // Wind-scoured streaks, stable because they are hashed from position.
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, horizon - 1, width, height - horizon + 1)
  ctx.clip()
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = css(palette.snow)
  ctx.lineWidth = Math.max(1, view.unit)
  ctx.beginPath()
  for (let i = 0; i < 26; i++) {
    const t = hash2(i, 71)
    const y = horizon + Math.pow(t, 1.5) * (height - horizon)
    const x = hash2(i, 72) * width
    const run = width * (0.06 + hash2(i, 73) * 0.16)
    ctx.moveTo(x, y)
    ctx.lineTo(x + run, y + run * 0.06)
  }
  ctx.stroke()
  ctx.restore()

  if (glow <= 0.01) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const spill = ctx.createRadialGradient(cx, cy, rim * 0.95, cx, cy, rim * 1.85)
  spill.addColorStop(0, css(EMBER_SPILL, 0.13 * glow))
  spill.addColorStop(1, css(EMBER_SPILL, 0))
  ctx.fillStyle = spill
  ctx.fillRect(0, horizon - 1, width, height - horizon + 1)
  ctx.restore()
}
