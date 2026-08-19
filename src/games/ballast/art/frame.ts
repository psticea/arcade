import type { Palette } from './palette.ts'
import type { BallastView } from './view.ts'

/**
 * Per-frame projection and lighting context.
 *
 * Shared by every art module so none of them needs to know how the camera is
 * set up. One object is allocated per frame and reused for the whole frame; the
 * helpers below are plain functions rather than closures so nothing allocates
 * inside a draw loop.
 */
export interface Frame {
  ctx: CanvasRenderingContext2D
  /** Emissive layer. Anything drawn here is blurred and added back as bloom. */
  glow: CanvasRenderingContext2D
  width: number
  height: number
  /** Screen pixels per shaft unit. */
  scale: number
  /** Screen x of shaft coordinate 0. */
  originX: number
  /** Screen y of the player, and therefore of the camera's anchor depth. */
  anchorY: number
  /** Camera depth in metres — the player's depth. */
  depth: number
  palette: Palette
  view: BallastView
  /** Reduced-motion and low-power builds dial this down. */
  quality: number
}

/** Shaft units → screen x. */
export function sx(frame: Frame, x: number): number {
  return frame.originX + x * frame.scale
}

/** Metres of depth → screen y. */
export function sy(frame: Frame, depth: number): number {
  return frame.anchorY + (depth - frame.depth) * frame.scale
}

/** Screen y → metres of depth, for seeding world features from screen bounds. */
export function depthAt(frame: Frame, y: number): number {
  return frame.depth + (y - frame.anchorY) / frame.scale
}
