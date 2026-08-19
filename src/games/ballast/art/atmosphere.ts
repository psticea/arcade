import type { Rng } from '../../../lib/prng.ts'
import { clamp } from '../../../lib/math.ts'
import { SHAFT_WIDTH } from '../simulation.ts'
import { css, shade, type Rgb } from './palette.ts'
import { noise1 } from '../../../lib/noise.ts'
import { sx, sy, type Frame } from './frame.ts'

/**
 * Water, light and everything drifting in it.
 *
 * The failing light *is* the difficulty curve: rays and caustics carry most of
 * the readability near the surface and are gone by 700 m, which forces the
 * player onto silhouette exactly as the shaft gets faster. Nothing here is
 * gameplay-critical on its own, so it can all be dialled down for reduced
 * motion without changing what the player has to do.
 */

const WARM_WHITE: Rgb = [255, 246, 222]

/** The base water column. One gradient, then a horizontal falloff. */
export function paintWater(frame: Frame): void {
  const { ctx, palette } = frame
  const gradient = ctx.createLinearGradient(0, 0, 0, frame.height)
  gradient.addColorStop(0, css(palette.waterTop))
  gradient.addColorStop(0.55, css(palette.waterDeep))
  gradient.addColorStop(1, shade(palette.waterDeep, -0.4))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, frame.width, frame.height)

  // The open shaft is brighter than the water pressed against the walls, which
  // separates the play space from the masonry before any detail is drawn.
  const centre = sx(frame, SHAFT_WIDTH / 2)
  const half = (SHAFT_WIDTH / 2) * frame.scale
  const column = ctx.createLinearGradient(centre - half, 0, centre + half, 0)
  column.addColorStop(0, css(palette.waterTop, 0))
  column.addColorStop(0.5, css(palette.waterTop, 0.28 + palette.daylight * 0.2))
  column.addColorStop(1, css(palette.waterTop, 0))
  ctx.fillStyle = column
  ctx.fillRect(centre - half, 0, half * 2, frame.height)
}

/**
 * God rays through the broken rose window, far above and slightly off-centre.
 *
 * Drawn into the emissive layer so the bloom pass softens them; a hard-edged
 * wedge reads as a polygon, a bloomed one reads as light.
 */
export function drawGodRays(frame: Frame): void {
  const strength = frame.palette.daylight
  if (strength < 0.015) return

  const glow = frame.glow
  const originX = frame.width * 0.44
  const originY = -frame.height * 1.15
  const length = frame.height * 2.6

  glow.save()
  glow.globalCompositeOperation = 'lighter'
  glow.translate(originX, originY)

  const rays = 7
  for (let i = 0; i < rays; i++) {
    const seed = i * 3.7
    const angle = -0.34 + (i / (rays - 1)) * 0.68 + Math.sin(frame.view.time * 0.13 + seed) * 0.018
    const breathe = 0.55 + 0.45 * Math.sin(frame.view.time * 0.31 + seed * 1.7)
    const near = frame.width * (0.012 + noise1(seed) * 0.02)
    const far = near * (5 + noise1(seed + 9) * 6)
    const alpha = strength * (0.05 + 0.07 * breathe)

    glow.save()
    glow.rotate(angle)
    const gradient = glow.createLinearGradient(0, 0, 0, length)
    gradient.addColorStop(0, css(frame.palette.ray, alpha * 1.5))
    gradient.addColorStop(0.45, css(frame.palette.ray, alpha * 0.8))
    gradient.addColorStop(1, css(frame.palette.ray, 0))
    glow.fillStyle = gradient
    glow.beginPath()
    glow.moveTo(-near, 0)
    glow.lineTo(near, 0)
    glow.lineTo(far, length)
    glow.lineTo(-far, length)
    glow.closePath()
    glow.fill()
    glow.restore()
  }
  glow.restore()
}

/**
 * Caustics crawling across the masonry.
 *
 * Sums of sines rather than sampled noise: the pattern has to be continuous as
 * the wall scrolls past, and a per-frame noise lookup at this density would not
 * fit the budget.
 */
