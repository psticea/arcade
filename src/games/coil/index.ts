import type { GameModule, GameOptions, GameInstance } from '../../lib/types.ts'
import { createEmitter } from '../../lib/emitter.ts'
import { createRng } from '../../lib/prng.ts'
import { createInputManager, readDirection } from '../../lib/input.ts'
import { createGameLoop } from '../../lib/loop.ts'
import { createJuice, TRAUMA_SMALL, TRAUMA_BIG, TRAUMA_CATASTROPHE, HITSTOP_SMALL, HITSTOP_HUGE } from '../../lib/juice.ts'
import { fitCanvas } from '../../lib/neon.ts'
import { getAudio } from '../../lib/audio.ts'
import { GRID_SIZE, SPRINT_SECONDS, createState, step, timeRemaining, type CoilState } from './simulation.ts'
import { render } from './renderer.ts'

const coil: GameModule = {
  mount(canvas: HTMLCanvasElement, options: GameOptions): GameInstance {
    const emitter = createEmitter()
    const rng = createRng(options.seed)
    const input = createInputManager()
    const juice = createJuice(256)
    const audio = getAudio()
    const mode = options.mode === 'sprint' ? 'sprint' : 'endless'

    let state: CoilState = createState(rng, mode)
    let size = fitCanvas(canvas)
    let finished = false

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available in this browser')

    const onResize = () => { size = fitCanvas(canvas) }
    window.addEventListener('resize', onResize)

    const boardOrigin = () => {
      const board = Math.min(size.width, size.height) * 0.82
      return { board, cell: board / GRID_SIZE }
    }

    const emitHud = () => {
      emitter.emit('hud', {
        score: state.score,
        primaryLabel: 'COMBO',
        primaryValue: `x${state.combo}`,
        secondaryLabel: mode === 'sprint' ? 'TIME' : 'LENGTH',
        secondaryValue: mode === 'sprint'
          ? timeRemaining(state).toFixed(1)
          : String(state.snake.length),
      })
    }

    const finish = (cause: string) => {
      if (finished) return
      finished = true
      audio.play({ frequency: 220, endFrequency: 60, duration: 0.7, waveform: 'sawtooth', volume: 0.4 })
      const summary = cause === 'timeup'
        ? 'Time. The arena settles.'
        : cause === 'wall'
          ? 'You met the border.'
          : 'You folded into your own body.'
      emitter.emit('gameover', {
        score: state.score,
        summary,
        stats: [
          { label: 'BEST COMBO', value: `x${state.bestCombo}` },
          { label: 'HOT TAKEN', value: String(state.hotEaten) },
          { label: 'LENGTH', value: String(state.snake.length) },
          { label: 'TIME', value: `${state.elapsed.toFixed(1)}s` },
        ],
      })
    }

    const loop = createGameLoop({
      step(dt) {
        if (finished) return
        input.beginFrame(dt)
        if (!juice.update(dt)) {
          input.endFrame()
          return
        }

        const direction = readDirection(input)
        const events = step(state, {
          dx: direction.dx,
          dy: direction.dy,
          phase: input.pressed('space'),
        }, dt, rng)

        const { cell } = boardOrigin()
        const head = state.snake[0]
        if (events.ate && head) {
          const hot = events.ate === 'hot'
          juice.addTrauma(hot ? TRAUMA_BIG : TRAUMA_SMALL)
          juice.freeze(hot ? HITSTOP_SMALL : 0)
          juice.burst((head.x + 0.5) * cell, (head.y + 0.5) * cell, {
            count: hot ? 18 : 8,
            speed: [50, 200],
            life: [0.3, 0.6],
            hue: hot ? 336 : 220,
          })
          audio.play(hot
            ? { frequency: 520 + state.combo * 40, endFrequency: 900 + state.combo * 60, duration: 0.16, volume: 0.35 }
            : { frequency: 320, endFrequency: 420, duration: 0.1, volume: 0.22 })
        }
        if (events.phased) {
          audio.play({ frequency: 1200, endFrequency: 400, duration: 0.25, waveform: 'sine', volume: 0.3 })
        }
        if (events.rotated) {
          juice.addTrauma(TRAUMA_SMALL)
          audio.play({ frequency: 180, endFrequency: 360, duration: 0.5, waveform: 'triangle', volume: 0.3 })
        }
        if (events.died) {
          juice.addTrauma(TRAUMA_CATASTROPHE)
          juice.freeze(HITSTOP_HUGE)
          if (head) {
            juice.burst((head.x + 0.5) * cell, (head.y + 0.5) * cell, {
              count: 40, speed: [60, 320], life: [0.5, 1.2], hue: 150,
            })
          }
          finish(events.died)
        }

        input.endFrame()
        emitHud()
      },
      render() {
        render(ctx, state, juice, size.width, size.height)
      },
    })

    emitHud()
    loop.start()

    return {
      pause: () => loop.pause(),
      resume: () => loop.resume(),
      destroy() {
        loop.stop()
        input.destroy()
        window.removeEventListener('resize', onResize)
        emitter.clear()
      },
      on: emitter.on,
    }
  },
}

export default coil
export { SPRINT_SECONDS }
