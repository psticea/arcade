/**
 * BALLAST palette — the descent is one continuous hue journey.
 *
 * Green-gold daylight through the broken rose window at the surface, deepening
 * through teal to near-black, with votive candles as the only warm light below
 * 400 m. Stops are interpolated in **OKLab** rather than sRGB: a straight sRGB
 * mix between a warm green and a deep teal passes through a muddy grey and
 * bands visibly across a full-screen gradient, which is exactly the artefact
 * this game would show most.
 *
 * Every ramp is sampled into a preallocated object so a frame allocates nothing.
 */

export type Rgb = [number, number, number]

interface Stop {
  depth: number
  color: Rgb
}

// --- OKLab ------------------------------------------------------------------

function toLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function toSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(v * 255)))
}

const labScratchA: Rgb = [0, 0, 0]
const labScratchB: Rgb = [0, 0, 0]

function rgbToOklab(rgb: Rgb, out: Rgb): Rgb {
  const r = toLinear(rgb[0])
  const g = toLinear(rgb[1])
  const b = toLinear(rgb[2])

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  out[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  out[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  out[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return out
}

function oklabToRgb(lab: Rgb, out: Rgb): Rgb {
  const l_ = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2]
  const m_ = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2]
  const s_ = lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2]

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  out[0] = toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  out[1] = toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  out[2] = toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  return out
}

/** Perceptual mix. `t` is clamped, so callers need not. */
export function mixRgb(a: Rgb, b: Rgb, t: number, out: Rgb): Rgb {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t
  rgbToOklab(a, labScratchA)
  rgbToOklab(b, labScratchB)
  labScratchA[0] += (labScratchB[0] - labScratchA[0]) * k
  labScratchA[1] += (labScratchB[1] - labScratchA[1]) * k
  labScratchA[2] += (labScratchB[2] - labScratchA[2]) * k
  return oklabToRgb(labScratchA, out)
}

function sampleRamp(stops: readonly Stop[], depth: number, out: Rgb): Rgb {
  const first = stops[0]
  if (!first) return out
  if (depth <= first.depth) {
    out[0] = first.color[0]; out[1] = first.color[1]; out[2] = first.color[2]
    return out
  }
  for (let i = 1; i < stops.length; i++) {
    const previous = stops[i - 1]
    const current = stops[i]
    if (!previous || !current) break
    if (depth <= current.depth) {
      const t = (depth - previous.depth) / (current.depth - previous.depth)
      return mixRgb(previous.color, current.color, t, out)
    }
  }
  const last = stops[stops.length - 1]
  if (last) { out[0] = last.color[0]; out[1] = last.color[1]; out[2] = last.color[2] }
  return out
}

// --- The ramps --------------------------------------------------------------
// Read down a column to see the whole descent: light leaves the water first,
// then leaves the stone, and by 1600 m only the lantern and the candles remain.

const WATER_TOP: Stop[] = [
  { depth: 0, color: [58, 96, 71] },
  { depth: 180, color: [30, 76, 76] },
  { depth: 460, color: [16, 58, 68] },
  { depth: 900, color: [9, 34, 48] },
  { depth: 1500, color: [5, 19, 30] },
  { depth: 2400, color: [2, 9, 16] },
]

const WATER_DEEP: Stop[] = [
  { depth: 0, color: [16, 50, 54] },
  { depth: 180, color: [9, 39, 48] },
  { depth: 460, color: [5, 25, 35] },
  { depth: 900, color: [3, 14, 22] },
  { depth: 1500, color: [1, 7, 12] },
  { depth: 2400, color: [0, 3, 6] },
]

/** What distant geometry converges to. Slightly bluer than the water. */
const FOG: Stop[] = [
  { depth: 0, color: [44, 86, 74] },
  { depth: 460, color: [12, 46, 58] },
  { depth: 1100, color: [5, 21, 32] },
  { depth: 2400, color: [1, 6, 11] },
]

const STONE: Stop[] = [
  { depth: 0, color: [54, 60, 46] },
  { depth: 180, color: [38, 50, 50] },
  { depth: 460, color: [25, 37, 43] },
  { depth: 900, color: [16, 26, 33] },
  { depth: 1500, color: [10, 17, 23] },
  { depth: 2400, color: [6, 10, 15] },
]

/** Top faces and string courses catching the light from above. */
const STONE_LIT: Stop[] = [
  { depth: 0, color: [198, 206, 158] },
  { depth: 180, color: [148, 184, 172] },
  { depth: 460, color: [104, 152, 156] },
  { depth: 900, color: [66, 108, 122] },
  { depth: 1500, color: [44, 76, 92] },
  { depth: 2400, color: [28, 52, 64] },
]

/** Undersides, recesses and the mouths of the side chapels. */
const STONE_DARK: Stop[] = [
  { depth: 0, color: [14, 20, 16] },
  { depth: 460, color: [7, 14, 19] },
  { depth: 1100, color: [3, 8, 12] },
  { depth: 2400, color: [1, 3, 6] },
]

/** The lit corner where the wall meets the shaft — the game's key light. */
const RIM: Stop[] = [
  { depth: 0, color: [255, 236, 170] },
  { depth: 220, color: [206, 240, 216] },
  { depth: 620, color: [150, 216, 214] },
  { depth: 1200, color: [104, 168, 186] },
  { depth: 2400, color: [70, 122, 146] },
]

/** God rays and caustics: gold at the surface, gone by the deep. */
const RAY: Stop[] = [
  { depth: 0, color: [255, 226, 150] },
  { depth: 260, color: [186, 232, 190] },
  { depth: 700, color: [110, 188, 196] },
  { depth: 1400, color: [58, 118, 142] },
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
  /** How much daylight is still reaching this depth: 1 → 0 by ~700 m. */
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

const cssScratch: Rgb = [0, 0, 0]

export function css(color: Rgb, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${color[0]},${color[1]},${color[2]})`
    : `rgba(${color[0]},${color[1]},${color[2]},${alpha})`
}

/** Lighten or darken toward white/black without leaving the hue behind. */
export function shade(color: Rgb, amount: number, alpha = 1): string {
  const target: Rgb = amount >= 0 ? [255, 255, 255] : [0, 0, 0]
  mixRgb(color, target, Math.abs(amount), cssScratch)
  return css(cssScratch, alpha)
}
