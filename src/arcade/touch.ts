import type { ArcadeKey } from '../lib/types.ts'

/**
 * Touch support.
 *
 * On-screen controls drive the games by dispatching the same keyboard events a
 * physical key would. Everything downstream — the games' input manager, the
 * pause handler, the menus, the initials entry — already listens for those, so
 * touch needs no special case anywhere else.
 */

const CODES: Record<ArcadeKey, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  space: 'Space',
}

/** True on devices whose primary pointer cannot hover, i.e. touchscreens. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches === true
    || (navigator.maxTouchPoints ?? 0) > 0
}

export function holdKey(key: ArcadeKey): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: CODES[key], bubbles: true }))
}

export function releaseKey(key: ArcadeKey): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { code: CODES[key], bubbles: true }))
}

/** A momentary press, for menus and one-shot actions. */
export function tapKey(key: ArcadeKey): void {
  holdKey(key)
  window.setTimeout(() => releaseKey(key), 60)
}

export function pressEscape(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
  window.setTimeout(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', bubbles: true }))
  }, 60)
}
