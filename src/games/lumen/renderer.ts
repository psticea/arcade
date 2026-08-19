import {
  LIGHT_CAPACITY,
  SHADOW_DURATION,
  isDiving,
  type LumenState,
} from './simulation.ts'
import { glowDot, neonLine, neonPolyline, strokeNeonPath } from '../../lib/neon.ts'
import { renderParticles, type Juice } from '../../lib/juice.ts'
import { clamp } from '../../lib/math.ts'

/** Convert a rim position and depth into screen space. */
function project(
  angle: number,
  depth: number,
  segments: number,
  radius: number,
): { x: number; y: number } {
  const theta = (angle / segments) * Math.PI * 2 - Math.PI / 2
  const r = depth * radius
  return { x: Math.cos(theta) * r, y: Math.sin(theta) * r }
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: LumenState,
  juice: Juice,
  width: number,
  height: number,
): void {
  // The whole tunnel dims as light drains: the score is the lighting.
  const lightFraction = clamp(state.light / LIGHT_CAPACITY, 0, 1)
  const ambient = 0.16 + lightFraction * 0.84

  ctx.fillStyle = '#02030a'
  ctx.fillRect(0, 0, width, height)

  const radius = Math.min(width, height) * 0.42
  const cx = width / 2 + juice.shakeX
  const cy = height / 2 + juice.shakeY

  ctx.save()
  ctx.translate(cx, cy)

  drawWell(ctx, state, radius, ambient)
  drawShadows(ctx, state, radius, ambient)
  drawSpires(ctx, state, radius, ambient)
  drawMotes(ctx, state, radius, ambient)
  drawPlayer(ctx, state, radius, ambient)
  drawBloom(ctx, state, radius)
  renderParticles(ctx, juice.particles)

  ctx.restore()

  drawLightRing(ctx, state, width, height, lightFraction)
}

function drawWell(
  ctx: CanvasRenderingContext2D,
  state: LumenState,
  radius: number,
  ambient: number,
): void {
  const { segments } = state

  // Concentric rings give the well depth without needing a 3D projection.
  for (const depth of [0.22, 0.45, 0.7, 1]) {
    const points = []
    for (let i = 0; i <= segments; i++) {
      points.push(project(i, depth, segments, radius))
    }
    neonPolyline(ctx, points, {
      color: '#2f6d8f',
      width: depth === 1 ? 2.4 : 1.2,
      glow: depth === 1 ? 1.4 : 0.6,
      alpha: (depth === 1 ? 0.85 : 0.3) * ambient,
      close: true,
    })
  }

  // Radial spokes, one per segment.
  ctx.save()
  ctx.globalAlpha = 0.24 * ambient
  ctx.strokeStyle = '#2f6d8f'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i < segments; i++) {
    const inner = project(i, 0.16, segments, radius)
    const outer = project(i, 1, segments, radius)
    ctx.moveTo(inner.x, inner.y)
    ctx.lineTo(outer.x, outer.y)
  }
  ctx.stroke()
  ctx.restore()

  // The throat: a dark mouth at the centre the deep motes sink into.
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.3)
  gradient.addColorStop(0, 'rgba(0,0,0,0.95)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2)
  ctx.fill()
}

function drawShadows(
  ctx: CanvasRenderingContext2D,
  state: LumenState,
  radius: number,
  ambient: number,
): void {
  for (const shadow of state.shadows) {
    const start = project(shadow.segment - 0.5, 0.16, state.segments, radius)
    const mid = project(shadow.segment - 0.5, 1, state.segments, radius)
    const end = project(shadow.segment + 0.5, 1, state.segments, radius)
    const inner = project(shadow.segment + 0.5, 0.16, state.segments, radius)

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(mid.x, mid.y)
    ctx.lineTo(end.x, end.y)
    ctx.lineTo(inner.x, inner.y)
    ctx.closePath()

    if (shadow.active) {
      const pulse = 0.35 + 0.25 * Math.sin(state.elapsed * 22)
      ctx.fillStyle = `rgba(6, 4, 20, ${0.55 + pulse * 0.35})`
      ctx.fill()
      strokeNeonPath(ctx, { color: '#5c3fff', width: 1.6, glow: 1.6, alpha: 0.75 * ambient })
    } else {
      // Telegraph: a warning outline before the lane goes dark.
      const progress = 1 - shadow.timer / SHADOW_DURATION
      strokeNeonPath(ctx, {
        color: '#8a6bff',
        width: 1.4,
        glow: 1 + progress,
        alpha: 0.5 * ambient,
      })
    }
  }
}

