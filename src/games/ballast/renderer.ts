import { clamp } from '../../lib/math.ts'
import { createRng } from '../../lib/prng.ts'
import { renderParticles, type Juice } from '../../lib/juice.ts'
import {
  PROXIMITY_BAND,
  SHAFT_WIDTH,
  distanceToStone,
  visibleObstacles,
  type BallastState,
} from './simulation.ts'
import { createPalette, samplePalette, css } from './art/palette.ts'
import { createBloom, type Bloom } from '../../lib/bloom.ts'
import { createStoneTexture, createBayAtlas, drawBells, drawTooth, drawWalls, type BayAtlas, type StoneTexture } from './art/cathedral.ts'
import {
  createGrain,
  drawCaustics,
  drawDepthHaze,
  drawDrift,
  drawGodRays,
  drawGrain,
  drawSparks,
  drawSurface,
  drawToll,
  drawVignette,
  paintWater,
  type GrainTexture,
} from './art/atmosphere.ts'
import { drawPlayer, drawTension, drawWake } from './art/player.ts'
import type { BallastView } from './art/view.ts'
import type { Frame } from './art/frame.ts'

/**
 * BALLAST renderer.
 *
 * Framing first, because it is a gameplay decision before it is an art one.
 * **Read-ahead is fixed in metres**, not in pixels: a phone and a desktop see
 * the same distance down the shaft, because a score is only comparable if
 * everyone gets the same warning. The shaft is then whatever width that scale
 * makes it, capped so it can never overflow a 360 px phone — the masonry is the
 * thing being judged, and a shaft wider than the viewport hides the only edge
 * that matters. On a wide screen the surplus goes to wall, which is what being
 * inside a cathedral should look like.
 */

/** Metres of shaft visible from the top of the viewport to the bottom. */
const VIEW_METRES = 250
/** The shaft may never take more of the width than this. */
const MAX_SHAFT_FRACTION = 0.78
/** The bell sits high in the frame, so most of the screen is what comes next. */
const PLAYER_SCREEN_FRACTION = 0.34

interface Resources {
  stone: StoneTexture
  bays: BayAtlas
  grain: GrainTexture
  bloom: Bloom
  width: number
  height: number
}

let resources: Resources | undefined

function getResources(width: number, height: number): Resources {
  if (!resources) {
    // The ashlar, the windows and the particulate are the same in every
    // descent; only the architecture the generator lays out changes.
    const rng = createRng(0x8a11a57)
    resources = {
      stone: createStoneTexture(rng),
      bays: createBayAtlas(rng),
      grain: createGrain(rng),
      bloom: createBloom(width, height),
      width,
      height,
    }
  }
  if (resources.width !== width || resources.height !== height) {
    resources.bloom.resize(width, height)
    resources.width = width
    resources.height = height
  }
  return resources
}

const palette = createPalette()
const frame: Frame = {
  ctx: undefined as unknown as CanvasRenderingContext2D,
  glow: undefined as unknown as CanvasRenderingContext2D,
  width: 0,
  height: 0,
  scale: 1,
  originX: 0,
  anchorY: 0,
  depth: 0,
  palette,
  view: undefined as unknown as BallastView,
  quality: 1,
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: BallastState,
  juice: Juice,
  view: BallastView,
  width: number,
  height: number,
): void {
  const { stone, bays, grain, bloom } = getResources(width, height)

  const scale = Math.min(
    height / VIEW_METRES,
    (width * MAX_SHAFT_FRACTION) / SHAFT_WIDTH,
  )

  samplePalette(palette, state.depth)
  frame.ctx = ctx
  frame.glow = bloom.ctx
  frame.width = width
  frame.height = height
  frame.scale = scale
  frame.originX = (width - SHAFT_WIDTH * scale) / 2 + juice.shakeX
  frame.anchorY = height * PLAYER_SCREEN_FRACTION + juice.shakeY
  frame.depth = state.depth
  frame.view = view

  bloom.begin()

  // --- Water and the light still reaching it ---------------------------------
  paintWater(frame)
  drawGodRays(frame)
  drawSurface(frame)

  // --- The cathedral ---------------------------------------------------------
  drawWalls(frame, stone, bays)
  drawCaustics(frame)
  drawBells(frame)

  const distance = distanceToStone(state)
  for (const obstacle of visibleObstacles(state, 340, 170)) {
    // A tooth lights up only if it is the stone the player is actually earning
    // against, so the cue points at the specific risk being taken.
    const level = Math.abs(obstacle.depth - state.depth) < obstacle.height * 2.4
    const riding = obstacle.side === (state.x < SHAFT_WIDTH / 2 ? 'left' : 'right')
    drawTooth(frame, obstacle, level && riding ? view.earn : 0)
  }

  // --- Everything suspended in the water -------------------------------------
  drawDrift(frame)
  drawDepthHaze(frame)

  // --- The bell --------------------------------------------------------------
  drawWake(frame)
  if (state.alive) {
    drawTension(frame, state, Math.max(0, distance))
    drawPlayer(frame, state)
  }
  drawSparks(frame)
  drawToll(frame)
  renderParticles(ctx, juice.particles)

  // --- Post ------------------------------------------------------------------
  bloom.composite(ctx, width, height, 1)
  drawEarningBands(frame, state, Math.max(0, distance))
  drawVignette(frame)
  drawGrain(frame, grain)

  if (!state.alive) drawEpitaph(frame, view)
}

/**
 * The earning ribbon, drawn *after* the bloom so it never blows out.
 *
 * A soft warm wash on the wall being ridden, keyed to how much the multiplier
 * is climbing. It is the answer to "am I earning right now" at a glance, in
 * peripheral vision, without a number.
 */
function drawEarningBands(frame: Frame, state: BallastState, distance: number): void {
  const earn = frame.view.earn
  if (earn < 0.03 || !state.alive) return

  const { ctx } = frame
  const towardLeft = state.x < SHAFT_WIDTH / 2
  const edge = towardLeft
    ? frame.originX + (state.x - distance) * frame.scale
    : frame.originX + (state.x + distance) * frame.scale
  const reach = PROXIMITY_BAND * frame.scale
  const far = towardLeft ? edge + reach : edge - reach

  const gradient = ctx.createLinearGradient(edge, 0, far, 0)
  gradient.addColorStop(0, `rgba(255,205,130,${0.2 * earn})`)
  gradient.addColorStop(1, 'rgba(255,205,130,0)')
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = gradient
  ctx.fillRect(Math.min(edge, far), 0, reach, frame.height)
  ctx.restore()
}

/** The water goes still, the colour drains, and the depth is left on screen. */
function drawEpitaph(frame: Frame, view: BallastView): void {
  const since = view.time - view.deathTime
  const t = clamp(since / 1.1, 0, 1)
  const { ctx } = frame

  ctx.save()
  ctx.fillStyle = `rgba(2,6,10,${t * 0.55})`
  ctx.fillRect(0, 0, frame.width, frame.height)
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = css(frame.palette.rim, (1 - t) * 0.16)
  ctx.fillRect(0, 0, frame.width, frame.height)
  ctx.restore()
}
