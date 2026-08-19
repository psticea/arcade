import { clamp, closestPointOnSegment } from '../../lib/math.ts'

/**
 * GLASSWORKS — table geometry.
 *
 * The table is authored as plain data so the simulation stays pure and the
 * renderer can draw exactly what the physics sees. Four configurations share an
 * outer shell; completing a mission rebuilds the interior, which is the one
 * thing a table made of wood and glass can never do.
 */

export const TABLE_WIDTH = 40
export const TABLE_HEIGHT = 70
export const BALL_RADIUS = 0.55
export const DRAIN_Y = TABLE_HEIGHT + 2

export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
  restitution: number
  /** Score awarded when the ball strikes this wall. */
  points?: number
  kind?: 'wall' | 'target' | 'diverter' | 'sling'
  id?: string
}

export interface Bumper {
  x: number
  y: number
  radius: number
  restitution: number
  /** Extra outward impulse, which is what makes a bumper feel alive. */
  kick: number
  points: number
  id: string
}

export interface TableConfig {
  name: string
  segments: Segment[]
  bumpers: Bumper[]
  /** Ids of the targets that must all be hit to complete the mission. */
  targetIds: string[]
}

const WALL_RESTITUTION = 0.42
const RUBBER_RESTITUTION = 0.78

/** The permanent shell: outer walls, plunger lane and the drain funnel. */
function shell(): Segment[] {
  const wall = (x1: number, y1: number, x2: number, y2: number, restitution = WALL_RESTITUTION): Segment =>
    ({ x1, y1, x2, y2, restitution, kind: 'wall' })

  return [
    wall(1, 1, 1, 58),
    wall(1, 1, TABLE_WIDTH - 1, 1),
    wall(TABLE_WIDTH - 1, 1, TABLE_WIDTH - 1, TABLE_HEIGHT),
    // Plunger lane divider, open at the top so a launched ball enters play.
    wall(TABLE_WIDTH - 5, 16, TABLE_WIDTH - 5, TABLE_HEIGHT),
    // Return arc across the full lane exit, curving the launched ball into the
    // playfield. It has to span the whole lane or the ball misses it, hits the
    // top wall and drops straight back down the lane.
    wall(TABLE_WIDTH - 1, 13, TABLE_WIDTH - 3, 7),
    wall(TABLE_WIDTH - 3, 7, TABLE_WIDTH - 7, 4),
    wall(TABLE_WIDTH - 7, 4, TABLE_WIDTH - 13, 3),
    // Inlanes funnelling toward the flippers.
    wall(1, 58, 11, 64),
    wall(TABLE_WIDTH - 5, 58, 29, 64),
    // Slingshots above each flipper: lively rubber that keeps the ball moving.
    { x1: 9, y1: 50, x2: 12, y2: 57, restitution: RUBBER_RESTITUTION, kind: 'sling', points: 250, id: 'sling-left' },
    { x1: 31, y1: 50, x2: 28, y2: 57, restitution: RUBBER_RESTITUTION, kind: 'sling', points: 250, id: 'sling-right' },
  ]
}

function target(id: string, x1: number, y1: number, x2: number, y2: number): Segment {
  return { x1, y1, x2, y2, restitution: 0.55, kind: 'target', points: 25000, id }
}

function bumper(id: string, x: number, y: number, radius = 2.1): Bumper {
  return { id, x, y, radius, restitution: 0.92, kick: 26, points: 1500 }
}

/**
 * Four interiors. They deliberately move the scoring geography around so the
 * route you learned in the first minute is gone by the fourth.
 */
