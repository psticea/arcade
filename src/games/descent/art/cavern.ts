import {
  TERRAIN_STEP,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Terrain,
} from '../simulation.ts'
import { hash2, hash3, fbm2 } from '../../../lib/noise.ts'
import { css, shade } from './palette.ts'
import type { DescentFrame } from './frame.ts'

/**
 * The cave.
 *
 * Rock is drawn as a solid mass with a lit arris along the edge it turns to the
 * open air, bedding planes that follow the contour, and mineral seams that are
 * the only saturated colour down here. It is deliberately *dark*: the scene is
 * painted at full brightness and then multiplied by the light map, so almost
 * everything you can see at any moment is something the drone's lamp is
 * pointing at. That is the whole art direction, and it is also the difficulty
 * curve — deeper caverns are rougher, and you see less of them at once.
 */

/** Depth of the strata band pattern, in world units. */
const BEDDING = 2.6

export interface CavernArt {
  /** Parallax silhouettes behind the playfield, one entry per layer. */
  layers: { offset: number; depth: number; amplitude: number }[]
}

export function createCavernArt(): CavernArt {
  return {
    layers: [
      { offset: 137.4, depth: 0.32, amplitude: 1.5 },
      { offset: 61.9, depth: 0.56, amplitude: 1.2 },
    ],
  }
}

/**
 * Distant cave walls behind the playfield.
 *
 * They scroll slower and sit closer to the haze colour, which is the cheapest
 * honest way to say "this cave is enormous" — without them the playfield reads
 * as a cross-section drawn on black.
 */
export function drawParallax(frame: DescentFrame, art: CavernArt, terrain: Terrain): void {
  const { ctx, palette } = frame

  for (const layer of art.layers) {
    const drift = (1 - layer.depth) * 14
    ctx.beginPath()
    ctx.moveTo(frame.viewLeft - 10, WORLD_HEIGHT + 20)
    for (let x = frame.viewLeft - 10; x <= frame.viewRight + 10; x += 1.4) {
      const base = sampleFloor(terrain, x + drift)
      const wobble = (fbm2(x * 0.06 + layer.offset, layer.offset * 0.4, 2) - 0.5) * 9 * layer.amplitude
      ctx.lineTo(x, base + wobble * 0.6 - 4 * (1 - layer.depth))
    }
    ctx.lineTo(frame.viewRight + 10, WORLD_HEIGHT + 20)
    ctx.closePath()
    ctx.fillStyle = shade(palette.haze, -0.25 + layer.depth * 0.42)
    ctx.fill()

    // The matching roof, so the far cave is a cave rather than a horizon.
    ctx.beginPath()
    ctx.moveTo(frame.viewLeft - 10, -30)
    for (let x = frame.viewLeft - 10; x <= frame.viewRight + 10; x += 1.4) {
      const base = sampleRoof(terrain, x + drift)
      const wobble = (fbm2(x * 0.07 + layer.offset * 1.7, 90 + layer.offset * 0.2, 2) - 0.5) * 7 * layer.amplitude
      ctx.lineTo(x, base + wobble * 0.6 + 3 * (1 - layer.depth))
    }
    ctx.lineTo(frame.viewRight + 10, -30)
    ctx.closePath()
    ctx.fillStyle = shade(palette.haze, -0.3 + layer.depth * 0.42)
    ctx.fill()
  }
}

function sampleFloor(terrain: Terrain, x: number): number {
  const raw = x / TERRAIN_STEP
  const index = Math.max(0, Math.min(terrain.heights.length - 1, Math.round(raw)))
  return terrain.heights[index] ?? WORLD_HEIGHT
}

function sampleRoof(terrain: Terrain, x: number): number {
  const raw = x / TERRAIN_STEP
  const index = Math.max(0, Math.min(terrain.ceilings.length - 1, Math.round(raw)))
  return terrain.ceilings[index] ?? 0
}

