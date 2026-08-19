/**
 * A light map.
 *
 * Canvas 2D has no lighting model, so darkness has to be composited rather than
 * painted. The scene is drawn at full brightness, every light source is
 * accumulated into a separate buffer starting from an ambient floor, and the
 * buffer is then multiplied over the frame. Anything a light does not reach
 * falls back to ambient, which is what turns "a dark colour scheme" into an
 * actual cave with one lamp in it.
 *
 * Half resolution throughout: light is low-frequency by nature, so the detail
 * thrown away is detail nobody can see, and the multiply blit costs a quarter
 * of what it would at full size.
 */

const LIGHT_SCALE = 0.5

export interface LightMap {
  /** Draw light sources here, additively, in the same space as the scene. */
  readonly ctx: CanvasRenderingContext2D
  resize(width: number, height: number): void
  /** Clear to an ambient floor. Call at the top of a frame. */
  begin(ambient: string): void
  /** Multiply the accumulated light over `target`. */
  composite(target: CanvasRenderingContext2D, width: number, height: number): void
}

export function createLightMap(width: number, height: number): LightMap {
  let canvas = document.createElement('canvas')
  let ctx = prepare(canvas, width, height)
  let cssWidth = width
  let cssHeight = height

  function prepare(target: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
    target.width = Math.max(1, Math.ceil(w * LIGHT_SCALE))
    target.height = Math.max(1, Math.ceil(h * LIGHT_SCALE))
    const context = target.getContext('2d')
    if (!context) throw new Error('Canvas 2D is not available for the light pass')
    return context
  }

  return {
    get ctx() {
      return ctx
    },

    resize(nextWidth, nextHeight) {
      if (nextWidth === cssWidth && nextHeight === cssHeight) return
      cssWidth = nextWidth
      cssHeight = nextHeight
      canvas = document.createElement('canvas')
      ctx = prepare(canvas, nextWidth, nextHeight)
    },

    begin(ambient) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.fillStyle = ambient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(LIGHT_SCALE, 0, 0, LIGHT_SCALE, 0, 0)
      ctx.globalCompositeOperation = 'lighter'
    },

    composite(target, w, h) {
      // No transform reset: the caller's canvas still carries its
      // devicePixelRatio transform, so this draws in CSS pixels like everything
      // else and stays correct on a 2x screen.
      target.save()
      target.globalCompositeOperation = 'multiply'
      target.imageSmoothingEnabled = true
      target.drawImage(canvas, 0, 0, w, h)
      target.restore()
    },
  }
}
