import { css, mixRgb, sampleRamp, shade, type ColourStop, type Rgb } from '../../../lib/colour.ts'

/**
 * LUMEN palette — one long night, getting longer.
 *
 * Every ramp is sampled by `night`, which runs 0 at the first watch to 1 by
 * about the eighth. The sky loses its last blue, the snow stops being white and
 * the aurora thins out, so a screenshot from watch 7 is unmistakably later than
 * one from watch 1 without a single number on screen. Fire is the only thing
 * that does not fade: by the end it is the only colour left.
 *
 * Mixing goes through OKLab (see `lib/colour.ts`) because these are full-screen
 * gradients between saturated colours, which is the one case sRGB blending
 * visibly bands on a phone.
 */

export { css, shade, mixRgb, type Rgb }

type Stop = ColourStop

const SKY_HIGH: Stop[] = [
  { at: 0, color: [14, 18, 46] },
  { at: 0.4, color: [10, 12, 34] },
  { at: 1, color: [5, 5, 16] },
]

const SKY_LOW: Stop[] = [
  { at: 0, color: [42, 44, 96] },
  { at: 0.4, color: [26, 26, 62] },
  { at: 1, color: [12, 10, 30] },
]

/** The aurora's two curtains. They cross, which is where it goes white. */
const AURORA_COLD: Stop[] = [
  { at: 0, color: [96, 246, 190] },
  { at: 0.5, color: [66, 190, 160] },
  { at: 1, color: [40, 118, 104] },
]

const AURORA_WARM: Stop[] = [
  { at: 0, color: [162, 118, 250] },
  { at: 0.5, color: [122, 88, 196] },
  { at: 1, color: [76, 56, 124] },
]

/** Snow on the plateau outside the rim, under starlight only. */
const SNOW: Stop[] = [
  { at: 0, color: [138, 156, 192] },
  { at: 0.45, color: [100, 116, 152] },
  { at: 1, color: [62, 72, 100] },
]

const SNOW_SHADOW: Stop[] = [
  { at: 0, color: [34, 44, 78] },
  { at: 0.45, color: [24, 30, 56] },
  { at: 1, color: [14, 17, 33] },
]

/** The caldera wall: bare basalt terraces. */
const ROCK: Stop[] = [
  { at: 0, color: [40, 46, 74] },
  { at: 0.45, color: [28, 32, 54] },
  { at: 1, color: [16, 18, 32] },
]

const ROCK_DARK: Stop[] = [
  { at: 0, color: [14, 16, 30] },
  { at: 0.5, color: [9, 10, 20] },
  { at: 1, color: [5, 5, 12] },
]

/** The mouth of the Deep. Never quite black, so it reads as depth not a hole. */
const DEEP: Stop[] = [
  { at: 0, color: [8, 6, 20] },
  { at: 1, color: [3, 2, 8] },
]

export interface Palette {
  skyHigh: Rgb
  skyLow: Rgb
  auroraCold: Rgb
  auroraWarm: Rgb
  snow: Rgb
  snowShadow: Rgb
  rock: Rgb
  rockDark: Rgb
  deep: Rgb
  /** 0 on the first watch, 1 once the night is as deep as it gets. */
  night: number
  /** How much aurora is left: 1 early, ~0.3 late. */
  aurora: number
}

/** Fire does not ramp. It is the only thing in the scene that never dims. */
export const EMBER_CORE: Rgb = [255, 244, 208]
export const EMBER: Rgb = [255, 168, 62]
export const EMBER_DEEP: Rgb = [196, 74, 22]
/** What burning light looks like at the threshold — hotter than any lamp. */
export const BURN: Rgb = [255, 250, 226]
/** The keeper's lantern: cooler than a brazier so the figure reads apart. */
export const LANTERN: Rgb = [186, 232, 255]

/** Shades: a body dark enough to silhouette, an edge bright enough to find. */
export const SHADE_BODY: Rgb = [9, 7, 18]
export const SHADE_EDGE: Rgb = [138, 104, 236]
export const SHADE_HUNGRY: Rgb = [226, 92, 132]

export function createPalette(): Palette {
  return {
    skyHigh: [0, 0, 0],
    skyLow: [0, 0, 0],
    auroraCold: [0, 0, 0],
    auroraWarm: [0, 0, 0],
    snow: [0, 0, 0],
    snowShadow: [0, 0, 0],
    rock: [0, 0, 0],
    rockDark: [0, 0, 0],
    deep: [0, 0, 0],
    night: 0,
    aurora: 1,
  }
}

/** `watch` is the current watch index; the night bottoms out around watch 8. */
export function samplePalette(out: Palette, watch: number): Palette {
  const night = Math.min(1, watch / 8)
  sampleRamp(SKY_HIGH, night, out.skyHigh)
  sampleRamp(SKY_LOW, night, out.skyLow)
  sampleRamp(AURORA_COLD, night, out.auroraCold)
  sampleRamp(AURORA_WARM, night, out.auroraWarm)
  sampleRamp(SNOW, night, out.snow)
  sampleRamp(SNOW_SHADOW, night, out.snowShadow)
  sampleRamp(ROCK, night, out.rock)
  sampleRamp(ROCK_DARK, night, out.rockDark)
  sampleRamp(DEEP, night, out.deep)
  out.night = night
  out.aurora = 1 - night * 0.7
  return out
}
