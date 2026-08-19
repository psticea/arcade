import { renderParticles, type Juice } from '../../lib/juice.ts'
import { LAMPS, LAMP_CAPACITY, TUNING, type LumenState } from './simulation.ts'
import { createPalette, samplePalette } from './art/palette.ts'
import { layout, project, theta, type View } from './art/view.ts'
import { drawSky } from './art/sky.ts'
import { drawCaldera, drawUpdraught } from './art/caldera.ts'
import { drawBrazier, drawBurnBand, drawLight, drawOffer } from './art/lamps.ts'
import { drawShade } from './art/shades.ts'
import { drawKeeper } from './art/keeper.ts'
import { drawOfferPanel, drawSnow, drawVignette, drawWatchTitle } from './art/frame.ts'

/**
 * Composition.
 *
 * Everything standing on or in the caldera is drawn back-to-front in one sorted
 * pass, so a brazier on the near lip occludes a shade behind it and the keeper
 * walks in front of and behind the fires as she goes round. Sorting is done
 * over a pooled array, so a frame with sixty shades still allocates nothing.
 */

type PropKind = 'brazier' | 'shade' | 'offer' | 'keeper'

interface Prop {
  y: number
  kind: PropKind
  index: number
}

const pool: Prop[] = Array.from({ length: 160 }, () => ({ y: 0, kind: 'brazier', index: 0 }))
const order: Prop[] = []
let poolCursor = 0

function add(y: number, kind: PropKind, index: number): void {
  const prop = pool[poolCursor]
  if (!prop) return
  poolCursor += 1
  prop.y = y
  prop.kind = kind
  prop.index = index
  order.push(prop)
}

function byDepth(a: Prop, b: Prop): number {
  return a.y - b.y
}

const palette = createPalette()

export interface RenderContext {
  juice: Juice
  input: { pour: boolean; draw: boolean }
  /** Seconds of the "WATCH n" title still to show. */
  titleFade: number
  /** True under prefers-reduced-motion: damps weather, never gameplay. */
  calm: boolean
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: LumenState,
  width: number,
  height: number,
  context: RenderContext,
): void {
  const view = layout(width, height)
  const time = state.elapsed
  samplePalette(palette, state.watch)

  // How much firelight there is to throw on the surrounding snow.
  let glow = 0
  for (const lamp of state.lamps) glow += lamp.fuel
  glow = Math.min(1, glow / (LAMP_CAPACITY * 2.4))

  drawSky(ctx, view, palette, time, glow)

  ctx.save()
  ctx.translate(view.cx + context.juice.shakeX, view.cy + context.juice.shakeY)

  drawCaldera(ctx, view, palette, time)
  drawUpdraught(ctx, view, time)
  drawLight(ctx, view, state, time)
  drawBurnBand(ctx, view, state, time)

  order.length = 0
  poolCursor = 0

  for (let i = 0; i < LAMPS; i++) {
    add(Math.sin(theta(i)) * view.rim * view.squash, 'brazier', i)
  }
  for (let i = 0; i < state.shades.length; i++) {
    const shade = state.shades[i]
    if (!shade) continue
    add(project(view, shade.angle, shade.climb).y, 'shade', i)
  }
  for (let i = 0; i < state.offers.length; i++) {
    const offer = state.offers[i]
    if (!offer) continue
    add(Math.sin(theta(offer.lamp)) * view.rim * view.squash + 0.5, 'offer', i)
  }
  add(Math.sin(theta(state.keeper)) * view.rim * view.squash + 1, 'keeper', 0)

  order.sort(byDepth)

  for (const prop of order) {
    switch (prop.kind) {
      case 'brazier':
        drawBrazier(ctx, view, state, prop.index, palette, time)
        break
      case 'shade': {
        const shade = state.shades[prop.index]
        if (shade) drawShade(ctx, view, shade, time)
        break
      }
      case 'offer': {
        const offer = state.offers[prop.index]
        if (offer) {
          const claim = isClaiming(state, offer.lamp) ? state.claim / TUNING.claimTime : 0
          drawOffer(ctx, view, offer, palette, claim, time)
        }
        break
      }
      case 'keeper':
        drawKeeper(ctx, view, state, palette, context.input, time)
        break
    }
  }

  renderParticles(ctx, context.juice.particles)
  ctx.restore()

  drawSnow(ctx, view, palette, time, context.calm)
  drawVignette(ctx, view, state, time)
  drawOfferPanel(ctx, view, state)
  drawWatchTitle(ctx, view, state, context.titleFade)
}

function isClaiming(state: LumenState, lamp: number): boolean {
  return state.claim > 0 && Math.round(state.keeper) % LAMPS === lamp
}

/** Screen offset of a point on the wall, for particle bursts in `index.ts`. */
export function pointAt(
  width: number,
  height: number,
  angle: number,
  climb: number,
): { x: number; y: number } {
  const view: View = layout(width, height)
  const point = project(view, angle, climb)
  return { x: point.x, y: point.y }
}