/** Build the floor outline across the visible span, into the current path. */
function floorPath(frame: DescentFrame, terrain: Terrain): void {
  const { ctx } = frame
  const from = Math.max(0, Math.floor((frame.viewLeft - 4) / TERRAIN_STEP))
  const to = Math.min(terrain.heights.length - 1, Math.ceil((frame.viewRight + 4) / TERRAIN_STEP))

  ctx.beginPath()
  ctx.moveTo(from * TERRAIN_STEP, WORLD_HEIGHT + 30)
  for (let i = from; i <= to; i++) ctx.lineTo(i * TERRAIN_STEP, terrain.heights[i] ?? WORLD_HEIGHT)
  ctx.lineTo(to * TERRAIN_STEP, WORLD_HEIGHT + 30)
  ctx.closePath()
}

function roofPath(frame: DescentFrame, terrain: Terrain): void {
  const { ctx } = frame
  const from = Math.max(0, Math.floor((frame.viewLeft - 4) / TERRAIN_STEP))
  const to = Math.min(terrain.ceilings.length - 1, Math.ceil((frame.viewRight + 4) / TERRAIN_STEP))

  ctx.beginPath()
  ctx.moveTo(from * TERRAIN_STEP, -40)
  for (let i = from; i <= to; i++) ctx.lineTo(i * TERRAIN_STEP, terrain.ceilings[i] ?? 0)
  ctx.lineTo(to * TERRAIN_STEP, -40)
  ctx.closePath()
}

export function drawCavern(frame: DescentFrame, terrain: Terrain): void {
  drawMass(frame, terrain, false)
  drawMass(frame, terrain, true)
}

/**
 * One rock mass — floor or roof.
 *
 * Both are the same material lit from the same side, so they are the same code
 * with the arris on opposite edges. Detail is clipped inside the silhouette,
 * which means the outline stays crisp no matter how much texture goes on.
 */
function drawMass(frame: DescentFrame, terrain: Terrain, roof: boolean): void {
  const { ctx, palette } = frame
  const profile = roof ? terrain.ceilings : terrain.heights
  const rimDirection = roof ? 1 : -1

  if (roof) roofPath(frame, terrain)
  else floorPath(frame, terrain)

  // The body. Vertical falloff away from the open air does most of the work of
  // making a flat fill read as a mass with a top surface.
  const near = roof ? frame.viewTop : frame.viewBottom
  const far = roof ? frame.viewBottom : frame.viewTop
  const body = ctx.createLinearGradient(0, far, 0, near)
  body.addColorStop(0, css(palette.rockDark))
  body.addColorStop(0.45, shade(palette.rock, -0.55))
  body.addColorStop(1, shade(palette.rock, -0.28))
  ctx.fillStyle = body
  ctx.fill()

  ctx.save()
  ctx.clip()
  drawBedding(frame, terrain, roof)
  drawSeams(frame, terrain, roof)
  ctx.restore()

  drawArris(frame, profile, rimDirection)
}

/**
 * The lit edge where rock meets air.
 *
 * Drawn in short segments whose brightness falls off with distance from the
 * lamp, rather than as one even outline. An even outline is the single
 * clearest tell that a scene was drawn rather than lit: it says "here is the
 * boundary of a shape" when the frame is trying to say "this is as far as the
 * light reaches". Segmenting it is also what makes sweeping the lamp across a
 * ridge feel like discovering the ridge.
 */
