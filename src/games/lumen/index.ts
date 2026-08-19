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
import { getAudio, type DroneHandle } from '../../lib/audio.ts'
import { LIGHT_CAPACITY, createState, step, type LumenState } from './simulation.ts'
import { render } from './renderer.ts'

const lumen: GameModule = {
  mount(canvas: HTMLCanvasElement, options: GameOptions): GameInstance {
    const emitter = createEmitter()
    const rng = createRng(options.seed)
    const input = createInputManager()
    const juice = createJuice(512)
    const audio = getAudio()

    const state: LumenState = createState(rng)
    let size = fitCanvas(canvas)
    let finished = false
    let drone: DroneHandle | undefined
    let lastMultiplier = state.multiplier

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available in this browser')

    const onResize = () => { size = fitCanvas(canvas) }
    window.addEventListener('resize', onResize)

    const radius = () => Math.min(size.width, size.height) * 0.42
    const toScreen = (angle: number, depth: number) => {
      const theta = (angle / state.segments) * Math.PI * 2 - Math.PI / 2
      const r = depth * radius()
      return { x: Math.cos(theta) * r, y: Math.sin(theta) * r }
    }

    const emitHud = () => {
      emitter.emit('hud', {
        score: state.score,
        primaryLabel: 'MULT',
        primaryValue: `x${state.multiplier}`,
        secondaryLabel: 'WAVE',
        secondaryValue: String(state.wave + 1),
        gauge: state.light / LIGHT_CAPACITY,
        gaugeLabel: 'LIGHT',
      })
    }

    const finish = () => {
      if (finished) return
      finished = true
      drone?.stop()
      drone = undefined
      audio.play({ frequency: 320, endFrequency: 40, duration: 1.2, waveform: 'sine', volume: 0.42 })
      emitter.emit('gameover', {
        score: state.score,
        summary: 'The last of the light left the well. The tunnel went dark.',
        stats: [
          { label: 'MOTES', value: String(state.motesCaught) },
          { label: 'DEEP', value: String(state.deepCaught) },
          { label: 'ESCAPED', value: String(state.motesEscaped) },
          { label: 'WAVE', value: String(state.wave + 1) },
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
          left: input.state.left,
          right: input.state.right,
          dive: input.pressed('up'),
          gatherHeld: input.heldFor('down'),
          bloom: input.pressed('space'),
          bloomHeld: input.heldFor('space'),
        }, dt, rng)

        if (!drone) drone = audio.drone(55, 0.045)
        if (state.multiplier !== lastMultiplier) {
          lastMultiplier = state.multiplier
          // The drone rises a semitone per multiplier tier: greed you can hear.
          drone?.setFrequency(55 * Math.pow(2, (state.multiplier - 1) / 12))
        }

        for (const caught of events.caught ?? []) {
          const point = toScreen(caught.angle, caught.depth)
          const deep = caught.kind === 'deep'
          juice.addTrauma(deep ? TRAUMA_BIG : TRAUMA_SMALL * 0.6)
          if (deep) juice.freeze(HITSTOP_SMALL)
          juice.burst(point.x, point.y, {
            count: deep ? 22 : 9,
            speed: [40, deep ? 240 : 150],
            life: [0.25, deep ? 0.9 : 0.5],
            hue: deep ? 45 : 190,
            inward: true,
          })
          audio.play(deep
            ? { frequency: 660 + state.multiplier * 30, endFrequency: 1320, duration: 0.28, waveform: 'sine', volume: 0.38 }
            : { frequency: 880, endFrequency: 1180, duration: 0.09, waveform: 'sine', volume: 0.2 })
        }

        if (events.escaped) {
          juice.addTrauma(TRAUMA_BIG)
          juice.freeze(HITSTOP_SMALL)
          audio.play({ frequency: 300, endFrequency: 120, duration: 0.35, waveform: 'triangle', volume: 0.34 })
        }
        if (events.dived) {
          audio.play({ frequency: 700, endFrequency: 220, duration: 0.4, waveform: 'sine', volume: 0.26 })
        }
        if (events.diveBlocked) {
          juice.addTrauma(TRAUMA_SMALL)
          audio.noise(0.16, 0.28, 500)
        }
        if (events.gathered) {
          juice.addTrauma(TRAUMA_SMALL)
          audio.play({ frequency: 220, endFrequency: 880, duration: 0.6, waveform: 'sine', volume: 0.3 })
        }
        if (events.spireDissolved !== undefined) {
          audio.play({ frequency: 500, endFrequency: 1500, duration: 0.34, waveform: 'triangle', volume: 0.3 })
        }
        if (events.waveCleared) {
          juice.addTrauma(TRAUMA_BIG)
          juice.freeze(HITSTOP_LARGE)
          audio.play({ frequency: 440, endFrequency: 1760, duration: 0.9, waveform: 'sine', volume: 0.4 })
        }
        if (events.died) {
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
      pause() {
        loop.pause()
        drone?.setVolume(0)
      },
      resume() {
        loop.resume()
        drone?.setVolume(0.045)
      },
      destroy() {
        loop.stop()
        drone?.stop()
        input.destroy()
        window.removeEventListener('resize', onResize)
        emitter.clear()
      },
      on: emitter.on,
    }
  },
}

export default lumen
