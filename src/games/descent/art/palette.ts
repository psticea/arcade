import { css, sampleRamp, shade, type ColourStop, type Rgb } from '../../../lib/colour.ts'

/**
 * DESCENT palette.
 *
 * The run is a journey *into* rock, so the ramp is keyed to the cavern number
 * rather than to a position on screen: the first cave is cold grey basalt near
 * the surface, and by the tenth the drone is in iron-red depths where the only
 * things that are not rock are the crystal seams and its own lamp.
 *
 * Everything is mixed in OKLab (see `lib/colour.ts`) and sampled into a
 * preallocated object, so a frame allocates nothing.
 */

export { css, shade, type Rgb }

type Stop = ColourStop

/** Rock in full light — what the drone's lamp reveals when it is close. */
const ROCK: Stop[] = [
  { at: 0, color: [138, 148, 166] },
  { at: 3, color: [146, 136, 140] },
  { at: 6, color: [158, 124, 112] },
  { at: 10, color: [168, 112, 94] },
  { at: 16, color: [150, 92, 82] },
]

/** Rock deep in the mass. Never pure black: the cave still has to read as a place. */
const ROCK_DARK: Stop[] = [
  { at: 0, color: [30, 36, 50] },
  { at: 6, color: [36, 30, 38] },
  { at: 12, color: [42, 26, 28] },
  { at: 16, color: [38, 22, 24] },
]

/** The lit arris along the top of every rock mass. */
const ROCK_RIM: Stop[] = [
  { at: 0, color: [196, 214, 240] },
  { at: 4, color: [212, 198, 200] },
  { at: 9, color: [230, 178, 148] },
  { at: 16, color: [218, 146, 124] },
]

/** Far cavern walls, seen through dust. */
const HAZE: Stop[] = [
  { at: 0, color: [44, 56, 82] },
  { at: 5, color: [52, 46, 66] },
  { at: 10, color: [60, 40, 48] },
  { at: 16, color: [50, 32, 38] },
]

/**
 * Ambient light, and therefore the floor the light map starts from.
 *
 * This single ramp is the exposure control for the whole game. Too low and the
 * cave stops being navigable; too high and the drone's lamp stops mattering,
 * which would throw away the reason the game is dark in the first place.
 */
const AMBIENT: Stop[] = [
  { at: 0, color: [96, 108, 136] },
  { at: 4, color: [96, 88, 114] },
  { at: 9, color: [96, 72, 84] },
  { at: 16, color: [84, 60, 68] },
]

/** Mineral seams. The only saturated colour in the rock, and it shifts by depth. */
const SEAM: Stop[] = [
  { at: 0, color: [96, 200, 224] },
  { at: 4, color: [126, 200, 168] },
  { at: 8, color: [198, 190, 104] },
  { at: 12, color: [232, 152, 80] },
  { at: 16, color: [238, 104, 94] },
]

export interface CavernPalette {
  rock: Rgb
  rockDark: Rgb
  rim: Rgb
  haze: Rgb
  ambient: Rgb
  seam: Rgb
  /** 0..1 how deep into the run we are, for anything that just needs a dial. */
  depth: number
}

export function createCavernPalette(): CavernPalette {
  return {
    rock: [0, 0, 0],
    rockDark: [0, 0, 0],
    rim: [0, 0, 0],
    haze: [0, 0, 0],
    ambient: [0, 0, 0],
    seam: [0, 0, 0],
    depth: 0,
  }
}

export function sampleCavernPalette(out: CavernPalette, cavern: number): CavernPalette {
  sampleRamp(ROCK, cavern, out.rock)
  sampleRamp(ROCK_DARK, cavern, out.rockDark)
  sampleRamp(ROCK_RIM, cavern, out.rim)
  sampleRamp(HAZE, cavern, out.haze)
  sampleRamp(AMBIENT, cavern, out.ambient)
  sampleRamp(SEAM, cavern, out.seam)
  out.depth = Math.min(1, cavern / 16)
  return out
}

/** The drone's lamp, its exhaust, and the three approach states of a pad. */
export const LAMP: Rgb = [255, 240, 214]
export const EXHAUST: Rgb = [255, 176, 88]
export const EXHAUST_HARD: Rgb = [255, 122, 64]
export const APPROACH_GOOD: Rgb = [72, 255, 168]
export const APPROACH_FAIR: Rgb = [255, 206, 96]
export const APPROACH_BAD: Rgb = [255, 82, 106]
export const HULL: Rgb = [206, 214, 232]
export const HULL_DARK: Rgb = [44, 52, 68]

/** Colour for the current approach quality: the only instrument in the game. */
export function approachColour(quality: number): Rgb {
  return quality > 0.66 ? APPROACH_GOOD : quality > 0.33 ? APPROACH_FAIR : APPROACH_BAD
}
