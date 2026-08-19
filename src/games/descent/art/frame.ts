import type { CavernPalette } from './palette.ts'
import type { DescentView } from './view.ts'

/**
 * Per-frame drawing context.
 *
 * DESCENT draws three passes into three canvases that must all share the same
 * world transform: the **scene** (fully lit colour), the **light map**
 * (multiplied over the scene, so anything it misses falls to ambient) and the
 * **glow** layer (blurred and added back as bloom). Keeping the transform in
 * one place is what stops a light drifting away from the thing casting it.
 */
export interface DescentFrame {
  ctx: CanvasRenderingContext2D
  light: CanvasRenderingContext2D
  glow: CanvasRenderingContext2D
  width: number
  height: number
  /** Screen pixels per world unit. */
  scale: number
  palette: CavernPalette
  view: DescentView
  /** World position of the drone's lamp, for distance-based edge lighting. */
  lightX: number
  lightY: number
  /** World-space rectangle currently on screen, for culling. */
  viewLeft: number
  viewRight: number
  viewTop: number
  viewBottom: number
}

export interface WorldCamera {
  /** Screen position the world is anchored to. */
  screenX: number
  screenY: number
  angle: number
  scale: number
  worldX: number
  worldY: number
}

/** Apply the world transform to one context. Multiplies, never replaces. */
export function pushWorld(ctx: CanvasRenderingContext2D, camera: WorldCamera): void {
  ctx.save()
  ctx.translate(camera.screenX, camera.screenY)
  ctx.rotate(camera.angle)
  ctx.scale(camera.scale, camera.scale)
  ctx.translate(-camera.worldX, -camera.worldY)
}

export function popWorld(ctx: CanvasRenderingContext2D): void {
  ctx.restore()
}

/** Run `draw` inside the world transform on all three passes' contexts. */
export function inWorld(frame: DescentFrame, camera: WorldCamera, draw: () => void): void {
  pushWorld(frame.ctx, camera)
  pushWorld(frame.light, camera)
  pushWorld(frame.glow, camera)
  draw()
  popWorld(frame.glow)
  popWorld(frame.light)
  popWorld(frame.ctx)
}
