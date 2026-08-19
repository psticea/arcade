/**
 * Fixed-timestep game loop.
 *
 * Simulation always advances in whole `FIXED_DT` steps so behaviour is identical
 * at 60 Hz and 144 Hz, and the accumulator is clamped so a backgrounded tab does
 * not fast-forward the run when it regains focus.
 */

export const FIXED_DT = 1 / 120
const MAX_FRAME_TIME = 0.25

export interface LoopCallbacks {
  /** Advance the simulation exactly `FIXED_DT` seconds. */
  step(dt: number): void
  /** Draw. `alpha` is the 0..1 blend between the previous and current step. */
  render(alpha: number): void
}

export interface GameLoop {
  start(): void
  stop(): void
  pause(): void
  resume(): void
  readonly running: boolean
}

export function createGameLoop(callbacks: LoopCallbacks): GameLoop {
  let rafId = 0
  let previousTime = 0
  let accumulator = 0
  let active = false
  let paused = false

  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)

    const seconds = now / 1000
    if (previousTime === 0) {
      previousTime = seconds
      return
    }

    let frameTime = seconds - previousTime
    previousTime = seconds
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME

    if (!paused) {
      accumulator += frameTime
      while (accumulator >= FIXED_DT) {
        callbacks.step(FIXED_DT)
        accumulator -= FIXED_DT
      }
    }

    callbacks.render(paused ? 0 : accumulator / FIXED_DT)
  }

  const onVisibility = () => {
    if (document.hidden) {
      previousTime = 0
      accumulator = 0
    }
  }

  return {
    get running() {
      return active && !paused
    },
    start() {
      if (active) return
      active = true
      paused = false
      previousTime = 0
      accumulator = 0
      document.addEventListener('visibilitychange', onVisibility)
      rafId = requestAnimationFrame(frame)
    },
    stop() {
      if (!active) return
      active = false
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
    },
    pause() {
      paused = true
    },
    resume() {
      if (!paused) return
      paused = false
      previousTime = 0
      accumulator = 0
    },
  }
}
