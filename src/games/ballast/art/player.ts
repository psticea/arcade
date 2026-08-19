import { clamp } from '../../../lib/math.ts'
import { PLAYER_RADIUS, effectiveMultiplier, type BallastState } from '../simulation.ts'
import { css, shade, LANTERN_COOL, LANTERN_HOT, mixRgb, type Rgb } from './palette.ts'
import { readTrail, type TrailSample } from './view.ts'
import { sx, sy, type Frame } from './frame.ts'

/**
 * The bell.
 *
 * The player is a diving bell with a lantern inside, and every part of it is
 * doing a job: the **roll** shows which wall gravity is pulling toward, the
 * **lantern colour** shows whether the multiplier is climbing, the **ring gauge**
 * shows how much is riding on the current line, and the **wake** shows the arc
 * that got you here. None of that is in the HUD, because at this speed the
 * player never looks away from the bell.
 *
 * The drawn body is deliberately a little larger than `PLAYER_RADIUS`: the
 * hitbox is smaller than the silhouette, so a near miss that looked survivable
 * is survivable.
 */

const BODY_SCALE = 1.5
const WARM_WHITE: Rgb = [255, 248, 228]

const trailScratch: TrailSample[] = Array.from({ length: 64 }, () => ({ x: 0, depth: 0, heat: 0 }))
const lanternColor: Rgb = [0, 0, 0]

export function drawWake(frame: Frame): void {
  const count = readTrail(frame.view, trailScratch)
  if (count < 3) return

  const glow = frame.glow
  glow.save()
  glow.globalCompositeOperation = 'lighter'
  glow.lineCap = 'round'
  glow.lineJoin = 'round'

  const radius = PLAYER_RADIUS * frame.scale
  for (let i = 1; i < count; i++) {
    const a = trailScratch[i - 1]
    const b = trailScratch[i]
    if (!a || !b) continue
    // Newest samples are widest and brightest, so the ribbon reads as trailing
    // out of the bell rather than leading it.
    const t = i / count
    const heat = (a.heat + b.heat) * 0.5
    mixRgb(LANTERN_COOL, LANTERN_HOT, clamp(heat * 0.6 + frame.view.heat * 0.6, 0, 1), lanternColor)

    glow.strokeStyle = css(lanternColor, 0.1 * t * (0.35 + heat))
    glow.lineWidth = radius * 2.1 * t
    glow.beginPath()
    glow.moveTo(sx(frame, a.x), sy(frame, a.depth))
    glow.lineTo(sx(frame, b.x), sy(frame, b.depth))
    glow.stroke()

    glow.strokeStyle = css(lanternColor, 0.3 * t * t)
    glow.lineWidth = Math.max(0.7, radius * 0.5 * t)
    glow.stroke()
  }
  glow.restore()
}

