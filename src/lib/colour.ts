/**
 * Perceptual colour.
 *
 * Every game here builds long colour ramps — a descent from daylight to
 * near-black, a cavern that shifts hue as it deepens — and those ramps are
 * drawn as full-screen gradients, which is the single worst case for sRGB
 * interpolation. A straight sRGB mix between two saturated colours passes
 * through a muddy grey and bands visibly across a phone screen. **OKLab** does
 * not, so all mixing here goes through it.
 *
 * Everything writes into caller-supplied arrays so a frame allocates nothing.
 */

export type Rgb = [number, number, number]

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

export interface ColourStop {
  /** Position along the ramp, in whatever unit the caller is ramping over. */
  at: number
  color: Rgb
}

/** Sample a ramp of stops sorted ascending by `at`. */
export function sampleRamp(stops: readonly ColourStop[], position: number, out: Rgb): Rgb {
  const first = stops[0]
  if (!first) return out
  if (position <= first.at) {
    out[0] = first.color[0]; out[1] = first.color[1]; out[2] = first.color[2]
    return out
  }
  for (let i = 1; i < stops.length; i++) {
    const previous = stops[i - 1]
    const current = stops[i]
    if (!previous || !current) break
    if (position <= current.at) {
      return mixRgb(previous.color, current.color, (position - previous.at) / (current.at - previous.at), out)
    }
  }
  const last = stops[stops.length - 1]
  if (last) { out[0] = last.color[0]; out[1] = last.color[1]; out[2] = last.color[2] }
  return out
}

export function css(color: Rgb, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${color[0]},${color[1]},${color[2]})`
    : `rgba(${color[0]},${color[1]},${color[2]},${alpha})`
}

const shadeScratch: Rgb = [0, 0, 0]

/** Lighten or darken toward white/black without leaving the hue behind. */
export function shade(color: Rgb, amount: number, alpha = 1): string {
  const target: Rgb = amount >= 0 ? [255, 255, 255] : [0, 0, 0]
  mixRgb(color, target, Math.abs(amount), shadeScratch)
  return css(shadeScratch, alpha)
}