export function tableConfigs(): TableConfig[] {
  return [
    {
      name: 'ATRIUM',
      segments: [
        ...shell(),
        target('t1', 8, 20, 12, 20),
        target('t2', 18, 12, 22, 12),
        target('t3', 28, 20, 32, 20),
        { x1: 6, y1: 34, x2: 14, y2: 40, restitution: WALL_RESTITUTION, kind: 'wall' },
        { x1: 34, y1: 34, x2: 26, y2: 40, restitution: WALL_RESTITUTION, kind: 'wall' },
      ],
      bumpers: [bumper('b1', 14, 27), bumper('b2', 20, 22), bumper('b3', 26, 27)],
      targetIds: ['t1', 't2', 't3'],
    },
    {
      name: 'GALLERY',
      segments: [
        ...shell(),
        target('t1', 6, 14, 6, 18),
        target('t2', 34, 14, 34, 18),
        target('t3', 18, 34, 22, 34),
        { x1: 10, y1: 24, x2: 20, y2: 30, restitution: RUBBER_RESTITUTION, kind: 'wall' },
        { x1: 30, y1: 24, x2: 20, y2: 30, restitution: RUBBER_RESTITUTION, kind: 'wall' },
        { x1: 4, y1: 44, x2: 12, y2: 44, restitution: WALL_RESTITUTION, kind: 'wall' },
        { x1: 36, y1: 44, x2: 28, y2: 44, restitution: WALL_RESTITUTION, kind: 'wall' },
      ],
      bumpers: [bumper('b1', 12, 16, 2.4), bumper('b2', 28, 16, 2.4), bumper('b3', 20, 44, 1.9)],
      targetIds: ['t1', 't2', 't3'],
    },
    {
      name: 'FURNACE',
      segments: [
        ...shell(),
        target('t1', 14, 10, 18, 10),
        target('t2', 22, 10, 26, 10),
        target('t3', 18, 46, 22, 46),
        { x1: 8, y1: 18, x2: 8, y2: 34, restitution: RUBBER_RESTITUTION, kind: 'wall' },
        { x1: 32, y1: 18, x2: 32, y2: 34, restitution: RUBBER_RESTITUTION, kind: 'wall' },
        { x1: 8, y1: 34, x2: 16, y2: 40, restitution: WALL_RESTITUTION, kind: 'wall' },
        { x1: 32, y1: 34, x2: 24, y2: 40, restitution: WALL_RESTITUTION, kind: 'wall' },
      ],
      bumpers: [
        bumper('b1', 20, 20, 2.6), bumper('b2', 14, 30), bumper('b3', 26, 30),
      ],
      targetIds: ['t1', 't2', 't3'],
    },
    {
      name: 'CHOIR',
      segments: [
        ...shell(),
        target('t1', 5, 26, 9, 26),
        target('t2', 31, 26, 35, 26),
        target('t3', 18, 18, 22, 18),
        { x1: 12, y1: 8, x2: 20, y2: 14, restitution: WALL_RESTITUTION, kind: 'wall' },
        { x1: 28, y1: 8, x2: 20, y2: 14, restitution: WALL_RESTITUTION, kind: 'wall' },
        { x1: 10, y1: 38, x2: 20, y2: 34, restitution: RUBBER_RESTITUTION, kind: 'wall' },
        { x1: 30, y1: 38, x2: 20, y2: 34, restitution: RUBBER_RESTITUTION, kind: 'wall' },
      ],
      bumpers: [bumper('b1', 20, 28, 2.2), bumper('b2', 10, 16), bumper('b3', 30, 16)],
      targetIds: ['t1', 't2', 't3'],
    },
  ]
}

/** The live diverter the player raises and drops with ↑ / ↓. */
export function diverterSegment(raised: boolean): Segment {
  return raised
    ? { x1: 16, y1: 42, x2: 24, y2: 38, restitution: 0.5, kind: 'diverter', id: 'diverter' }
    : { x1: 16, y1: 38, x2: 24, y2: 42, restitution: 0.5, kind: 'diverter', id: 'diverter' }
}

export interface Flipper {
  pivotX: number
  pivotY: number
  length: number
  /** Current angle in radians, measured from the +x axis. */
  angle: number
  restAngle: number
  raisedAngle: number
  angularVelocity: number
  side: 'left' | 'right'
}

export function createFlippers(): Flipper[] {
  return [
    {
      pivotX: 13, pivotY: 62, length: 7,
      angle: 0.52, restAngle: 0.52, raisedAngle: -0.42,
      angularVelocity: 0, side: 'left',
    },
    {
      pivotX: 27, pivotY: 62, length: 7,
      angle: Math.PI - 0.52, restAngle: Math.PI - 0.52, raisedAngle: Math.PI + 0.42,
      angularVelocity: 0, side: 'right',
    },
  ]
}

export function flipperSegment(flipper: Flipper): Segment {
  return {
    x1: flipper.pivotX,
    y1: flipper.pivotY,
    x2: flipper.pivotX + Math.cos(flipper.angle) * flipper.length,
    y2: flipper.pivotY + Math.sin(flipper.angle) * flipper.length,
    restitution: 0.24,
    kind: 'wall',
  }
}

/** Distance from a point to a segment, plus the closest point itself. */
export function distanceToSegment(
  px: number, py: number, segment: Segment,
): { distance: number; cx: number; cy: number } {
  const closest = closestPointOnSegment(px, py, segment.x1, segment.y1, segment.x2, segment.y2)
  return {
    distance: Math.hypot(px - closest.x, py - closest.y),
    cx: closest.x,
    cy: closest.y,
  }
}

export { clamp }
