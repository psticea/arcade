import { renderParticles, type Juice } from '../../lib/juice.ts'
import { createBloom, type Bloom } from '../../lib/bloom.ts'
import { createLightMap, type LightMap } from '../../lib/lighting.ts'
import { css } from '../../lib/colour.ts'
import { normaliseAngle, type DescentState } from './simulation.ts'
import { createCavernPalette, sampleCavernPalette } from './art/palette.ts'
import { createCavernArt, drawAirborneDust, drawCavern, drawParallax, type CavernArt } from './art/cavern.ts'
import { drawPads } from './art/pads.ts'
import { drawLander } from './art/lander.ts'
import {
  drawDust,
  drawGravityArc,
  drawHaze,
  drawImpact,
  drawPadMarkers,
  drawVignette,
} from './art/atmosphere.ts'
import { inWorld, type DescentFrame, type WorldCamera } from './art/frame.ts'
import type { DescentView } from './art/view.ts'

export { createView, updateView, updateCamera, type Camera, type DescentView } from './art/view.ts'

/**
 * DESCENT renderer.
 *
 * Three passes, composited in order:
 *
 * 1. **Scene** — the cave painted as if fully lit.
 * 2. **Light** — every lamp, beacon and seam accumulated from an ambient floor,
 *    then *multiplied* over the scene. This is what makes the cave dark: not a
 *    dark palette, but an absence of light, so the drone's own lamp is the
 *    reason anything is visible and where it points is a real decision.
 * 3. **Bloom** — emissive elements blurred and added back on top.
 *
 * All three share one world transform so a light never drifts off the thing
 * casting it.
 */

/** The drone sits above centre so there is more cave below it than above. */
const ANCHOR_Y = 0.42

interface Resources {
  bloom: Bloom
  light: LightMap
  cavern: CavernArt
  width: number
  height: number
}

let resources: Resources | undefined

function getResources(width: number, height: number): Resources {
  if (!resources) {
    resources = {
      bloom: createBloom(width, height),
      light: createLightMap(width, height),
      cavern: createCavernArt(),
      width,
      height,
    }
  }
  if (resources.width !== width || resources.height !== height) {
    resources.bloom.resize(width, height)
    resources.light.resize(width, height)
    resources.width = width
    resources.height = height
  }
  return resources
}

const palette = createCavernPalette()
const camera: WorldCamera = {
  screenX: 0, screenY: 0, angle: 0, scale: 1, worldX: 0, worldY: 0,
}
const frame: DescentFrame = {
  ctx: undefined as unknown as CanvasRenderingContext2D,
  light: undefined as unknown as CanvasRenderingContext2D,
  glow: undefined as unknown as CanvasRenderingContext2D,
  width: 0,
  height: 0,
  scale: 1,
  palette,
  view: undefined as unknown as DescentView,
  lightX: 0,
  lightY: 0,
  viewLeft: 0,
  viewRight: 0,
  viewTop: 0,
  viewBottom: 0,
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: DescentState,
  view: DescentView,
  juice: Juice,
  width: number,
  height: number,
  hardBurn: boolean,
): void {
  const { bloom, light, cavern } = getResources(width, height)
  const shot = view.camera

  sampleCavernPalette(palette, state.cavern)
  bloom.begin()
  light.begin(css(palette.ambient))

  const scale = height / shot.view
  camera.screenX = width / 2 + juice.shakeX
  camera.screenY = height * ANCHOR_Y + juice.shakeY
  camera.angle = shot.angle
  camera.scale = scale
  camera.worldX = shot.x
  camera.worldY = shot.y

  frame.ctx = ctx
  frame.light = light.ctx
  frame.glow = bloom.ctx
  frame.width = width
  frame.height = height
  frame.scale = scale
  frame.view = view
  frame.lightX = state.ship.x
  frame.lightY = state.ship.y

  // A rolled camera means the visible world rectangle is the *bounding box* of
  // a rotated viewport, not the viewport. Getting this wrong pops terrain in
  // and out at the corners whenever the drone banks.
  const cos = Math.abs(Math.cos(shot.angle))
  const sin = Math.abs(Math.sin(shot.angle))
  const halfW = (width * cos + height * sin) / (2 * scale)
  const halfH = (height * cos + width * sin) / (2 * scale)
  frame.viewLeft = shot.x - halfW
  frame.viewRight = shot.x + halfW
  frame.viewTop = shot.y - halfH
  frame.viewBottom = shot.y + halfH

  ctx.fillStyle = css(palette.rockDark)
  ctx.fillRect(0, 0, width, height)

  inWorld(frame, camera, () => {
    drawParallax(frame, cavern, state.terrain)
    drawCavern(frame, state.terrain)
    drawAirborneDust(frame)
    drawPads(frame, state)
    drawDust(frame)
    drawLander(frame, state, hardBurn)
    renderParticles(ctx, juice.particles)
  })

  light.composite(ctx, width, height)
  // Haze goes on *after* the light pass: it is scattering between the camera
  // and the rock, so multiplying it by the lamp would darken the very thing
  // that is meant to lift the far distance out of black.
  drawHaze(frame)  bloom.composite(ctx, width, height, 1)

  drawVignette(frame)
  drawPadMarkers(frame, state, shot)
  drawGravityArc(frame, shot)
  drawImpact(frame, state)
}

export function tiltDegrees(state: DescentState): number {
  return Math.abs(normaliseAngle(state.ship.angle)) * (180 / Math.PI)
}
