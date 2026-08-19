import { noise1 } from '../../../lib/noise.ts'
import { css, mixRgb, type Palette, type Rgb, EMBER, EMBER_DEEP } from './palette.ts'
import { TAU, radiusAt, theta, type View } from './view.ts'

/** The faint violet the Deep glows with, and the swirl inside its mouth. */
const DEEP_GLOW: Rgb = [54, 24, 74]
const DEEP_SWIRL: Rgb = [120, 84, 200]

/**
 * The caldera wall and the Deep at the bottom of it.
 *
 * Terraces are not decoration: they are the ruler the player reads the burning
 * band against. "My light reaches the third shelf" is a sentence a player can
 * form after two minutes, and it is the only depth readout in the game.
 */

const RINGS = [0.2, 0.4, 0.6, 0.8] as const

const wallMix: Rgb = [0, 0, 0]
const shelfMix: Rgb = [0, 0, 0]

function ellipse(
  ctx: CanvasRenderingContext2D,
  view: View,
  climb: number,
  scale = 1,
): void {
  const r = radiusAt(view, climb) * scale
  ctx.beginPath()
  ctx.ellipse(0, (1 - climb) * view.bowl, r, r * view.squash, 0, 0, TAU)
}

export function drawCaldera(
  ctx: CanvasRenderingContext2D,
  view: View,
  palette: Palette,
  time: number,
): void {
  // A cornice of wind-packed snow around the mouth, so the rim has thickness.
  mixRgb(palette.snow, palette.snowShadow, 0.45, wallMix)
  ellipse(ctx, view, 1, 1.055)
  ctx.fillStyle = css(wallMix)
  ctx.fill()

  ellipse(ctx, view, 1)
  ctx.save()
  ctx.clip()

  const wall = ctx.createRadialGradient(
    0, view.bowl, view.deep * 0.4,
    0, view.bowl * 0.35, view.rim * 1.05,
  )
  wall.addColorStop(0, css(palette.deep))
  wall.addColorStop(0.42, css(palette.rockDark))
  wall.addColorStop(1, css(palette.rock))
  ctx.fillStyle = wall
  ctx.fillRect(-view.rim * 1.1, -view.rim, view.rim * 2.2, view.rim * 2.2 + view.bowl)

  drawTerraces(ctx, view, palette)
  drawFissures(ctx, view, palette)
  ctx.restore()

  drawDeep(ctx, view, palette, time)
  drawRimEdge(ctx, view, palette)
}

function drawTerraces(ctx: CanvasRenderingContext2D, view: View, palette: Palette): void {
  for (const climb of RINGS) {
    mixRgb(palette.rock, palette.snow, 0.16 + climb * 0.12, shelfMix)
    // The lit face of each shelf, then the shadow it casts on the one below.
    ellipse(ctx, view, climb)
    ctx.strokeStyle = css(shelfMix, 0.34)
    ctx.lineWidth = Math.max(1, view.unit * 1.2)
    ctx.stroke()

    ellipse(ctx, view, climb - 0.012)
    ctx.strokeStyle = css(palette.rockDark, 0.6)
    ctx.lineWidth = Math.max(1, view.unit * 2.2)
    ctx.stroke()
  }
}

function drawFissures(ctx: CanvasRenderingContext2D, view: View, palette: Palette): void {
  ctx.save()
  ctx.strokeStyle = css(palette.rockDark, 0.55)
  ctx.lineWidth = Math.max(1, view.unit * 1.4)
  ctx.beginPath()
  for (let i = 0; i < 34; i++) {
    const angle = (i / 34) * 12 + noise1(i * 3.3) * 0.4
    const t = theta(angle)
    const wobble = noise1(i * 7.1) * 0.5 - 0.25
    for (let s = 0; s <= 4; s++) {
      const climb = 0.08 + (s / 4) * 0.9
      const r = radiusAt(view, climb)
      const bend = t + wobble * (1 - climb) * 0.12
      const x = Math.cos(bend) * r
      const y = Math.sin(bend) * r * view.squash + (1 - climb) * view.bowl
      if (s === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * The Deep. It breathes — a slow swell in the glow and the swirl — because a
 * static black hole in the middle of the screen reads as a missing asset.
 */
function drawDeep(
  ctx: CanvasRenderingContext2D,
  view: View,
  palette: Palette,
  time: number,
): void {
  const breath = 0.5 + 0.5 * Math.sin(time * 0.7)

  ellipse(ctx, view, 0, 1.9)
  const halo = ctx.createRadialGradient(
    0, view.bowl, view.deep * 0.2,
    0, view.bowl, view.deep * 1.9,
  )
  halo.addColorStop(0, css(DEEP_GLOW, 0.5 + breath * 0.16))
  halo.addColorStop(1, css(DEEP_GLOW, 0))
  ctx.fillStyle = halo
  ctx.fill()

  ellipse(ctx, view, 0)
  ctx.fillStyle = css(palette.deep)
  ctx.fill()

  ctx.save()
  ctx.clip()
  ctx.strokeStyle = css(DEEP_SWIRL, 0.16)
  ctx.lineWidth = Math.max(1, view.unit)
  for (let i = 0; i < 3; i++) {
    const spin = time * (0.3 + i * 0.14) + i * 2.1
    const r = view.deep * (0.35 + i * 0.26)
    ctx.beginPath()
    ctx.ellipse(0, view.bowl, r, r * view.squash, spin, 0.4, 0.4 + Math.PI * 1.3)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * The lip. The far side faces the open sky and catches starlight; the near side
 * faces the viewer and is in its own shadow, which is what makes the bowl read
 * as a bowl rather than a disc with a hole in it.
 */
function drawRimEdge(ctx: CanvasRenderingContext2D, view: View, palette: Palette): void {
  ctx.lineWidth = Math.max(1.2, view.unit * 2)

  ctx.beginPath()
  ctx.ellipse(0, 0, view.rim, view.rim * view.squash, 0, Math.PI, TAU)
  mixRgb(palette.snow, [255, 255, 255], 0.25, wallMix)
  ctx.strokeStyle = css(wallMix, 0.85)
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(0, 0, view.rim, view.rim * view.squash, 0, 0, Math.PI)
  ctx.strokeStyle = css(palette.snowShadow, 0.9)
  ctx.stroke()
}

/** Embers drifting up out of the Deep. Pure atmosphere, no gameplay meaning. */
export function drawUpdraught(
  ctx: CanvasRenderingContext2D,
  view: View,
  time: number,
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 14; i++) {
    const phase = (time * 0.11 + i * 0.137) % 1
    const angle = i * 0.86 + noise1(i * 4.4) * 3
    const climb = phase * 0.7
    const t = theta(angle)
    const r = radiusAt(view, climb) * 0.85
    const x = Math.cos(t) * r
    const y = Math.sin(t) * r * view.squash + (1 - climb) * view.bowl
    const fade = Math.sin(phase * Math.PI)
    const size = view.unit * (0.9 + noise1(i * 2.2) * 1.1)
    ctx.fillStyle = css(phase < 0.5 ? EMBER_DEEP : EMBER, 0.32 * fade)
    ctx.beginPath()
    ctx.arc(x, y, size, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}
