/**
 * Bloom.
 *
 * Emissive things — rays, glass, candles, the lantern, the wake — are drawn
 * into a half-resolution layer, blurred twice at different radii, and added
 * back. This is the single biggest difference between "shapes on a gradient"
 * and light: a glow that spills across the whole frame is what ties the
 * masonry, the water and the bell into one photograph.
 *
 * Half resolution is not a compromise. The blur is what the layer is for, so
 * the detail thrown away is detail that would have been destroyed anyway, and
 * it makes the two blur passes cost a quarter of what they would at full size.
 */

const GLOW_SCALE = 0.5

export interface Bloom {
  /** Draw emissive content here, in CSS pixels. */
  readonly ctx: CanvasRenderingContext2D
  resize(width: number, height: number): void
  /** Clear the emissive layer. Call once at the top of a frame. */
  begin(): void
  /** Blur and add the emissive layer onto `target`. */
  composite(target: CanvasRenderingContext2D, width: number, height: number, strength: number): void
}

function makeLayer(width: number, height: number): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * GLOW_SCALE))
  canvas.height = Math.max(1, Math.ceil(height * GLOW_SCALE))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available for the bloom pass')
  ctx.setTransform(GLOW_SCALE, 0, 0, GLOW_SCALE, 0, 0)
  return { canvas, ctx }
}

export function createBloom(width: number, height: number): Bloom {
  let source = makeLayer(width, height)
  let tight = makeLayer(width, height)
  let wide = makeLayer(width, height)
  let cssWidth = width
  let cssHeight = height

  // Safari before 16.4 and a handful of embedded webviews have no canvas
  // filter. Without it the layer is still additively composited, just without
  // the spread — dimmer, but never broken.
  const filtered = typeof source.ctx.filter === 'string'

  return {
    get ctx() {
      return source.ctx
    },

    resize(nextWidth, nextHeight) {
      if (nextWidth === cssWidth && nextHeight === cssHeight) return
      cssWidth = nextWidth
      cssHeight = nextHeight
      source = makeLayer(nextWidth, nextHeight)
      tight = makeLayer(nextWidth, nextHeight)
      wide = makeLayer(nextWidth, nextHeight)
    },

    begin() {
      source.ctx.setTransform(1, 0, 0, 1, 0, 0)
      source.ctx.clearRect(0, 0, source.canvas.width, source.canvas.height)
      source.ctx.setTransform(GLOW_SCALE, 0, 0, GLOW_SCALE, 0, 0)
    },

    composite(target, w, h, strength) {
      if (strength <= 0) return

      if (filtered) {
        const radius = Math.max(2, Math.round(h * 0.006))
        tight.ctx.setTransform(1, 0, 0, 1, 0, 0)
        tight.ctx.clearRect(0, 0, tight.canvas.width, tight.canvas.height)
        tight.ctx.filter = `blur(${radius}px)`
        tight.ctx.drawImage(source.canvas, 0, 0)
        tight.ctx.filter = 'none'

        wide.ctx.setTransform(1, 0, 0, 1, 0, 0)
        wide.ctx.clearRect(0, 0, wide.canvas.width, wide.canvas.height)
        wide.ctx.filter = `blur(${radius * 4}px)`
        wide.ctx.drawImage(tight.canvas, 0, 0)
        wide.ctx.filter = 'none'
      }

      target.save()
      target.globalCompositeOperation = 'lighter'
      target.imageSmoothingEnabled = true
      if (filtered) {
        target.globalAlpha = 0.5 * strength
        target.drawImage(wide.canvas, 0, 0, w, h)
        target.globalAlpha = 0.55 * strength
        target.drawImage(tight.canvas, 0, 0, w, h)
      }
      // The unblurred core keeps small highlights crisp instead of dissolving
      // them into the halo.
      target.globalAlpha = (filtered ? 0.45 : 1) * strength
      target.drawImage(source.canvas, 0, 0, w, h)
      target.restore()
    },
  }
}
