import type { GameModule, GameOptions, GameInstance } from '../../lib/types.ts'
import { createEmitter } from '../../lib/emitter.ts'
import { createRng } from '../../lib/prng.ts'
import { createInputManager } from '../../lib/input.ts'
import { createGameLoop } from '../../lib/loop.ts'
import {
  createJuice, TRAUMA_SMALL, TRAUMA_BIG, TRAUMA_CATASTROPHE,
  HITSTOP_SMALL, HITSTOP_LARGE, HITSTOP_HUGE,
} from '../../lib/juice.ts'
import { fitCanvas } from '../../lib/neon.ts'
import { getAudio } from '../../lib/audio.ts'
import { formatScore } from '../../lib/math.ts'
import { TABLE_HEIGHT, TABLE_WIDTH } from './table.ts'
import { createState, currentConfig, step, type GlassworksState } from './simulation.ts'
import { render } from './renderer.ts'

const glassworks: GameModule = {
  mount(canvas: HTMLCanvasElement, options: GameOptions): GameInstance {
    const emitter = createEmitter()
    const rng = createRng(options.seed)
    const input = createInputManager()
    const juice = createJuice(512)
    const audio = getAudio()

    const state: GlassworksState = createState(rng)
    let size = fitCanvas(canvas)
    let finished = false

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available in this browser')

    const onResize = () => { size = fitCanvas(canvas) }
    window.addEventListener('resize', onResize)

    // Table space to screen space, so effects land where the physics says.
    const toScreen = (x: number, y: number) => {
      const scale = Math.min(size.width / TABLE_WIDTH, size.height / TABLE_HEIGHT) * 0.96
      return {
        x: (size.width - TABLE_WIDTH * scale) / 2 + x * scale,
        y: (size.height - TABLE_HEIGHT * scale) / 2 + y * scale,
        scale,
      }
    }

    const emitHud = () => {
      emitter.emit('hud', {
        score: state.score,
        primaryLabel: 'MISSIONS',
        primaryValue: String(state.missionsComplete),
        secondaryLabel: 'BALLS',
        secondaryValue: String(Math.max(0, state.ballsRemaining)),
      })
    }

    const finish = () => {
      if (finished) return
      finished = true
      audio.play({ frequency: 160, endFrequency: 44, duration: 1.1, waveform: 'sawtooth', volume: 0.4 })
      emitter.emit('gameover', {
        score: state.score,
        summary: state.missionsComplete > 0
          ? `The glass settled after ${state.missionsComplete} rebuild${state.missionsComplete === 1 ? '' : 's'}.`
          : 'Three balls, no missions. The table never changed shape.',
        stats: [
          { label: 'MISSIONS', value: String(state.missionsComplete) },
          { label: 'JACKPOTS', value: String(state.jackpots) },
          { label: 'BUMPERS', value: formatScore(state.bumperHits) },
          { label: 'TABLE', value: currentConfig(state).name },
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

        const events = step(state, {
          leftFlipper: input.state.left,
          rightFlipper: input.state.right,
          raiseDiverter: input.pressed('up'),
          dropDiverter: input.pressed('down'),
          // SPACE is the plunger before launch and the nudge afterwards.
          nudge: state.phase === 'play' && input.pressed('space'),
          plungerHeld: state.phase === 'plunger' ? input.heldFor('space') : 0,
        }, dt, rng)

        for (const hit of events.bumper ?? []) {
          const point = toScreen(hit.x, hit.y)
          juice.addTrauma(TRAUMA_SMALL)
          juice.burst(point.x, point.y, {
            count: 10, speed: [60, 220], life: [0.2, 0.45], hue: 312,
          })
          audio.play({ frequency: 520, endFrequency: 780, duration: 0.09, volume: 0.24 })
        }

        for (const hit of events.wallHit ?? []) {
          const point = toScreen(hit.x, hit.y)
          juice.burst(point.x, point.y, {
            count: 4, speed: [30, 120], life: [0.15, 0.3], hue: 240,
          })
          audio.play({
            frequency: 200 + hit.speed * 6,
            duration: 0.05,
            waveform: 'triangle',
            volume: Math.min(0.22, hit.speed / 200),
          })
        }

        if (events.launched) {
          audio.play({ frequency: 180, endFrequency: 620, duration: 0.3, waveform: 'sawtooth', volume: 0.32 })
        }
        if (events.targetHit) {
          juice.addTrauma(TRAUMA_SMALL)
          juice.freeze(HITSTOP_SMALL)
          audio.play({ frequency: 880, endFrequency: 1320, duration: 0.16, volume: 0.3 })
        }
        if (events.diverted) {
          audio.play({ frequency: 300, endFrequency: 180, duration: 0.14, waveform: 'square', volume: 0.24 })
        }
        if (events.missionComplete) {
          juice.addTrauma(TRAUMA_BIG)
          juice.freeze(HITSTOP_LARGE)
          juice.burst(size.width / 2, size.height / 2, {
            count: 50, speed: [80, 420], life: [0.5, 1.4], hue: 312,
          })
          audio.play({ frequency: 440, endFrequency: 1760, duration: 0.8, waveform: 'sine', volume: 0.44 })
        }
        if (events.rebuilt) {
          juice.addTrauma(TRAUMA_BIG)
          audio.play({ frequency: 120, endFrequency: 480, duration: 1, waveform: 'sawtooth', volume: 0.34 })
        }
        if (events.tilted) {
          juice.addTrauma(TRAUMA_CATASTROPHE)
          audio.noise(0.5, 0.4, 400)
        }
        if (events.drained) {
          juice.addTrauma(TRAUMA_BIG)
          juice.freeze(HITSTOP_SMALL)
          audio.play({ frequency: 220, endFrequency: 70, duration: 0.5, waveform: 'triangle', volume: 0.34 })
        }
        if (events.gameOver) {
          juice.addTrauma(TRAUMA_CATASTROPHE)
          juice.freeze(HITSTOP_HUGE)
          finish()
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

export default glassworks