function drawSpires(
  ctx: CanvasRenderingContext2D,
  state: LumenState,
  radius: number,
  ambient: number,
): void {
  for (const spire of state.spires) {
    const base = project(spire.segment, 0.16, state.segments, radius)
    const tip = project(spire.segment, 0.16 + spire.height * 0.84, state.segments, radius)
    const left = project(spire.segment - 0.32, 0.16, state.segments, radius)
    const right = project(spire.segment + 0.32, 0.16, state.segments, radius)

    ctx.beginPath()
    ctx.moveTo(left.x, left.y)
    ctx.lineTo(tip.x, tip.y)
    ctx.lineTo(right.x, right.y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(20, 12, 40, 0.75)'
    ctx.fill()
    strokeNeonPath(ctx, {
      color: spire.height >= 0.55 ? '#c86bff' : '#7a63c8',
      width: 1.8,
      glow: 1.3,
      alpha: (0.6 + spire.height * 0.4) * ambient,
    })
    void base
  }
}

function drawMotes(
  ctx: CanvasRenderingContext2D,
  state: LumenState,
  radius: number,
  ambient: number,
): void {
  for (const mote of state.motes) {
    const point = project(mote.angle, mote.depth, state.segments, radius)
    const deep = mote.kind === 'deep'
    // Rising motes brighten as they near the rim: urgency you can see.
    const urgency = deep ? 1 : clamp((mote.depth - 0.55) / 0.45, 0, 1)
    const size = deep ? 5.5 : 3.4 + urgency * 2.2
    const colour = deep ? '#ffd166' : urgency > 0.6 ? '#ff8fa3' : '#7ce8ff'

    glowDot(ctx, point.x, point.y, size, colour, (deep ? 1.6 : 0.9 + urgency) * ambient)

    if (deep) {
      const ring = 10 + Math.sin(state.elapsed * 7) * 2
      ctx.beginPath()
      ctx.arc(point.x, point.y, ring, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffd166'
      ctx.globalAlpha = 0.45 * ambient
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: LumenState,
  radius: number,
  ambient: number,
): void {
  const diving = isDiving(state)
  const centre = project(state.playerAngle, state.playerDepth, state.segments, radius)
  const left = project(state.playerAngle - 0.42, state.playerDepth, state.segments, radius)
  const right = project(state.playerAngle + 0.42, state.playerDepth, state.segments, radius)
  const inner = project(state.playerAngle, state.playerDepth - 0.13, state.segments, radius)

  ctx.beginPath()
  ctx.moveTo(left.x, left.y)
  ctx.lineTo(inner.x, inner.y)
  ctx.lineTo(right.x, right.y)
  ctx.lineTo(centre.x, centre.y)
  ctx.closePath()
  strokeNeonPath(ctx, {
    color: diving ? '#ffffff' : '#00fff2',
    width: 2.4,
    glow: diving ? 2.4 : 1.6,
    alpha: Math.max(0.5, ambient),
  })

  // A tether back to the rim so the dive reads as leaving and returning.
  if (diving) {
    const anchor = project(state.playerAngle, 1, state.segments, radius)
    neonLine(ctx, centre.x, centre.y, anchor.x, anchor.y, {
      color: '#00fff2', width: 1.2, glow: 1.2, alpha: 0.4,
    })
  }
}

function drawBloom(ctx: CanvasRenderingContext2D, state: LumenState, radius: number): void {
  if (state.bloomPulse <= 0) return
  const centre = project(state.playerAngle, state.playerDepth, state.segments, radius)
  const spread = state.bloomWide ? 1 : 0.6
  const size = (1 - state.bloomPulse) * radius * 0.42 * (state.bloomWide ? 1.5 : 1)

  ctx.beginPath()
  ctx.arc(centre.x, centre.y, Math.max(2, size), 0, Math.PI * 2)
  strokeNeonPath(ctx, {
    color: state.bloomWide ? '#9dfff2' : '#ffffff',
    width: 2.6 * spread,
    glow: 2,
    alpha: state.bloomPulse,
  })
}

/** The light level is drawn as a ring, not a number. */
function drawLightRing(
  ctx: CanvasRenderingContext2D,
  state: LumenState,
  width: number,
  height: number,
  fraction: number,
): void {
  const radius = Math.min(width, height) * 0.46
  ctx.save()
  ctx.translate(width / 2, height / 2)

  ctx.beginPath()
  ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction)
  ctx.strokeStyle = fraction > 0.5 ? '#00fff2' : fraction > 0.22 ? '#ffd166' : '#ff4d6d'
  ctx.lineWidth = 4
  ctx.globalAlpha = 0.75
  ctx.lineCap = 'round'
  ctx.stroke()

  if (fraction < 0.25) {
    // A slow breathing halo when the tunnel is close to going dark.
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(state.elapsed * 5)
    ctx.lineWidth = 14
    ctx.stroke()
  }
  ctx.restore()
}
