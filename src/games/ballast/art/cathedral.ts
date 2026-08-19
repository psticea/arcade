import type { Rng } from '../../../lib/prng.ts'
import { clamp } from '../../../lib/math.ts'
import { SHAFT_WIDTH, SHOULDER_ABOVE, SHOULDER_BELOW, reachAt, type Obstacle } from '../simulation.ts'
import { css, shade, GLASS_HUES, EMBER, type Rgb } from './palette.ts'
import { hash2, hash3 } from '../../../lib/noise.ts'
import { sx, sy, depthAt, type Frame } from './frame.ts'

/**
 * The drowned cathedral.
 *
 * Two rules govern everything here. **Silhouette first:** masonry has to read in
 * greyscale at 1200 m, where colour has left the water entirely, so every form
 * is separated by luminance before it is separated by hue. **Light comes from
 * the shaft:** the walls are lit along the corner they present to the open
 * water, which is also the edge the player has to judge, so the art direction
 * and the read-ahead the game needs are the same line.
 */

/** Height of one ashlar course, in shaft units. */
const COURSE = 5
/** The stone texture tile, in shaft units. Both axes wrap. */
const TILE_UNITS_W = 64
const TILE_UNITS_H = COURSE * 12
/** Texture resolution. Generated once and blitted, never re-rasterised. */
const TILE_PX_W = 384
const TILE_PX_H = 432

/** Arcade bays repeat on this pitch, in metres of depth. */
const BAY_PITCH = 46

export interface StoneTexture {
  canvas: HTMLCanvasElement
  unitsWide: number
  unitsTall: number
}

/** Baked bay interiors. Index by hash; blit one per bay per frame. */
export interface BayAtlas {
  glass: HTMLCanvasElement[]
  chapels: HTMLCanvasElement[]
  width: number
  height: number
}

const BAY_PX_W = 128
const BAY_PX_H = 340

/**
 * Bake every bay interior once.
 *
 * A window is thirty-odd panes, lead cames, mullions and an oculus, all inside
 * a clipped arch — perhaps a dozen bays are on screen at a time, and drawing
 * them live was over a third of the entire frame on an Intel HD 4000. They
 * never change shape, so they are rasterised at construction and blitted, with
 * `globalAlpha` carrying the depth dimming that used to be baked into the fill.
 */
export function createBayAtlas(rng: Rng): BayAtlas {
  const glass: HTMLCanvasElement[] = []
  const chapels: HTMLCanvasElement[] = []

  for (let v = 0; v < GLASS_HUES.length; v++) {
    const base = GLASS_HUES[v] ?? (GLASS_HUES[0] as Rgb)
    const accent = GLASS_HUES[(v + 2) % GLASS_HUES.length] ?? base
    glass.push(bakeGlass(rng, base, accent))
  }
  for (let v = 0; v < 3; v++) chapels.push(bakeChapel(rng))

  return { glass, chapels, width: BAY_PX_W, height: BAY_PX_H }
}

function bakeSurface(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas')
  canvas.width = BAY_PX_W
  canvas.height = BAY_PX_H
  return { canvas, ctx: canvas.getContext('2d') }
}

function bakeGlass(rng: Rng, base: Rgb, accent: Rgb): HTMLCanvasElement {
  const { canvas, ctx } = bakeSurface()
  if (!ctx) return canvas
  const baseY = BAY_PX_H
  const topY = 0

  ctx.save()
  archPath(ctx, 0, BAY_PX_W, baseY, topY)
  ctx.clip()

  ctx.fillStyle = css(base)
  ctx.fillRect(0, 0, BAY_PX_W, BAY_PX_H)

  // One window, one hue family. Sampling every colour per pane turns a rose
  // window into confetti; real glass reads as a single note with variation
  // inside it, and at a glance that is what makes it look like glass.
  // Panes are small and irregular so the window never reads as a spreadsheet.
  const cols = 5
  const rows = 16
  const cellW = BAY_PX_W / cols
  const cellH = BAY_PX_H / rows
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const n = rng.next()
      ctx.fillStyle = css(n > 0.9 ? accent : base, 0.3 + n * 0.45)
      ctx.fillRect(cx * cellW, cy * cellH, cellW, cellH)
      // A brighter fleck in about one pane in six: the figures in the glass.
      if (rng.chance(0.16)) {
        ctx.fillStyle = `rgba(255,246,220,${rng.range(0.08, 0.26)})`
        ctx.fillRect(cx * cellW + cellW * 0.2, cy * cellH + cellH * 0.2, cellW * 0.6, cellH * 0.6)
      }
    }
  }

  // Lead cames, then the mullions that make it gothic rather than a grid.
  ctx.strokeStyle = 'rgba(6,10,14,0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let cx = 1; cx < cols; cx++) {
    ctx.moveTo(cx * cellW, 0)
    ctx.lineTo(cx * cellW, BAY_PX_H)
  }
  for (let cy = 1; cy < rows; cy++) {
    ctx.moveTo(0, cy * cellH)
    ctx.lineTo(BAY_PX_W, cy * cellH)
  }
  ctx.stroke()

  ctx.strokeStyle = 'rgba(4,7,10,0.96)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(BAY_PX_W / 2, BAY_PX_H)
  ctx.lineTo(BAY_PX_W / 2, BAY_PX_H * 0.32)
  ctx.moveTo(BAY_PX_W * 0.5, BAY_PX_H * 0.36)
  ctx.stroke()
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(BAY_PX_W / 2, BAY_PX_H * 0.19, BAY_PX_W * 0.2, 0, Math.PI * 2)
  ctx.stroke()

  // The window is brightest at its head, where the light outside is strongest.
  const wash = ctx.createLinearGradient(0, 0, 0, BAY_PX_H)
  wash.addColorStop(0, 'rgba(255,255,255,0.22)')
  wash.addColorStop(0.6, 'rgba(255,255,255,0)')
  wash.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, BAY_PX_W, BAY_PX_H)
  ctx.restore()

  return canvas
}

