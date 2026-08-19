import { emptyInput, type ArcadeKey, type InputState } from './types.ts'

const KEY_MAP: Record<string, ArcadeKey> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Space: 'space',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
}

export interface InputManager {
  /** Keys currently held. Poll this from the simulation, never from event handlers. */
  readonly state: InputState
  /** Keys that transitioned to pressed since the last `beginFrame()`. */
  pressed(key: ArcadeKey): boolean
  /** Seconds a key has been held, 0 when released. */
  heldFor(key: ArcadeKey): number
  /** Call once per simulation step, before reading. Advances hold timers. */
  beginFrame(dt: number): void
  /** Call at the end of a simulation step to clear edge-triggered presses. */
  endFrame(): void
  destroy(): void
}

/**
 * Read a single grid direction, preferring a key that was *just* pressed over
 * one merely held. Without the edge check a quick tap between two simulation
 * steps is dropped entirely, which reads as the game ignoring your input.
 */
export function readDirection(input: InputManager): { dx: number; dy: number } {
  if (input.pressed('left')) return { dx: -1, dy: 0 }
  if (input.pressed('right')) return { dx: 1, dy: 0 }
  if (input.pressed('up')) return { dx: 0, dy: -1 }
  if (input.pressed('down')) return { dx: 0, dy: 1 }
  if (input.state.left) return { dx: -1, dy: 0 }
  if (input.state.right) return { dx: 1, dy: 0 }
  if (input.state.up) return { dx: 0, dy: -1 }
  if (input.state.down) return { dx: 0, dy: 1 }
  return { dx: 0, dy: 0 }
}

/**
 * Keyboard input for a keyboard-only arcade.
 *
 * Uses `event.code` so the physical key position is what matters regardless of
 * layout, suppresses auto-repeat, prevents the page scrolling on arrows/space,
 * and clears held keys on blur so nothing sticks when focus is lost.
 */
export function createInputManager(target: Window = window): InputManager {
  const state = emptyInput()
  const edges = emptyInput()
  const held: Record<ArcadeKey, number> = { left: 0, right: 0, up: 0, down: 0, space: 0 }

  const onKeyDown = (event: KeyboardEvent) => {
    const key = KEY_MAP[event.code]
    if (!key) return
    event.preventDefault()
    // An auto-repeat is not a new press, but it *is* proof the key is still
    // down — which is the only evidence a game gets when it mounts while the
    // player is already holding one. Dropping repeats outright meant holding
    // SPACE through "SPACE to start" left the key unregistered until it was
    // released and pressed again. Tracking the edge off our own state instead
    // suppresses repeat presses without throwing the hold away.
    if (!state[key]) edges[key] = true
    state[key] = true
  }

  const onKeyUp = (event: KeyboardEvent) => {
    const key = KEY_MAP[event.code]
    if (!key) return
    event.preventDefault()
    state[key] = false
    held[key] = 0
  }

  const onBlur = () => {
    for (const key of Object.keys(state) as ArcadeKey[]) {
      state[key] = false
      held[key] = 0
    }
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('blur', onBlur)

  return {
    state,
    pressed: (key) => edges[key],
    heldFor: (key) => held[key],
    beginFrame(dt) {
      for (const key of Object.keys(state) as ArcadeKey[]) {
        if (state[key]) held[key] += dt
      }
    },
    endFrame() {
      for (const key of Object.keys(edges) as ArcadeKey[]) edges[key] = false
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown)
      target.removeEventListener('keyup', onKeyUp)
      target.removeEventListener('blur', onBlur)
    },
  }
}
