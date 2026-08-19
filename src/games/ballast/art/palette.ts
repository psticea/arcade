import { css, mixRgb, sampleRamp, shade, type ColourStop, type Rgb } from '../../../lib/colour.ts'

/**
 * BALLAST palette — the descent is one continuous hue journey.
 *
 * Green-gold daylight through the broken rose window at the surface, deepening
 * through teal to near-black, with votive candles as the only warm light below
 * 400 m. Interpolation happens in OKLab (see `lib/colour.ts`), because a
 * straight sRGB mix between a warm green and a deep teal passes through a muddy
 * grey and bands visibly across a full-screen gradient — which is exactly the
 * artefact this game would show most.
 *
 * Every ramp is sampled into a preallocated object so a frame allocates nothing.
 */

export { css, shade, mixRgb, type Rgb }

/** A stop on the depth ramp: `at` is metres descended. */
type Stop = ColourStop

// --- The ramps --------------------------------------------------------------
// Read down a column to see the whole descent: light leaves the water first,
// then leaves the stone, and by 1600 m only the lantern and the candles remain.

const WATER_TOP: Stop[] = [
  { at: 0, color: [58, 96, 71] },
  { at: 180, color: [30, 76, 76] },
  { at: 460, color: [16, 58, 68] },
  { at: 900, color: [9, 34, 48] },
  { at: 1500, color: [5, 19, 30] },
  { at: 2400, color: [2, 9, 16] },
]

const WATER_DEEP: Stop[] = [
  { at: 0, color: [16, 50, 54] },
  { at: 180, color: [9, 39, 48] },
  { at: 460, color: [5, 25, 35] },
  { at: 900, color: [3, 14, 22] },
  { at: 1500, color: [1, 7, 12] },
  { at: 2400, color: [0, 3, 6] },
]

/** What distant geometry converges to. Slightly bluer than the water. */
const FOG: Stop[] = [
  { at: 0, color: [44, 86, 74] },
  { at: 460, color: [12, 46, 58] },
  { at: 1100, color: [5, 21, 32] },
  { at: 2400, color: [1, 6, 11] },
]

const STONE: Stop[] = [
  { at: 0, color: [54, 60, 46] },
  { at: 180, color: [38, 50, 50] },
  { at: 460, color: [25, 37, 43] },
  { at: 900, color: [16, 26, 33] },
  { at: 1500, color: [10, 17, 23] },
  { at: 2400, color: [6, 10, 15] },
]

/** Top faces and string courses catching the light from above. */
const STONE_LIT: Stop[] = [
  { at: 0, color: [198, 206, 158] },
  { at: 180, color: [148, 184, 172] },
  { at: 460, color: [104, 152, 156] },
  { at: 900, color: [66, 108, 122] },
  { at: 1500, color: [44, 76, 92] },
  { at: 2400, color: [28, 52, 64] },
]

/** Undersides, recesses and the mouths of the side chapels. */
const STONE_DARK: Stop[] = [
  { at: 0, color: [14, 20, 16] },
  { at: 460, color: [7, 14, 19] },
  { at: 1100, color: [3, 8, 12] },
  { at: 2400, color: [1, 3, 6] },
]

/** The lit corner where the wall meets the shaft â€” the game's key light. */
const RIM: Stop[] = [
  { at: 0, color: [255, 236, 170] },
  { at: 220, color: [206, 240, 216] },
  { at: 620, color: [150, 216, 214] },
  { at: 1200, color: [104, 168, 186] },
  { at: 2400, color: [70, 122, 146] },
]

/** God rays and caustics: gold at the surface, gone by the deep. */
const RAY: Stop[] = [
  { at: 0, color: [255, 226, 150] },
  { at: 260, color: [186, 232, 190] },
  { at: 700, color: [110, 188, 196] },
  { at: 1400, color: [58, 118, 142] },
]

export interface Palette {
  waterTop: Rgb
  waterDeep: Rgb
  fog: Rgb
  stone: Rgb
  stoneLit: Rgb
  stoneDark: Rgb
  rim: Rgb
  ray: Rgb
  /** 0 at the surface, 1 at full dark. Drives every "how deep are we" decision. */
  depthFraction: number
  /** How much daylight is still reaching this depth: 1 â†’ 0 by ~700 m. */
  daylight: number
  /** How strongly the candles read: 0 until ~260 m, then 1. */
  candlelight: number
}

export function createPalette(): Palette {
  return {
    waterTop: [0, 0, 0],
    waterDeep: [0, 0, 0],
    fog: [0, 0, 0],
    stone: [0, 0, 0],
    stoneLit: [0, 0, 0],
    stoneDark: [0, 0, 0],
    rim: [0, 0, 0],
    ray: [0, 0, 0],
    depthFraction: 0,
    daylight: 1,
    candlelight: 0,
  }
}

export function samplePalette(out: Palette, depth: number): Palette {
  sampleRamp(WATER_TOP, depth, out.waterTop)
  sampleRamp(WATER_DEEP, depth, out.waterDeep)
  sampleRamp(FOG, depth, out.fog)
  sampleRamp(STONE, depth, out.stone)
  sampleRamp(STONE_LIT, depth, out.stoneLit)
  sampleRamp(STONE_DARK, depth, out.stoneDark)
  sampleRamp(RIM, depth, out.rim)
  sampleRamp(RAY, depth, out.ray)
  out.depthFraction = Math.min(1, depth / 2400)
  // Daylight falls off like light in water: fast at first, then a long tail.
  out.daylight = Math.exp(-depth / 340)
  out.candlelight = Math.min(1, Math.max(0, (depth - 260) / 260))
  return out
}

/** Stained glass. Saturated colour survives longest because it is lit, not reflected. */
export const GLASS_HUES: readonly Rgb[] = [
  [58, 96, 214],   // lapis
  [206, 62, 92],   // rose madder
  [232, 168, 52],  // amber
  [46, 154, 126],  // verdigris
  [148, 72, 178],  // bishop's purple
]

export const EMBER: Rgb = [255, 176, 84]
export const LANTERN_COOL: Rgb = [124, 245, 192]
export const LANTERN_HOT: Rgb = [255, 214, 132]