export function drawPlayer(frame: Frame, state: BallastState): void {
  const { ctx, view, palette } = frame
  const x = sx(frame, state.x)
  const y = frame.anchorY
  const r = PLAYER_RADIUS * frame.scale * BODY_SCALE
  const heat = clamp(view.heat * 0.65 + view.earn * 0.5, 0, 1)
  mixRgb(LANTERN_COOL, LANTERN_HOT, heat, lanternColor)

  drawLanternField(frame, x, y, r, heat)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(view.bank * 0.42)

  // --- Body ------------------------------------------------------------------
  bellPath(ctx, r)
  const body = ctx.createLinearGradient(-r, -r, r * 0.6, r)
  body.addColorStop(0, shade(palette.stoneLit, 0.15))
  body.addColorStop(0.35, shade(palette.stoneLit, -0.42))
  body.addColorStop(1, css(palette.stoneDark))
  ctx.fillStyle = body
  ctx.fill()

  // The lit side is the side the light is on, which at depth is the lantern
  // itself — so the bell always looks internally lit rather than flat.
  ctx.save()
  ctx.clip()
  const inner = ctx.createRadialGradient(0, r * 0.25, 0, 0, r * 0.25, r * 1.6)
  inner.addColorStop(0, css(lanternColor, 0.55 * view.lanternFlicker))
  inner.addColorStop(0.5, css(lanternColor, 0.1 * view.lanternFlicker))
  inner.addColorStop(1, css(lanternColor, 0))
  ctx.fillStyle = inner
  ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4)
  ctx.restore()

  bellPath(ctx, r)
  ctx.strokeStyle = css(WARM_WHITE, 0.4)
  ctx.lineWidth = Math.max(1, r * 0.11)
  ctx.stroke()

  // Two hoops and the crown loop: enough hardware to read as an object.
  ctx.strokeStyle = shade(palette.stoneLit, -0.25, 0.75)
  ctx.lineWidth = Math.max(0.8, r * 0.09)
  ctx.beginPath()
  ctx.moveTo(-r * 0.92, r * 0.34)
  ctx.lineTo(r * 0.92, r * 0.34)
  ctx.moveTo(-r * 0.7, -r * 0.28)
  ctx.lineTo(r * 0.7, -r * 0.28)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -r * 1.16, r * 0.22, Math.PI * 0.15, Math.PI * 0.85, true)
  ctx.stroke()

  // --- Porthole: the lantern seen through glass -------------------------------
  const portR = r * 0.42
  ctx.beginPath()
  ctx.arc(0, r * 0.02, portR, 0, Math.PI * 2)
  ctx.fillStyle = css(lanternColor, 0.9 * view.lanternFlicker)
  ctx.fill()
  ctx.strokeStyle = css(palette.stoneDark, 0.9)
  ctx.lineWidth = Math.max(0.8, r * 0.1)
  ctx.stroke()
  // A gothic cross mullion, because even the window on the bell belongs here.
  ctx.beginPath()
  ctx.moveTo(-portR, r * 0.02)
  ctx.lineTo(portR, r * 0.02)
  ctx.moveTo(0, r * 0.02 - portR)
  ctx.lineTo(0, r * 0.02 + portR)
  ctx.lineWidth = Math.max(0.6, r * 0.07)
  ctx.stroke()

  ctx.restore()

  drawGauge(frame, state, x, y, r)
  drawFlipPulses(frame, x, y, r)
}

/** The bell silhouette in local coordinates: dome above, flared skirt below. */
function bellPath(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath()
  ctx.moveTo(-r * 0.98, r * 0.86)
  ctx.bezierCurveTo(-r * 0.92, r * 0.1, -r * 0.86, -r * 0.62, 0, -r * 0.98)
  ctx.bezierCurveTo(r * 0.86, -r * 0.62, r * 0.92, r * 0.1, r * 0.98, r * 0.86)
  ctx.quadraticCurveTo(0, r * 1.18, -r * 0.98, r * 0.86)
  ctx.closePath()
}

/**
 * The light the bell throws. This is the only thing lighting the stone at
 * depth, so its reach is also how far ahead the player can read the shaft.
 */
function drawLanternField(frame: Frame, x: number, y: number, r: number, heat: number): void {
  const glow = frame.glow
  const flicker = frame.view.lanternFlicker
  const reach = r * (5 + heat * 3) * (0.92 + flicker * 0.12)

  glow.save()
  glow.globalCompositeOperation = 'lighter'
  const field = glow.createRadialGradient(x, y, 0, x, y, reach)
  // Deliberately hollow in the middle: the bell has to stay a readable object
  // inside its own light, not a bright smudge with a lamp painted on it.
  field.addColorStop(0, css(lanternColor, 0.1 * flicker))
  field.addColorStop(0.3, css(lanternColor, 0.12 * flicker))
  field.addColorStop(0.65, css(lanternColor, 0.04 * flicker))
  field.addColorStop(1, css(lanternColor, 0))
  glow.fillStyle = field
  glow.fillRect(x - reach, y - reach, reach * 2, reach * 2)
  glow.restore()
}

/**
 * The multiplier, drawn on the bell rather than in the HUD.
 *
 * A ring that fills as the multiplier climbs and empties the instant it breaks,
 * so the thing the player is risking is attached to the thing at risk.
 */
