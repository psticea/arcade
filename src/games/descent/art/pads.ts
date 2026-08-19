import { approachQuality, padAt, type DescentState, type Pad } from '../simulation.ts'
import { approachColour, css, shade, type Rgb } from './palette.ts'
import type { DescentFrame } from './frame.ts'

/**
 * Landing pads.
 *
 * A pad is the only engineered thing in the cave, so it is the only thing with
 * straight lines: a steel deck on driven legs, chevrons pointing at the centre,
 * and a beacon at each end. The beacons carry the entire instrument panel — the
 * pad the drone is over turns green, amber or red for the current approach, and
 * that colour *is* the velocity and attitude readout the game refuses to print
 * as a number.
 */

/** Pixels of deck thickness, in world units. */
const DECK = 0.42

export function drawPads(frame: DescentFrame, state: DescentState): void {
  const quality = approachQuality(state)
  const target = padAt(state.terrain, state.ship.x)

  for (const pad of state.terrain.pads) {
    if (pad.right < frame.viewLeft - 6 || pad.left > frame.viewRight + 6) continue
    drawPad(frame, pad, pad === target, quality)
  }
}

function drawPad(frame: DescentFrame, pad: Pad, isTarget: boolean, quality: number): void {
  const { ctx, palette, view } = frame
  const width = pad.right - pad.left
  const colour: Rgb = isTarget ? approachColour(quality) : palette.seam
  const strength = isTarget ? 1 : 0.42

  // --- Structure --------------------------------------------------------------
  // Legs driven into the rock. They read instantly as "someone built this",
  // which is what separates a pad from a flat bit of cave.
  ctx.strokeStyle = css(palette.rockDark, 0.95)
  ctx.lineWidth = 0.18
  ctx.beginPath()
  for (const side of [-1, 1]) {
    const x = pad.left + width * (0.5 + side * 0.36)
    ctx.moveTo(x, pad.y)
    ctx.lineTo(x + side * 0.5, pad.y + 1.6)
  }
  ctx.stroke()

  const deck = ctx.createLinearGradient(0, pad.y - DECK, 0, pad.y + DECK)
  deck.addColorStop(0, shade(palette.rim, -0.28))
  deck.addColorStop(0.5, shade(palette.rockDark, 0.25))
  deck.addColorStop(1, css(palette.rockDark))
  ctx.fillStyle = deck
  ctx.fillRect(pad.left, pad.y - DECK * 0.5, width, DECK)

  // Chevrons pointing at the touchdown point, tightening on the richer pads.
  ctx.strokeStyle = css(colour, 0.35 * strength)
  ctx.lineWidth = 0.1
  const chevrons = pad.multiplier === 8 ? 2 : pad.multiplier === 3 ? 3 : 4
  ctx.beginPath()
  for (let i = 1; i <= chevrons; i++) {
    const t = i / (chevrons + 1)
    for (const side of [-1, 1]) {
      const x = pad.left + width * (0.5 + side * t * 0.5)
      ctx.moveTo(x, pad.y - DECK * 0.5)
      ctx.lineTo(x - side * width * 0.06, pad.y - DECK * 0.5 - 0.34)
    }
  }
  ctx.stroke()

  // --- The lit deck edge ------------------------------------------------------
  ctx.strokeStyle = css(colour, 0.9 * strength)
  ctx.lineWidth = 0.13
  ctx.beginPath()
  ctx.moveTo(pad.left, pad.y - DECK * 0.5)
  ctx.lineTo(pad.right, pad.y - DECK * 0.5)
  ctx.stroke()

  // --- Beacons ----------------------------------------------------------------
  // They sweep inward, so the pair reads as an approach path rather than two
  // lamps. The target pad's beacons run faster the worse the approach is.
  const urgency = isTarget ? 1 + (1 - quality) * 2.6 : 1
  const glow = frame.glow
  const light = frame.light

  for (const side of [-1, 1]) {
    const x = side < 0 ? pad.left : pad.right
    const phase = (view.time * (1.1 * urgency) + (side < 0 ? 0 : 0.5)) % 1
    const flash = Math.max(0, 1 - phase * 3)
    const mast = 0.9 + (isTarget ? 0.25 : 0)

    ctx.strokeStyle = css(palette.rockDark, 0.9)
    ctx.lineWidth = 0.12
    ctx.beginPath()
    ctx.moveTo(x, pad.y - DECK * 0.5)
    ctx.lineTo(x, pad.y - mast)
    ctx.stroke()

    const bulb = 0.16 + flash * 0.1
    ctx.fillStyle = css(colour, (0.5 + flash * 0.5) * strength)
    ctx.beginPath()
    ctx.arc(x, pad.y - mast, bulb, 0, Math.PI * 2)
    ctx.fill()

    glow.fillStyle = css(colour, (0.28 + flash * 0.62) * strength)
    glow.beginPath()
    glow.arc(x, pad.y - mast, bulb * 2.1, 0, Math.PI * 2)
    glow.fill()

    const reach = 3.6 + flash * 2.4
    const halo = light.createRadialGradient(x, pad.y - mast, 0, x, pad.y - mast, reach)
    halo.addColorStop(0, css(colour, (0.35 + flash * 0.4) * strength))
    halo.addColorStop(1, css(colour, 0))
    light.fillStyle = halo
    light.fillRect(x - reach, pad.y - mast - reach, reach * 2, reach * 2)
  }

  // --- Worth ------------------------------------------------------------------
  // Value as pips on the deck: still no text anywhere in the world.
  const pips = pad.multiplier === 8 ? 3 : pad.multiplier === 3 ? 2 : 1
  ctx.fillStyle = css(colour, 0.85 * strength)
  for (let i = 0; i < pips; i++) {
    const x = pad.left + width * ((i + 1) / (pips + 1))
    ctx.beginPath()
    ctx.arc(x, pad.y + DECK * 0.9, 0.11, 0, Math.PI * 2)
    ctx.fill()
  }

  if (isTarget) {
    // A soft wash over the deck, so the pad being flown to is unmistakable in
    // peripheral vision without adding another symbol to read.
    const wash = light.createLinearGradient(0, pad.y - 7, 0, pad.y)
    wash.addColorStop(0, css(colour, 0))
    wash.addColorStop(1, css(colour, 0.3))
    light.fillStyle = wash
    light.fillRect(pad.left - 1, pad.y - 7, width + 2, 7)
  }
}
