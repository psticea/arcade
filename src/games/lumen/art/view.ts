import { LAMPS } from '../simulation.ts'

/**
 * The camera.
 *
 * The caldera is drawn as a tilted bowl rather than a flat top-down ring. That
 * costs a squash and a vertical offset and buys three things a plan view cannot
 * have: a sky to put the aurora in, lamps that stand up as silhouettes with
 * light pooling at their feet, and a real sense that the Deep is *below* you
 * rather than merely in the middle.
 *
 * Screen space is centred on the caldera, so every helper returns coordinates
 * relative to that centre and the renderer translates once.
 */

export const TAU = Math.PI * 2

/** How far the ellipse is squashed vertically. 1 would be a plan view. */
const SQUASH = 0.58
/** How far the floor of the bowl sits below the rim, as a fraction of radius. */
const BOWL = 0.34

export interface View {
  width: number
  height: number
  cx: number
  cy: number
  /** Radius of the rim ellipse before squashing. */
  rim: number
  /** Radius of the mouth of the Deep. */
  deep: number
  squash: number
  /** Vertical drop from rim to floor, in pixels. */
  bowl: number
  /** Horizon line, in screen pixels. Everything above it is sky. */
  horizon: number
  /** Scales strokes and props with the screen, so a phone is not hairline-thin. */
  unit: number
}

export function layout(width: number, height: number): View {
  const rim = Math.min(width * 0.48, height * 0.4)
  // Pushed below centre: the sky above it carries the aurora and the passage of
  // the night, and a bowl centred in the frame leaves it nothing to breathe in.
  const cy = height * 0.56
  return {
    width,
    height,
    cx: width / 2,
    cy,
    rim,
    deep: rim * 0.2,
    squash: SQUASH,
    bowl: rim * BOWL,
    horizon: cy - rim * SQUASH - rim * 0.24,
    unit: Math.max(0.85, rim / 175),
  }
}

/** Rim position (0..LAMPS) to an angle in radians, with lamp 0 at the back. */
export function theta(angle: number): number {
  return (angle / LAMPS) * TAU - Math.PI / 2
}

/** Radius on the unsquashed ellipse for a climb of 0 (floor) to 1 (rim). */
export function radiusAt(view: View, climb: number): number {
  return view.deep + (view.rim - view.deep) * climb
}

export interface Point {
  x: number
  y: number
}

const scratch: Point = { x: 0, y: 0 }

/**
 * Project a rim position and climb into screen space, relative to the caldera
 * centre. Writes into a shared scratch point unless one is supplied, so a frame
 * of a few hundred projections allocates nothing.
 */
export function project(view: View, angle: number, climb: number, out: Point = scratch): Point {
  const t = theta(angle)
  const r = radiusAt(view, climb)
  out.x = Math.cos(t) * r
  out.y = Math.sin(t) * r * view.squash + (1 - climb) * view.bowl
  return out
}

/** True for the half of the ring nearer the viewer, which draws last. */
export function isNear(angle: number): boolean {
  return Math.sin(theta(angle)) > 0
}

/**
 * Perspective scale for a prop standing on the rim: things on the far lip are
 * further away and read smaller. A flat scale made the back of the ring look
 * like a sticker.
 */
export function depthScale(angle: number): number {
  return 0.82 + 0.3 * (Math.sin(theta(angle)) + 1) / 2
}

/**
 * Enter "circle space": inside this transform the squashed ellipse is a true
 * circle, so radial gradients and arcs can be used directly instead of being
 * approximated with polygons. Only valid near the rim, where the bowl offset is
 * small — which is exactly where light and lamps live.
 */
export function enterRingSpace(ctx: CanvasRenderingContext2D, view: View, climbBias = 1): void {
  ctx.translate(0, (1 - climbBias) * view.bowl)
  ctx.scale(1, view.squash)
}