function drawGauge(frame: Frame, state: BallastState, x: number, y: number, r: number): void {
  const { ctx } = frame
  const value = effectiveMultiplier(state)
  const fill = clamp((value - 1) / 11, 0, 1)
  if (fill < 0.005 && frame.view.earn < 0.02) return

  const radius = r * 2.05
  const start = -Math.PI / 2
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = css(lanternColor, 0.14)
  ctx.lineWidth = Math.max(1.4, r * 0.2)
  ctx.beginPath()
  ctx.arc(x, y, radius, start, start + Math.PI * 2)
  ctx.stroke()

  const glow = frame.glow
  glow.save()
  glow.globalCompositeOperation = 'lighter'
  glow.lineCap = 'round'
  glow.strokeStyle = css(lanternColor, 0.85)
  glow.lineWidth = Math.max(1.6, r * 0.24)
  glow.beginPath()
  glow.arc(x, y, radius, start, start + Math.PI * 2 * fill)
  glow.stroke()
  glow.restore()
  ctx.restore()

  if (value >= 1.4) {
    const size = Math.max(11, r * 1.5)
    ctx.save()
    ctx.font = `700 ${size}px Orbitron, ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const label = `${value.toFixed(1)}×`
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillText(label, x + 1, y - radius - size * 0.5 + 1)
    ctx.fillStyle = css(lanternColor, 0.98)
    ctx.fillText(label, x, y - radius - size * 0.5)
    ctx.restore()
  }
}

/**
 * Flip feedback.
 *
 * A flip happens several times a second, so it gets a displaced-water ring and
 * nothing louder — screenshake here would turn the whole game into noise. The
 * double flip is rare and hard, so it gets a distinct chevron flash: the player
 * needs to know they made the window.
 */
function drawFlipPulses(frame: Frame, x: number, y: number, r: number): void {
  const glow = frame.glow
  const { view } = frame

  if (view.flipPulse > 0.001) {
    const t = 1 - view.flipPulse
    glow.save()
    glow.globalCompositeOperation = 'lighter'
    glow.strokeStyle = css(lanternColor, 0.28 * view.flipPulse * view.flipPulse)
    glow.lineWidth = Math.max(1, r * 0.45 * view.flipPulse)
    glow.beginPath()
    // Wider than it is tall: this is water shouldered aside, not a shockwave.
    glow.ellipse(x, y, r * (1 + t * 5), r * (1 + t * 2.6), 0, 0, Math.PI * 2)
    glow.stroke()
    glow.restore()
  }

  if (view.doublePulse > 0.001) {
    // Two rings chasing each other, because that is literally what happened —
    // and it is the one piece of feedback the player must not miss, since the
    // whole multiplier survived on a window a sixth of a second wide.
    const p = view.doublePulse
    glow.save()
    glow.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 2; i++) {
      const phase = Math.max(0, Math.min(1, (1 - p) * 1.4 - i * 0.28))
      if (phase <= 0) continue
      const fade = (1 - phase) * (1 - phase)
      glow.strokeStyle = css(LANTERN_HOT, 0.55 * fade)
      glow.lineWidth = Math.max(1.2, r * 0.34 * fade)
      glow.beginPath()
      glow.ellipse(x, y, r * (1 + phase * 6.5), r * (1 + phase * 3.4), 0, 0, Math.PI * 2)
      glow.stroke()
    }
    glow.restore()
  }
}

/**
 * The tension line: while the bell is inside the earning band, a taut thread
 * connects it to the stone it is riding. It is the clearest possible statement
 * of the only question the game asks — how close, and can you still get out.
 */
export function drawTension(frame: Frame, state: BallastState, distance: number): void {
  const earn = frame.view.earn
  if (earn < 0.06 || !state.alive) return

  const glow = frame.glow
  const x = sx(frame, state.x)
  const y = frame.anchorY
  const towardLeft = state.x < 50
  const stoneX = x + (towardLeft ? -1 : 1) * distance * frame.scale

  glow.save()
  glow.globalCompositeOperation = 'lighter'
  glow.strokeStyle = css(lanternColor, 0.18 * earn)
  glow.lineWidth = Math.max(1, frame.scale * 0.3)
  glow.setLineDash([frame.scale * 1.2, frame.scale * 1.6])
  glow.lineDashOffset = -frame.view.time * frame.scale * 8
  glow.beginPath()
  glow.moveTo(x, y)
  glow.lineTo(stoneX, y)
  glow.stroke()
  glow.setLineDash([])
  glow.restore()
}