function drawArris(frame: DescentFrame, profile: number[], rimDirection: number): void {
  const { ctx, palette } = frame
  const glow = frame.glow
  const from = Math.max(0, Math.floor((frame.viewLeft - 4) / TERRAIN_STEP))
  const to = Math.min(profile.length - 1, Math.ceil((frame.viewRight + 4) / TERRAIN_STEP))
  const chunk = 6
  const reach = 30

  for (let start = from; start < to; start += chunk) {
    const end = Math.min(to, start + chunk)
    const midX = ((start + end) / 2) * TERRAIN_STEP
    const midY = profile[Math.round((start + end) / 2)] ?? 0
    const distance = Math.hypot(midX - frame.lightX, midY - frame.lightY)
    const lit = Math.max(0, 1 - distance / reach)
    // Never fully dark: the edge the pilot flies against has to stay findable
    // even when the lamp is pointing somewhere else.
    const alpha = 0.2 + lit * lit * 0.75

    ctx.beginPath()
    for (let i = start; i <= end; i++) {
      const x = i * TERRAIN_STEP
      const y = profile[i] ?? 0
      if (i === start) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = css(palette.rim, alpha)
    ctx.lineWidth = 0.13
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.strokeStyle = css(palette.rim, alpha * 0.16)
    ctx.lineWidth = 0.8
    ctx.stroke()

    if (lit <= 0.02) continue
    glow.beginPath()
    for (let i = start; i <= end; i++) {
      const x = i * TERRAIN_STEP
      const y = (profile[i] ?? 0) + rimDirection * 0.05
      if (i === start) glow.moveTo(x, y)
      else glow.lineTo(x, y)
    }
    glow.strokeStyle = css(palette.rim, lit * lit * 0.35)
    glow.lineWidth = 0.3
    glow.lineJoin = 'round'
    glow.stroke()
  }
}

/**
 * Bedding planes, drawn as filled bands rather than contour lines.
 *
 * Hairline contours following a surface read as a topographic map, which is
 * exactly the "procedural terrain demo" look this is trying to get away from.
 * Alternating tonal bands read as sedimentary rock, and they carry the light
 * falloff into the body of the mass instead of leaving it a flat fill.
 */
function drawBedding(frame: DescentFrame, terrain: Terrain, roof: boolean): void {
  const { ctx, palette } = frame
  const profile = roof ? terrain.ceilings : terrain.heights
  const direction = roof ? -1 : 1
  const from = Math.max(0, Math.floor((frame.viewLeft - 4) / TERRAIN_STEP))
  const to = Math.min(profile.length - 1, Math.ceil((frame.viewRight + 4) / TERRAIN_STEP))
  const step = 3
  const bands = 7

  const offsetAt = (i: number, band: number): number => {
    const x = i * TERRAIN_STEP
    const drift = (fbm2(x * 0.028 + band * 12.7, band * 3.1, 2) - 0.5) * BEDDING * 1.8
    return (profile[i] ?? 0) + direction * (band * BEDDING * (0.75 + band * 0.1) + drift)
  }

  for (let band = 0; band < bands; band++) {
    const tone = hash2(band, roof ? 1 : 0)
    ctx.beginPath()
    for (let i = from; i <= to; i += step) ctx.lineTo(i * TERRAIN_STEP, offsetAt(i, band))
    for (let i = to; i >= from; i -= step) ctx.lineTo(i * TERRAIN_STEP, offsetAt(i, band + 1))
    ctx.closePath()
    ctx.fillStyle = tone > 0.5
      ? shade(palette.rock, -0.5, 0.5)
      : shade(palette.rockDark, 0.12, 0.55)
    ctx.fill()

    // A hard parting at the top of each stratum. One line per band, not nine.
    ctx.beginPath()
    for (let i = from; i <= to; i += step) ctx.lineTo(i * TERRAIN_STEP, offsetAt(i, band))
    ctx.strokeStyle = css(palette.rockDark, 0.75)
    ctx.lineWidth = 0.11
    ctx.stroke()
  }
}

/**
 * Mineral seams.
 *
 * The only saturated colour in the rock, and the one thing that changes
 * unmistakably as the run gets deeper — cyan near the surface, iron-red at the
 * bottom. They are emissive, so they survive the light map and give the pilot
 * something to see in caves the lamp is not pointing at.
 */
function drawSeams(frame: DescentFrame, terrain: Terrain, roof: boolean): void {
  const { ctx, palette, view } = frame
  const profile = roof ? terrain.ceilings : terrain.heights
  const direction = roof ? -1 : 1
  const glow = frame.glow
  const light = frame.light

  const first = Math.floor((frame.viewLeft - 6) / 7)
  const last = Math.ceil((frame.viewRight + 6) / 7)

  for (let cell = first; cell <= last; cell++) {
    const seed = hash2(cell, roof ? 7 : 3)
    if (seed < 0.45) continue

    const x = cell * 7 + hash3(cell, 1, roof ? 1 : 0) * 5
    const surface = profile[Math.max(0, Math.min(profile.length - 1, Math.round(x / TERRAIN_STEP)))] ?? 0
    const depth = 1.4 + hash3(cell, 2, 0) * 4
    const y = surface + direction * depth
    const length = 1.6 + hash3(cell, 3, 0) * 3.4
    const angle = (hash3(cell, 4, 0) - 0.5) * 2.2
    // Each seam pulses on its own clock, so the cave never blinks in unison.
    const pulse = 0.55 + 0.45 * Math.sin(view.time * (0.6 + seed * 0.7) + cell)

    // A vein, not a strip light: a main run with two short branches off it,
    // drawn thin. A single fat stroke reads as an object lying on the rock.
    const dx = Math.cos(angle) * length * 0.5
    const dy = Math.sin(angle) * length * 0.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - dx, y - dy)
    ctx.lineTo(x + dx, y + dy)
    for (let b = 0; b < 2; b++) {
      const t = 0.25 + b * 0.4
      const bx = x - dx + dx * 2 * t
      const by = y - dy + dy * 2 * t
      const branch = angle + (hash3(cell, 5 + b, 0) - 0.5) * 2.4
      const reach = length * (0.2 + hash3(cell, 7 + b, 0) * 0.3)
      ctx.moveTo(bx, by)
      ctx.lineTo(bx + Math.cos(branch) * reach, by + Math.sin(branch) * reach)
    }
    ctx.strokeStyle = css(palette.seam, 0.28 + pulse * 0.22)
    ctx.lineWidth = 0.08
    ctx.stroke()

    glow.strokeStyle = css(palette.seam, 0.22 * pulse)
    glow.lineWidth = 0.16
    glow.lineCap = 'round'
    glow.beginPath()
    glow.moveTo(x - dx, y - dy)
    glow.lineTo(x + dx, y + dy)
    glow.stroke()

    // Seams light the rock around them, faintly. It is not enough to fly by,
    // which is the point: it shows you the cave without showing you the pad.
    const halo = light.createRadialGradient(x, y, 0, x, y, length * 2.2)
    halo.addColorStop(0, css(palette.seam, 0.26 * pulse))
    halo.addColorStop(1, css(palette.seam, 0))
    light.fillStyle = halo
    light.fillRect(x - length * 2.2, y - length * 2.2, length * 4.4, length * 4.4)
  }
}

