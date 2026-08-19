/**
 * Neon drawing helpers.
 *
 * `shadowBlur` is blurred in software and destroys the frame budget, so glow is
 * built from layered strokes with additive compositing instead: a wide faint
 * halo, a mid band, then an opaque core.
 */

export interface NeonOptions {
  color: string
  width?: number
  /** Multiplies the halo width. Larger reads as brighter. */
  glow?: number
  alpha?: number
}

const GLOW_LAYERS: readonly [number, number][] = [
  [8, 0.06],
  [4, 0.14],
  [2, 0.28],
]

/** Stroke the current path with a neon halo. The path must already be built. */
export function strokeNeonPath(
  ctx: CanvasRenderingContext2D,
  { color, width = 2, glow = 1, alpha = 1 }: NeonOptions,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalCompositeOperation = 'lighter'
  for (const [scale, layerAlpha] of GLOW_LAYERS) {
    ctx.lineWidth = width * scale * glow
    ctx.globalAlpha = layerAlpha * alpha
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.lineWidth = width
  ctx.globalAlpha = alpha
  ctx.stroke()
  ctx.restore()
}

export function neonLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  options: NeonOptions,
): void {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  strokeNeonPath(ctx, options)
}

export function neonPolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  options: NeonOptions & { close?: boolean },
): void {
  const first = points[0]
  if (!first || points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < points.length; i++) {
    const point = points[i]
    if (point) ctx.lineTo(point.x, point.y)
  }
  if (options.close) ctx.closePath()
  strokeNeonPath(ctx, options)
}

export function neonCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  options: NeonOptions,
): void {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  strokeNeonPath(ctx, options)
}

/** A filled dot with an additive halo — used for motes, pickups and the ball. */
export function glowDot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  color: string,
  intensity = 1,
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = color
  ctx.globalAlpha = 0.12 * intensity
  ctx.beginPath()
  ctx.arc(x, y, radius * 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.3 * intensity
  ctx.beginPath()
  ctx.arc(x, y, radius * 1.9, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Resize the backing store for devicePixelRatio and return CSS pixel size. */
export function fitCanvas(canvas: HTMLCanvasElement): { width: number; height: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { width, height }
}