function bakeChapel(rng: Rng): HTMLCanvasElement {
  const { canvas, ctx } = bakeSurface()
  if (!ctx) return canvas

  ctx.save()
  archPath(ctx, 0, BAY_PX_W, BAY_PX_H, 0)
  ctx.clip()
  ctx.fillStyle = '#05090e'
  ctx.fillRect(0, 0, BAY_PX_W, BAY_PX_H)

  // A glimpse of the nave beyond: three receding arches, each dimmer than the
  // last, so the wall reads as having real thickness rather than being a flat.
  for (let i = 0; i < 3; i++) {
    const inset = BAY_PX_W * (0.1 + i * 0.13)
    ctx.strokeStyle = `rgba(${90 - i * 20},${130 - i * 26},${140 - i * 28},${0.3 - i * 0.08})`
    ctx.lineWidth = 3 - i * 0.6
    archPath(ctx, inset, BAY_PX_W - inset, BAY_PX_H - i * 14, BAY_PX_H * (0.1 + i * 0.05))
    ctx.stroke()
  }

  // Rubble on the chapel floor.
  ctx.fillStyle = 'rgba(20,30,38,0.9)'
  for (let i = 0; i < 7; i++) {
    const w = rng.range(10, 34)
    ctx.fillRect(rng.range(0, BAY_PX_W - w), BAY_PX_H - rng.range(4, 26), w, rng.range(4, 12))
  }
  ctx.restore()
  return canvas
}

/**
 * Bake the ashlar into a tiling greyscale texture.
 *
 * Blitting one prepared tile and compositing it with `overlay` costs two draw
 * calls per wall, where drawing several hundred individual blocks every frame
 * would not fit the budget on a mid-range phone. Greyscale is deliberate: the
 * tile carries only luminance, so the depth ramp keeps full control of hue.
 */