/** Dust hanging in the air, drawn where the lamp can catch it. */
export function drawAirborneDust(frame: DescentFrame): void {
  const { ctx, palette, view } = frame
  const cell = 3.5
  const first = Math.floor(frame.viewLeft / cell)
  const last = Math.ceil(frame.viewRight / cell)
  const top = Math.floor(frame.viewTop / cell)
  const bottom = Math.ceil(frame.viewBottom / cell)

  ctx.fillStyle = css(palette.rim, 0.5)
  for (let cx = first; cx <= last; cx++) {
    for (let cy = top; cy <= bottom; cy++) {
      const n = hash2(cx, cy)
      if (n < 0.55) continue
      const drift = view.time * (0.1 + n * 0.16)
      const x = cx * cell + hash3(cx, cy, 1) * cell + Math.sin(drift + cx) * 0.4
      const y = cy * cell + hash3(cx, cy, 2) * cell + Math.cos(drift * 0.8 + cy) * 0.4
      if (x < frame.viewLeft || x > frame.viewRight) continue
      ctx.globalAlpha = 0.1 + hash3(cx, cy, 3) * 0.3
      const size = 0.04 + hash3(cx, cy, 4) * 0.07
      ctx.fillRect(x, y, size, size)
    }
  }
  ctx.globalAlpha = 1
}

/** How far the rock reaches at a world x, used to place ground-effect dust. */
export function surfaceAt(terrain: Terrain, x: number): number {
  return sampleFloor(terrain, Math.max(0, Math.min(WORLD_WIDTH, x)))
}