export function drawCaustics(frame: Frame): void {
  const strength = frame.palette.daylight
  if (strength < 0.02) return

  const { ctx } = frame
  const leftEdge = sx(frame, 0)
  const rightEdge = sx(frame, SHAFT_WIDTH)
  const drift = frame.depth * frame.scale
  // Caustics are cast by the water in the shaft, so they die away from it. On a
  // wide screen, running them to the edge turns the wall into scan lines.
  const falloff = frame.scale * 26

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'

  const bands = 14
  const spacing = frame.height / 6
  for (let i = 0; i < bands; i++) {
    const phase = i * 1.7
    const y = ((i * spacing - drift * 0.6) % (frame.height + spacing * 2) + frame.height + spacing * 2)
      % (frame.height + spacing * 2) - spacing
    const wobble = Math.sin(frame.view.time * 0.9 + phase) * frame.height * 0.02
    const alpha = strength * (0.045 + 0.045 * Math.sin(frame.view.time * 1.3 + phase))
    if (alpha <= 0.002) continue

    for (const [edge, direction] of [[leftEdge, -1], [rightEdge, 1]] as const) {
      const far = edge + direction * falloff
      const x0 = Math.min(edge, far)
      const x1 = Math.max(edge, far)
      if (x1 - x0 < 4) continue

      ctx.beginPath()
      const steps = 5
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const x = edge + direction * falloff * t
        const yy = y + wobble * Math.sin(t * 3.1 + frame.view.time * 1.1 + phase)
          + Math.sin(t * 7 + phase) * frame.scale * 1.4
        if (s === 0) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      // Fade along the run so the band dissolves into the wall.
      const fade = ctx.createLinearGradient(edge, 0, far, 0)
      fade.addColorStop(0, css(frame.palette.ray, alpha * 0.6))
      fade.addColorStop(1, css(frame.palette.ray, 0))
      ctx.strokeStyle = fade
      ctx.lineWidth = frame.scale * 2.4
      ctx.stroke()

      const core = ctx.createLinearGradient(edge, 0, far, 0)
      core.addColorStop(0, css(WARM_WHITE, alpha))
      core.addColorStop(1, css(WARM_WHITE, 0))
      ctx.strokeStyle = core
      ctx.lineWidth = frame.scale * 0.6
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** Silt and bubbles. Their upward drift is the only cue for sink speed. */
export function drawDrift(frame: Frame): void {
  const { ctx, palette, view } = frame

  ctx.save()
  ctx.fillStyle = css(palette.stoneLit, 1)
  for (const mote of view.motes) {
    const x = mote.x + Math.sin(view.time * 0.7 + mote.phase) * 3 * mote.layer
    ctx.globalAlpha = mote.alpha * (0.35 + palette.daylight * 0.65)
    ctx.fillRect(x, mote.y, mote.size, mote.size * 2.6)
  }
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const bubble of view.bubbles) {
    const x = bubble.x + Math.sin(view.time * 2.1 + bubble.phase) * bubble.wobble
    const alpha = 0.06 + bubble.layer * 0.05
    ctx.strokeStyle = css(palette.stoneLit, alpha * 1.6)
    ctx.lineWidth = Math.max(0.6, bubble.radius * 0.34)
    ctx.beginPath()
    ctx.arc(x, bubble.y, bubble.radius, 0, Math.PI * 2)
    ctx.stroke()
    // The specular pip is what makes a circle read as a bubble.
    ctx.fillStyle = css(WARM_WHITE, alpha * 2.4)
    ctx.beginPath()
    ctx.arc(x - bubble.radius * 0.35, bubble.y - bubble.radius * 0.4, Math.max(0.4, bubble.radius * 0.24), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Sparks struck off the stone while the multiplier is climbing. */
export function drawSparks(frame: Frame): void {
  const glow = frame.glow
  glow.save()
  glow.globalCompositeOperation = 'lighter'
  for (const spark of frame.view.sparks) {
    if (spark.life <= 0) continue
    const t = spark.life / spark.maxLife
    const x = sx(frame, spark.x)
    const y = sy(frame, spark.depth)
    if (y < -20 || y > frame.height + 20) continue
    const color: Rgb = [255, Math.round(232 - spark.warmth * 70), Math.round(190 - spark.warmth * 120)]
    glow.fillStyle = css(color, t * 0.9)
    const size = spark.size * frame.scale * 0.5 * (0.4 + t)
    glow.fillRect(x - size / 2, y - size / 2, size, size * 1.6)
  }
  glow.restore()
}

/**
 * The surface, visible only for the first stretch of the descent.
 * Seeing it leave is what sells the descent as one-way.
 */
export function drawSurface(frame: Frame): void {
  const y = sy(frame, 0)
  if (y < -40) return
  const { ctx, palette } = frame

  ctx.save()
  const above = ctx.createLinearGradient(0, y - frame.height, 0, y)
  above.addColorStop(0, css(palette.ray, 0.5))
  above.addColorStop(0.75, css(palette.ray, 0.16))
  above.addColorStop(1, css(palette.ray, 0.04))
  ctx.fillStyle = above
  ctx.fillRect(0, y - frame.height, frame.width, frame.height)

  // A ripple line rather than a hard edge — a straight rule would read as a UI
  // divider, and this is water.
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = css(WARM_WHITE, 0.5)
  ctx.lineWidth = Math.max(1.5, frame.scale * 0.5)
  ctx.beginPath()
  for (let x = 0; x <= frame.width; x += 8) {
    const yy = y + Math.sin(x * 0.04 + frame.view.time * 1.7) * 2.4
      + Math.sin(x * 0.11 + frame.view.time * 2.6) * 1.2
    if (x === 0) ctx.moveTo(x, yy)
    else ctx.lineTo(x, yy)
  }
  ctx.stroke()
  ctx.restore()
}

/** Pressure at the edges of the frame. Warms as the multiplier climbs. */
export function drawVignette(frame: Frame): void {
  const { ctx, palette, view } = frame
  const gradient = ctx.createRadialGradient(
    frame.width / 2, frame.height * 0.42, frame.height * 0.18,
    frame.width / 2, frame.height * 0.5, frame.height * 0.82,
  )
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(0.6, `rgba(0,0,0,${0.16 + palette.depthFraction * 0.14})`)
  gradient.addColorStop(1, `rgba(0,0,0,${0.62 + palette.depthFraction * 0.2})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, frame.width, frame.height)

  const warm = view.earn * 0.5 + view.heat * 0.5
  if (warm > 0.02) {
    const edge = ctx.createRadialGradient(
      frame.width / 2, frame.height * 0.42, frame.height * 0.3,
      frame.width / 2, frame.height * 0.5, frame.height * 0.85,
    )
    edge.addColorStop(0, 'rgba(255,180,90,0)')
    edge.addColorStop(1, `rgba(255,170,80,${0.2 * warm})`)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = edge
    ctx.fillRect(0, 0, frame.width, frame.height)
    ctx.restore()
  }
}

export interface GrainTexture {
  canvas: HTMLCanvasElement
  size: number
}

/**
 * Suspended particulate, baked once.
 *
 * Real water is never clean, and a perfectly smooth gradient is the single
 * clearest tell that a scene was drawn rather than photographed. It also breaks
 * up banding in the long depth ramp for free.
 */
export function createGrain(rng: Rng, size = 128): GrainTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return { canvas, size }
  const image = ctx.createImageData(size, size)
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 110 + Math.floor(rng.next() * 36)
    image.data[i] = v
    image.data[i + 1] = v
    image.data[i + 2] = v
    image.data[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return { canvas, size }
}

export function drawGrain(frame: Frame, grain: GrainTexture): void {
  const { ctx, view } = frame
  const offsetX = -Math.floor(((view.time * 61) % grain.size))
  const offsetY = -Math.floor(((view.time * 97) % grain.size))
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.055
  for (let x = offsetX; x < frame.width; x += grain.size) {
    for (let y = offsetY; y < frame.height; y += grain.size) {
      ctx.drawImage(grain.canvas, x, y)
    }
  }
  ctx.restore()
}

/**
 * Depth haze over the far end of the shaft. Read-ahead fades rather than
 * stopping at a hard line, so the shaft feels like it continues past the frame.
 */
export function drawDepthHaze(frame: Frame): void {
  const { ctx, palette } = frame
  const gradient = ctx.createLinearGradient(0, frame.height * 0.55, 0, frame.height)
  gradient.addColorStop(0, css(palette.waterDeep, 0))
  gradient.addColorStop(1, css(palette.waterDeep, 0.85))
  ctx.fillStyle = gradient
  ctx.fillRect(0, frame.height * 0.55, frame.width, frame.height * 0.45)
}

/** The toll flash on a depth milestone: a pressure wave, not a strobe. */
export function drawToll(frame: Frame): void {
  const pulse = frame.view.tollPulse
  if (pulse <= 0.001) return
  const glow = frame.glow
  const t = 1 - pulse
  const radius = frame.height * (0.1 + t * 1.1)
  const centre = sx(frame, SHAFT_WIDTH / 2)
  const y = frame.anchorY

  glow.save()
  glow.globalCompositeOperation = 'lighter'
  const ring = glow.createRadialGradient(centre, y, radius * 0.72, centre, y, radius)
  ring.addColorStop(0, css(frame.palette.rim, 0))
  ring.addColorStop(0.65, css(frame.palette.rim, 0.16 * pulse * pulse))
  ring.addColorStop(1, css(frame.palette.rim, 0))
  glow.fillStyle = ring
  glow.fillRect(0, 0, frame.width, frame.height)
  glow.restore()
}

/** How far the player has strayed from the light, for subtle exposure drift. */
export function exposure(depth: number): number {
  return clamp(1 - depth / 3000, 0.35, 1)
}
