import type { GameModule, GameOptions, GameInstance } from '../../lib/types.ts'
import { createEmitter } from '../../lib/emitter.ts'
import { createRng } from '../../lib/prng.ts'
import { createInputManager } from '../../lib/input.ts'
import { createGameLoop } from '../../lib/loop.ts'
import { createJuice, TRAUMA_SMALL, TRAUMA_CATASTROPHE, HITSTOP_HUGE } from '../../lib/juice.ts'
import { fitCanvas } from '../../lib/neon.ts'
import { getAudio, type DroneHandle } from '../../lib/audio.ts'
import {
  PROXIMITY_BAND,
  createState,
  distanceToStone,
  effectiveMultiplier,
  isEarning,
  step,
  type BallastState,
} from './simulation.ts'
import { render } from './renderer.ts'

const ballast: GameModule = {
  mount(canvas: HTMLCanvasElement, options: GameOptions): GameInstance {
    const emitter = createEmitter()
    const rng = createRng(options.seed)
    const input = createInputManager()
    const juice = createJuice(384)
    const audio = getAudio()

    const state: BallastState = createState(rng)
    let size = fitCanvas(canvas)
    let finished = false
    let drone: DroneHandle | undefined
    let harmonic: DroneHandle | undefined

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available in this browser')

    const onResize = () => { size = fitCanvas(canvas) }
    window.addEventListener('resize', onResize)

    const emitHud = () => {
      emitter.emit('hud', {
        score: state.score,
        primaryLabel: 'DEPTH',
        primaryValue: `${Math.floor(state.depth)}m`,
        secondaryLabel: 'MULT',
        secondaryValue: `x${effectiveMultiplier(state).toFixed(1)}`,
      })
    }

    const finish = () => {
      if (finished) return
      finished = true
      drone?.stop()
      harmonic?.stop()
      drone = undefined
      harmonic = undefined
      // The loudest sound in the game is the one that ends it.
      audio.play({ frequency: 96, endFrequency: 42, duration: 2.2, waveform: 'sine', volume: 0.5 })
      audio.play({ frequency: 144, endFrequency: 60, duration: 1.8, waveform: 'triangle', volume: 0.3 })

      emitter.emit('gameover', {
        score: state.score,
        // The specific sentence a player repeats to a friend.
        summary: `${Math.floor(state.depth)} metres, best hold x${state.bestMultiplier.toFixed(1)} — it broke at ${Math.floor(state.bestMultiplierDepth)}m.`,
        stats: [
          { label: 'DEPTH', value: `${Math.floor(state.depth)}m` },
          { label: 'BEST MULT', value: `x${state.bestMultiplier.toFixed(1)}` },
          { label: 'FLIPS', value: String(state.flips) },
          { label: 'DOUBLE FLIPS', value: String(state.doubleFlips) },
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

        const events = step(state, { flip: input.pressed('space') }, dt, rng)

        if (!drone) {
          drone = audio.drone(38, 0.05)
          harmonic = audio.drone(76, 0.02)
        }
        // The drone tracks sink speed; the harmonic tracks the multiplier and
        // snaps back on a flip, so greed is audible as it accumulates.
        drone?.setFrequency(30 + state.sinkSpeed * 0.5)
        harmonic?.setFrequency(76 * Math.pow(2, Math.min(state.multiplier, 16) / 14))
        harmonic?.setVolume(isEarning(state) ? 0.035 : 0.008)

        if (events.flipped && !events.doubleFlip) {
          audio.play({ frequency: 250, endFrequency: 150, duration: 0.18, waveform: 'sine', volume: 0.2 })
        }
        if (events.doubleFlip) {
          audio.play({ frequency: 520, endFrequency: 700, duration: 0.14, waveform: 'sine', volume: 0.24 })
        }
        if (events.died) {
          juice.addTrauma(TRAUMA_CATASTROPHE)
          juice.freeze(HITSTOP_HUGE)
          juice.burst(size.width / 2, size.height * 0.32, {
            count: 44, speed: [60, 300], life: [0.5, 1.4], hue: 160,
          })
          finish()
        }

        // Turbulence while riding the stone: the feedback that teaches
        // wall-riding without any tutorial text.
        if (state.alive && isEarning(state)) {
          const proximity = 1 - distanceToStone(state) / PROXIMITY_BAND
          if (Math.random() < proximity * 0.55) {
            juice.burst(size.width / 2, size.height * 0.32, {
              count: 1, speed: [20, 70], life: [0.2, 0.5], size: [1, 2.4], hue: 150,
            })
          }
          if (proximity > 0.82) juice.addTrauma(TRAUMA_SMALL * 0.08)
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
        harmonic?.setVolume(0)
      },
      resume() {
        loop.resume()
        drone?.setVolume(0.05)
      },
      destroy() {
        loop.stop()
        drone?.stop()
        harmonic?.stop()
        input.destroy()
        window.removeEventListener('resize', onResize)
        emitter.clear()
      },
      on: emitter.on,
    }
  },
}

export default ballast