export function createStoneTexture(rng: Rng): StoneTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_PX_W
  canvas.height = TILE_PX_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return { canvas, unitsWide: TILE_UNITS_W, unitsTall: TILE_UNITS_H }

  const rows = TILE_UNITS_H / COURSE
  const rowPx = TILE_PX_H / rows

  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, TILE_PX_W, TILE_PX_H)

  for (let row = 0; row < rows; row++) {
    const y = row * rowPx
    // Alternating block counts give a running bond without any wrap seam:
    // every row still starts and ends exactly on the tile edge.
    const count = row % 2 === 0 ? 5 : 6
    const boundaries: number[] = [0]
    for (let i = 1; i < count; i++) {
      boundaries.push((i / count) * TILE_PX_W + (rng.next() - 0.5) * (TILE_PX_W / count) * 0.28)
    }
    boundaries.push(TILE_PX_W)

    for (let i = 0; i < count; i++) {
      const x0 = boundaries[i] ?? 0
      const x1 = boundaries[i + 1] ?? TILE_PX_W
      const tone = 0.44 + rng.next() * 0.17
      // A handful of blocks are water-stained much darker; they are what stops
      // the wall reading as a repeated pattern.
      const stained = rng.chance(0.09) ? -0.13 : 0
      const grey = Math.round((tone + stained) * 255)
      ctx.fillStyle = `rgb(${grey},${grey},${grey})`
      ctx.fillRect(x0, y, x1 - x0, rowPx)

      // The lit lip along the top arris of each block, and the shadow it casts
      // into the joint below it.
      ctx.fillStyle = `rgba(255,255,255,${0.1 + rng.next() * 0.12})`
      ctx.fillRect(x0, y, x1 - x0, Math.max(1, rowPx * 0.08))
      ctx.fillStyle = 'rgba(0,0,0,0.34)'
      ctx.fillRect(x0, y + rowPx - Math.max(1, rowPx * 0.09), x1 - x0, Math.max(1, rowPx * 0.09))
      ctx.fillRect(x0, y, Math.max(1, TILE_PX_W * 0.004), rowPx)
    }
  }

  // Erosion and pitting, wrapped on both axes so the tile stays seamless.
  ctx.globalCompositeOperation = 'source-over'
  for (let i = 0; i < 260; i++) {
    const x = rng.range(0, TILE_PX_W)
    const y = rng.range(0, TILE_PX_H)
    const r = rng.range(1.5, 11)
    const dark = rng.chance(0.7)
    ctx.fillStyle = dark
      ? `rgba(0,0,0,${rng.range(0.03, 0.13)})`
      : `rgba(255,255,255,${rng.range(0.02, 0.07)})`
    for (const ox of [-TILE_PX_W, 0, TILE_PX_W]) {
      for (const oy of [-TILE_PX_H, 0, TILE_PX_H]) {
        if (Math.abs(x + ox - TILE_PX_W / 2) > TILE_PX_W || Math.abs(y + oy - TILE_PX_H / 2) > TILE_PX_H) continue
        ctx.beginPath()
        ctx.ellipse(x + ox, y + oy, r, r * rng.range(0.4, 1.1), 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  return { canvas, unitsWide: TILE_UNITS_W, unitsTall: TILE_UNITS_H }
}

/**
 * Both shaft walls: base tone, ashlar, the deep chapel bays, and the lit corner.
 * Everything except the bays is a handful of draw calls.
 */
export function drawWalls(frame: Frame, texture: StoneTexture, atlas: BayAtlas): void {
  const leftEdge = sx(frame, 0)
  const rightEdge = sx(frame, SHAFT_WIDTH)

  // `outward` is the direction from the shaft into the wall, so both walls are
  // drawn by the same code and both are lit on the corner they present to the
  // open water.
  drawWallFace(frame, texture, atlas, leftEdge, 0, -1)
  drawWallFace(frame, texture, atlas, rightEdge, frame.width, 1)

  // The two lit corners are the strongest line in the frame: they are the edge
  // the player is judging, so they are also the brightest thing that is not the
  // bell itself.
  const rimAlpha = 0.5 + frame.palette.daylight * 0.3
  drawCornerLight(frame, leftEdge, 1, rimAlpha)
  drawCornerLight(frame, rightEdge, -1, rimAlpha)
}

function drawWallFace(
  frame: Frame,
  texture: StoneTexture,
  atlas: BayAtlas,
  /** Where the wall meets the shaft. */
  edgeX: number,
  /** Where the wall runs off the screen. */
  outerX: number,
  /** +1 when the wall extends to the right of the shaft. */
  outward: number,
): void {
  const { ctx, palette } = frame
  const x0 = Math.min(edgeX, outerX)
  const x1 = Math.max(edgeX, outerX)
  if (x1 - x0 < 1) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(x0, 0, x1 - x0, frame.height)
  ctx.clip()

  // Base tone: falls away from the shaft, because the only light is in the water.
  const gradient = ctx.createLinearGradient(edgeX, 0, outerX, 0)
  gradient.addColorStop(0, shade(palette.stone, 0.3))
  gradient.addColorStop(0.3, shade(palette.stone, -0.1))
  gradient.addColorStop(0.7, shade(palette.stone, -0.5))
  gradient.addColorStop(1, css(palette.stoneDark))
  ctx.fillStyle = gradient
  ctx.fillRect(x0, 0, x1 - x0, frame.height)

  // Ashlar. `overlay` keeps the tile's luminance and the ramp's hue.
  const tileW = texture.unitsWide * frame.scale
  const tileH = texture.unitsTall * frame.scale
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.72 - palette.depthFraction * 0.18
  const phase = ((frame.depth % texture.unitsTall) + texture.unitsTall) % texture.unitsTall
  const startY = -phase * frame.scale - tileH
  ctx.save()
  // Anchor the bond to the shaft edge and mirror the left wall, so the two
  // walls never read as the same texture twice.
  ctx.translate(edgeX, 0)
  ctx.scale(outward, 1)
  for (let ty = startY; ty < frame.height + tileH; ty += tileH) {
    for (let tx = 0; tx < x1 - x0 + tileW; tx += tileW) {
      ctx.drawImage(texture.canvas, tx, ty, tileW, tileH)
    }
  }
  ctx.restore()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1

  drawBays(frame, atlas, edgeX, outerX, outward)
  drawStringCourses(frame, edgeX, outerX)
  drawDepthMarks(frame, edgeX, outward)

  ctx.restore()
}

/**
 * The blind arcade: pointed bays cut into the wall.
 *
 * Sparse and irregular on purpose. A window in every slot turns the wall into
 * strip wallpaper and kills the sense of scrolling past a real building, so
 * roughly a third of the slots stay blank ashlar, the bays vary in height, and
 * glazed lights alternate with open chapels that are nothing but darkness and
 * one votive candle.
 */
function drawBays(frame: Frame, atlas: BayAtlas, edgeX: number, outerX: number, outward: number): void {
  const { ctx, palette } = frame
  const topDepth = depthAt(frame, -90)
  const bottomDepth = depthAt(frame, frame.height + 90)
  const first = Math.floor(topDepth / BAY_PITCH)
  const last = Math.ceil(bottomDepth / BAY_PITCH)
  const wallWidth = Math.abs(outerX - edgeX)
  if (wallWidth < 10) return

  // Lit from behind, so glass survives the depth ramp better than stone — but
  // it still dims, or the deep would stay colourful and lose its menace.
  const lit = 0.24 + palette.daylight * 0.34 + palette.candlelight * 0.08

  for (let i = first; i <= last; i++) {
    const seed = hash2(i, outward)
    if (seed < 0.34) continue

    const bayW = Math.min(wallWidth * 0.52, 13 * frame.scale)
    if (bayW < 5) return
    // Bays sit proud of the corner so the arch mouth is never behind it, and
    // wander a little across the wall so the arcade is not a ruled line.
    const inset = wallWidth * (0.16 + hash3(i, outward, 5) * 0.16)
    const nearX = edgeX + outward * inset
    const farX = nearX + outward * bayW
    const left = Math.min(nearX, farX)

    const centreDepth = i * BAY_PITCH + (outward > 0 ? 0 : BAY_PITCH * 0.55)
    const height = bayW * (2.5 + hash3(i, outward, 9) * 1.3)
    const springY = sy(frame, centreDepth) + height * 0.3
    const topY = springY - height
    if (springY < -40 || topY > frame.height + 40) continue

    const glazed = seed > 0.6
    const variants = glazed ? atlas.glass : atlas.chapels
    const variantIndex = Math.floor(hash2(i * 7, outward * 13) * variants.length) % variants.length
    const bake = variants[variantIndex]

    ctx.save()
    ctx.globalAlpha = glazed ? lit : 1
    if (bake) ctx.drawImage(bake, left, topY, bayW, height)
    ctx.restore()

    if (glazed) {
      drawWindowLight(frame, variantIndex, edgeX, nearX, springY, topY, bayW, outward, lit, i)
    } else {
      drawCandle(frame, left, bayW, springY, height, i, outward)
    }

    // The moulded arch surround: a dark reveal, then a lit roll on the side
    // facing the shaft.
    archPath(ctx, nearX, farX, springY, topY)
    ctx.lineWidth = Math.max(1.4, frame.scale * 0.9)
    ctx.strokeStyle = css(palette.stoneDark, 0.9)
    ctx.stroke()
    archPath(ctx, nearX - outward * 1.4, farX + outward * 1.4, springY, topY + height * 0.03)
    ctx.lineWidth = Math.max(1, frame.scale * 0.4)
    ctx.strokeStyle = shade(palette.stoneLit, -0.2, 0.4 + palette.daylight * 0.28)
    ctx.stroke()
  }
}

/** A two-centred lancet. Cheap quadratics, but the proportion is the real tell. */
function archPath(
  ctx: CanvasRenderingContext2D,
  x0: number, x1: number,
  baseY: number, topY: number,
): void {
  const springY = baseY - (baseY - topY) * 0.42
  const apexX = (x0 + x1) / 2
  ctx.beginPath()
  ctx.moveTo(x0, baseY)
  ctx.lineTo(x0, springY)
  ctx.quadraticCurveTo(x0, topY + (springY - topY) * 0.18, apexX, topY)
  ctx.quadraticCurveTo(x1, topY + (springY - topY) * 0.18, x1, springY)
  ctx.lineTo(x1, baseY)
  ctx.closePath()
}

/**
 * The shaft of light a glazed bay throws across the water.
 *
 * This is the single thing that makes the descent feel *lit* rather than
 * painted: the windows stop being decoration on a wall and become the light
 * source for the space the player is falling through. It leans slightly
 * downward because the sun is above and outside, and it breathes, because still
 * light in moving water reads as a solid object.
 */
function drawWindowLight(
  frame: Frame,
  hueIndex: number,
  edgeX: number,
  nearX: number,
  springY: number,
  topY: number,
  bayW: number,
  outward: number,
  lit: number,
  index: number,
): void {
  const strength = (0.35 + lit) * (0.3 + frame.palette.daylight * 0.7)
  if (strength < 0.05) return

  const hue = GLASS_HUES[hueIndex % GLASS_HUES.length] ?? (GLASS_HUES[0] as Rgb)
  const glow = frame.glow
  const into = -outward
  const height = springY - topY
  const breathe = 0.7 + 0.3 * Math.sin(frame.view.time * 0.55 + index * 1.9)
  const reach = frame.scale * 26

  // The light leaves the mouth of the bay, not the glass behind it, or it would
  // appear to pass through the wall it is set into. It leaves as a narrow slit
  // and opens out, and it falls steeply, because the sun is above and outside.
  const mouthCentre = springY - height * 0.44
  const mouthHalf = height * 0.15
  const farHalf = mouthHalf * 3.4
  const drop = reach * 0.8
  const farX = edgeX + into * reach

  glow.save()
  glow.globalCompositeOperation = 'lighter'
  glow.beginPath()
  glow.moveTo(nearX, mouthCentre - mouthHalf)
  glow.lineTo(nearX, mouthCentre + mouthHalf)
  glow.lineTo(farX, mouthCentre + drop + farHalf)
  glow.lineTo(farX, mouthCentre + drop - farHalf)
  glow.closePath()
  glow.clip()

  // Radial rather than linear falloff, and tuned to reach zero *before* the
  // clip boundary: the beam then dissolves at its far end instead of stopping,
  // which is the difference between light and a polygon.
  const fade = glow.createRadialGradient(edgeX, mouthCentre, 0, edgeX, mouthCentre, reach * 0.92)
  fade.addColorStop(0, css(hue, 0.38 * strength * breathe))
  fade.addColorStop(0.25, css(hue, 0.13 * strength * breathe))
  fade.addColorStop(1, css(hue, 0))
  glow.fillStyle = fade
  glow.fillRect(
    Math.min(edgeX, farX) - bayW, mouthCentre - reach,
    reach + bayW * 2, reach * 2.4,
  )
  glow.restore()
}

/**
 * The votive candle in an open chapel.
 *
 * Below 260 m these are the only warm light in the game, and the only thing
 * that still moves in the walls — so they are worth the one gradient a frame
 * that keeping them out of the baked atlas costs.
 */
function drawCandle(
  frame: Frame,
  left: number, width: number,
  baseY: number, height: number,
  index: number, outward: number,
): void {
  const strength = frame.palette.candlelight
  if (strength <= 0.02) return

  const flicker = 0.7 + Math.sin(frame.view.time * 7 + index) * 0.16
    + Math.sin(frame.view.time * 23.7 + index * 3) * 0.1
  const cx = left + width * (0.34 + hash2(index, outward) * 0.32)
  const cy = baseY - height * 0.14
  const glow = frame.glow

  glow.save()
  glow.globalCompositeOperation = 'lighter'
  const halo = glow.createRadialGradient(cx, cy, 0, cx, cy, width * 1.35)
  halo.addColorStop(0, css(EMBER, 0.6 * strength * flicker))
  halo.addColorStop(0.35, css(EMBER, 0.16 * strength * flicker))
  halo.addColorStop(1, css(EMBER, 0))
  glow.fillStyle = halo
  glow.fillRect(cx - width * 1.4, cy - width * 1.4, width * 2.8, width * 2.8)
  glow.fillStyle = css([255, 240, 214], 0.9 * strength * flicker)
  glow.beginPath()
  glow.ellipse(cx, cy, frame.scale * 0.4, frame.scale * 0.9, 0, 0, Math.PI * 2)
  glow.fill()
  glow.restore()
}

/** Bands every twenty metres. The only thing telling you the wall is scrolling. */
function drawStringCourses(frame: Frame, edgeX: number, outerX: number): void {
  const { ctx, palette } = frame
  const spacing = 20
  const first = Math.floor(depthAt(frame, -10) / spacing) * spacing
  const bottom = depthAt(frame, frame.height + 10)
  const x0 = Math.min(edgeX, outerX)
  const w = Math.abs(outerX - edgeX)
  const thickness = Math.max(1.2, frame.scale * 0.55)

  for (let d = first; d < bottom; d += spacing) {
    const y = sy(frame, d)
    ctx.fillStyle = shade(palette.stoneLit, -0.2, 0.28 + palette.daylight * 0.2)
    ctx.fillRect(x0, y, w, thickness)
    ctx.fillStyle = css(palette.stoneDark, 0.5)
    ctx.fillRect(x0, y + thickness, w, thickness * 0.8)
  }
}

/** Depth carved into the stone every hundred metres, so the HUD has an echo. */
function drawDepthMarks(frame: Frame, edgeX: number, outward: number): void {
  const { ctx, palette } = frame
  const first = Math.floor(depthAt(frame, -20) / 100) * 100
  const bottom = depthAt(frame, frame.height + 20)
  const size = Math.max(9, frame.scale * 3.2)

  ctx.save()
  ctx.font = `600 ${size}px Orbitron, ui-monospace, monospace`
  ctx.textAlign = outward > 0 ? 'left' : 'right'
  ctx.textBaseline = 'middle'
  for (let d = first; d < bottom; d += 100) {
    if (d <= 0) continue
    const y = sy(frame, d) - size * 1.1
    const x = edgeX + outward * (frame.scale * 2.4)
    ctx.fillStyle = css(palette.stoneDark, 0.8)
    ctx.fillText(`${d}`, x + 1, y + 1.5)
    ctx.fillStyle = shade(palette.stoneLit, -0.1, 0.34 + palette.daylight * 0.24)
    ctx.fillText(`${d}`, x, y)
  }
  ctx.restore()
}

/** The lit corner where wall meets water, plus the shadow it throws inward. */
function drawCornerLight(frame: Frame, edgeX: number, facing: number, alpha: number): void {
  const { ctx, palette } = frame
  const reach = frame.scale * 9

  // Light bleeding off the stone into the water.
  const bleed = ctx.createLinearGradient(edgeX, 0, edgeX + facing * reach, 0)
  bleed.addColorStop(0, css(palette.rim, 0.16 * alpha))
  bleed.addColorStop(1, css(palette.rim, 0))
  ctx.fillStyle = bleed
  ctx.fillRect(Math.min(edgeX, edgeX + facing * reach), 0, reach, frame.height)

  // The arris itself.
  const width = Math.max(1.2, frame.scale * 0.4)
  ctx.fillStyle = css(palette.rim, 0.55 * alpha)
  ctx.fillRect(edgeX - (facing > 0 ? width : 0), 0, width, frame.height)

  const glow = frame.glow
  glow.save()
  glow.globalCompositeOperation = 'lighter'
  glow.fillStyle = css(palette.rim, 0.3 * alpha)
  glow.fillRect(edgeX - width, 0, width * 2, frame.height)
  glow.restore()
}

/**
 * A tooth: the corbels the shaft is a slalom between.
 *
 * The silhouette is plotted straight from `reachAt`, which is also what
 * collision reads — so the shoulder the eye judges is the shoulder the
 * simulation uses, and threading one close is a real skill rather than a
 * cosmetic near-miss. Decoration is allowed to overhang, because that can only
 * make a survivable gap look tighter than it is.
 */
export function drawTooth(frame: Frame, obstacle: Obstacle, earning: number): void {
  const { ctx, palette } = frame
  const facing = obstacle.side === 'left' ? 1 : -1
  const rootX = obstacle.side === 'left' ? sx(frame, 0) : sx(frame, SHAFT_WIDTH)
  const y = sy(frame, obstacle.depth)
  const half = obstacle.height * frame.scale
  if (y + half * 2.2 < -40 || y - half * 2.2 > frame.height + 40) return

  const seed = hash2(Math.round(obstacle.depth * 10), facing)
  const tipX = rootX + facing * obstacle.reach * frame.scale
  const steps = 18

  const contour = (grow: number) => {
    ctx.beginPath()
    ctx.moveTo(rootX, y - half - grow)
    for (let i = 0; i <= steps; i++) {
      const t = -1 + (2 * i) / steps
      const d = obstacle.depth + t * obstacle.height
      const reach = reachAt(obstacle, d) * frame.scale
      ctx.lineTo(rootX + facing * (reach + (reach > 0 ? grow : 0)), y + t * half)
    }
    ctx.lineTo(rootX, y + half + grow)
    ctx.closePath()
  }

  // Contact shadow down the wall: the corbel sits *on* the masonry, and the
  // water below it is in shade.
  ctx.save()
  ctx.translate(facing * frame.scale * 1.1, frame.scale * 2.6)
  contour(frame.scale * 0.7)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fill()
  ctx.restore()

  // The water directly beneath is shaded too, which is what grounds the corbel
  // in the shaft instead of leaving it pasted on top of the water.
  const underShade = ctx.createLinearGradient(0, y + half * 0.2, 0, y + half * 2.2)
  underShade.addColorStop(0, 'rgba(0,0,0,0.3)')
  underShade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(rootX, y)
  ctx.lineTo(tipX, y)
  ctx.lineTo(tipX + facing * half * 0.4, y + half * 2.2)
  ctx.lineTo(rootX, y + half * 2.2)
  ctx.closePath()
  ctx.fillStyle = underShade
  ctx.fill()
  ctx.restore()

  // --- The body ---------------------------------------------------------------
  // Masonry reads as a dark silhouette against luminous water, lit only along
  // the faces it turns to the light. That is what keeps it legible in greyscale
  // at 1200 m, where hue has left the frame entirely.
  contour(0)
  const body = ctx.createLinearGradient(0, y - half, 0, y + half)
  body.addColorStop(0, shade(palette.stoneLit, -0.42))
  body.addColorStop(0.09, shade(palette.stone, 0.12))
  body.addColorStop(0.4, shade(palette.stone, -0.4))
  body.addColorStop(1, shade(palette.stoneDark, -0.2))
  ctx.fillStyle = body
  ctx.fill()

  ctx.save()
  ctx.clip()

  // The end catches light from the open shaft — the brightest stone in the
  // frame, and the exact edge the player is judging.
  const endWidth = Math.max(half * 1.1, frame.scale * 6)
  const endLight = ctx.createLinearGradient(tipX - facing * endWidth, 0, tipX, 0)
  endLight.addColorStop(0, css(palette.stone, 0))
  endLight.addColorStop(1, shade(palette.stoneLit, -0.3, 0.9))
  ctx.fillStyle = endLight
  ctx.fillRect(Math.min(tipX, tipX - facing * endWidth), y - half, endWidth, half * 2)

  // Ashlar carried across the corbel, so it is cut from the same wall. Light
  // joints, not dark ones: on a body this close to black, a dark line vanishes.
  ctx.strokeStyle = shade(palette.stoneLit, -0.3, 0.16)
  ctx.lineWidth = 1
  ctx.beginPath()
  const courseTop = Math.floor((obstacle.depth - obstacle.height) / COURSE) * COURSE
  for (let d = courseTop; d < obstacle.depth + obstacle.height; d += COURSE) {
    const cy = sy(frame, d)
    ctx.moveTo(rootX, cy)
    ctx.lineTo(tipX, cy)
  }
  ctx.stroke()

  // Blind tracery incised into the face. Surface relief only.
  const panelW = Math.abs(tipX - rootX) * 0.4
  const panelH = half * 1.05
  const panelNear = rootX + facing * Math.abs(tipX - rootX) * 0.26
  ctx.strokeStyle = shade(palette.stoneLit, -0.4, 0.22)
  ctx.lineWidth = Math.max(1, frame.scale * 0.26)
  for (let i = 0; i < 2; i++) {
    const a = panelNear + facing * (panelW / 2) * i
    const b = a + facing * (panelW / 2)
    archPath(ctx, Math.min(a, b) + 1, Math.max(a, b) - 1, y + panelH * 0.5, y - panelH * 0.5)
    ctx.stroke()
  }
  ctx.restore()

  // --- The lit upper contour, and its crockets --------------------------------
  ctx.beginPath()
  for (let i = 0; i <= steps / 2; i++) {
    const t = -1 + (2 * i) / steps
    const reach = reachAt(obstacle, obstacle.depth + t * obstacle.height) * frame.scale
    const px = rootX + facing * reach
    const py = y + t * half
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.strokeStyle = css(palette.rim, 0.42 + palette.daylight * 0.32 + earning * 0.3)
  ctx.lineWidth = Math.max(1.4, frame.scale * 0.42)
  ctx.lineJoin = 'round'
  ctx.stroke()

  const crockets = 3 + Math.floor(seed * 3)
  for (let i = 0; i < crockets; i++) {
    const t = -0.92 + (i / crockets) * 0.86
    const d = obstacle.depth + t * obstacle.height
    const reach = reachAt(obstacle, d) * frame.scale
    if (reach < frame.scale * 3) continue
    const px = rootX + facing * reach
    const py = y + t * half
    const size = half * (0.24 + hash3(i, Math.round(obstacle.depth), 1) * 0.14)

    // A curled leaf hook growing off the sweep. It overhangs the collision
    // profile, which is the safe direction.
    ctx.beginPath()
    ctx.moveTo(px, py + size * 0.45)
    ctx.quadraticCurveTo(px + facing * size * 1.15, py - size * 0.1, px + facing * size * 0.55, py - size * 0.85)
    ctx.quadraticCurveTo(px + facing * size * 0.1, py - size * 0.4, px, py - size * 0.3)
    ctx.closePath()
    ctx.fillStyle = shade(palette.stone, -0.06)
    ctx.fill()
    ctx.strokeStyle = shade(palette.stoneLit, -0.3, 0.65)
    ctx.lineWidth = Math.max(0.7, frame.scale * 0.18)
    ctx.stroke()
  }

  // --- The moulded terminal ----------------------------------------------------
  // A chamfered end with one bright arris. A carved face at this size collapses
  // into two dots and a snout; a moulding stays unmistakably architectural down
  // to a handful of pixels, and the arris is the exact column being timed.
  const chamfer = Math.max(2, half * 0.3)
  ctx.save()
  contour(0)
  ctx.clip()
  const endBand = ctx.createLinearGradient(tipX - facing * chamfer * 2.4, 0, tipX, 0)
  endBand.addColorStop(0, css(palette.stoneDark, 0))
  endBand.addColorStop(0.55, shade(palette.stone, -0.42, 0.75))
  endBand.addColorStop(0.75, shade(palette.stoneLit, -0.34, 0.9))
  endBand.addColorStop(1, shade(palette.stoneLit, -0.6, 0.95))
  ctx.fillStyle = endBand
  ctx.fillRect(Math.min(tipX, tipX - facing * chamfer * 2.4), y - half, chamfer * 2.4, half * 2)
  ctx.restore()

  ctx.fillStyle = css(palette.rim, 0.5 + palette.daylight * 0.28 + earning * 0.42)
  ctx.fillRect(
    facing > 0 ? tipX - Math.max(1, frame.scale * 0.42) : tipX,
    y - half * SHOULDER_ABOVE * 1.1, Math.max(1, frame.scale * 0.42),
    half * (SHOULDER_ABOVE + SHOULDER_BELOW) * 1.1,
  )

  if (earning > 0.02) {
    // While the player is earning, the stone they are riding lights up. This is
    // the entire wall-riding tutorial: no words, just the masonry catching fire.
    // Radial, not a gradient-filled box — a rectangle of light has corners, and
    // the eye finds them instantly.
    const glow = frame.glow
    glow.save()
    glow.globalCompositeOperation = 'lighter'
    const heat = frame.view.heat
    const hot: Rgb = [255, 214 - heat * 54, 152 - heat * 78]
    const spread = half * 2.6
    const halo = glow.createRadialGradient(tipX, y, 0, tipX, y, spread)
    halo.addColorStop(0, css(hot, 0.42 * earning))
    halo.addColorStop(0.35, css(hot, 0.12 * earning))
    halo.addColorStop(1, css(hot, 0))
    glow.fillStyle = halo
    glow.fillRect(tipX - spread, y - spread, spread * 2, spread * 2)

    // The lit contour flares too, so the cue is attached to the whole edge
    // being ridden rather than to one point on it.
    glow.beginPath()
    for (let i = 0; i <= steps; i++) {
      const t = -1 + (2 * i) / steps
      const reach = reachAt(obstacle, obstacle.depth + t * obstacle.height) * frame.scale
      const px = rootX + facing * reach
      const py = y + t * half
      if (i === 0) glow.moveTo(px, py)
      else glow.lineTo(px, py)
    }
    glow.strokeStyle = css(hot, 0.5 * earning)
    glow.lineWidth = Math.max(1, frame.scale * 0.5)
    glow.lineJoin = 'round'
    glow.stroke()
    glow.restore()
  }
}

/**
 * A fallen bell hanging in a wall recess every 500 m.
 *
 * Landmarks are what turn a depth into a place, but they must never be mistaken
 * for stone that can kill you — so they hang in the wall plane, well outside
 * the channel, and are washed toward the fog colour so they read as behind
 * everything else rather than in the water with the player.
 */
export function drawBells(frame: Frame): void {
  const { ctx, palette } = frame
  const spacing = 500
  const first = Math.floor(depthAt(frame, -140) / spacing) * spacing
  const bottom = depthAt(frame, frame.height + 140)
  const leftEdge = sx(frame, 0)
  const rightEdge = sx(frame, SHAFT_WIDTH)

  for (let d = first; d < bottom; d += spacing) {
    if (d <= 0) continue
    const onLeft = hash2(d, 3) > 0.5
    const wallWidth = onLeft ? leftEdge : frame.width - rightEdge
    const r = Math.min(frame.scale * 6, wallWidth * 0.34)
    if (r < 3) continue
    const x = onLeft ? leftEdge - wallWidth * 0.5 : rightEdge + wallWidth * 0.5
    const y = sy(frame, d)
    const sway = Math.sin(frame.view.time * 0.5 + d) * 0.05

    ctx.save()
    ctx.translate(x, y - r * 2.4)
    ctx.rotate(sway)

    ctx.strokeStyle = css(palette.stoneDark, 0.9)
    ctx.lineWidth = Math.max(1, frame.scale * 0.28)
    ctx.beginPath()
    ctx.moveTo(0, -r * 2.4)
    ctx.lineTo(0, 0)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(-r * 0.28, 0)
    ctx.bezierCurveTo(-r * 0.36, r * 0.8, -r, r * 1.1, -r, r * 1.7)
    ctx.lineTo(r, r * 1.7)
    ctx.bezierCurveTo(r, r * 1.1, r * 0.36, r * 0.8, r * 0.28, 0)
    ctx.closePath()
    const bronze = ctx.createLinearGradient(-r, 0, r, r * 1.7)
    bronze.addColorStop(0, shade(palette.stoneLit, -0.5, 0.95))
    bronze.addColorStop(0.45, css(palette.stoneDark, 0.98))
    bronze.addColorStop(1, css(palette.stoneDark))
    ctx.fillStyle = bronze
    ctx.fill()
    ctx.strokeStyle = shade(palette.stoneLit, -0.35, 0.45)
    ctx.lineWidth = Math.max(1, frame.scale * 0.2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, r * 1.7, r, r * 0.22, 0, 0, Math.PI * 2)
    ctx.fillStyle = css(palette.stoneDark)
    ctx.fill()
    ctx.restore()
  }
}

/** Total shaft-unit reach of every tooth level with a depth, used for shadowing. */
export function toothCover(obstacles: readonly Obstacle[], depth: number): number {
  let cover = 0
  for (const obstacle of obstacles) {
    if (Math.abs(obstacle.depth - depth) > obstacle.height) continue
    cover = Math.max(cover, obstacle.reach)
  }
  return clamp(cover / SHAFT_WIDTH, 0, 1)
}
