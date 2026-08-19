import type { GameModule, GameOptions, GameInstance } from '../../lib/types.ts'
import { createEmitter } from '../../lib/emitter.ts'
import { createRng } from '../../lib/prng.ts'
import { createInputManager } from '../../lib/input.ts'
import { createGameLoop } from '../../lib/loop.ts'
import {
  createJuice, TRAUMA_SMALL, TRAUMA_BIG, TRAUMA_CATASTROPHE,
  HITSTOP_LARGE, HITSTOP_HUGE,
} from '../../lib/juice.ts'
import { fitCanvas } from '../../lib/neon.ts'
import { getAudio, type DroneHandle } from '../../lib/audio.ts'
import {
  FUEL_CAPACITY, createState, nextCavern, step, type DescentState,
} from './simulation.ts'
import { createView, render, updateView } from './renderer.ts'

/** Beat between a resolved landing and the next cavern, so the result lands. */
const CAVERN_PAUSE = 1.6

const descent: GameModule = {
  mount(canvas: HTMLCanvasElement, options: GameOptions): GameInstance {
    const emitter = createEmitter()
    const rng = createRng(options.seed)
    const input = createInputManager()
    const juice = createJuice(400)
    const audio = getAudio()

    const state: DescentState = createState(rng, options.seed)
    // Presentation draws from its own stream, so adding a dust mote never
    // changes the cavern the pilot is flying.
    const view = createView(createRng(options.seed ^ 0x2b1c4d), state)
    let size = fitCanvas(canvas)
    let finished = false
    let transition = 0
    let hardBurn = false
    let thrustDrone: DroneHandle | undefined

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available in this browser')

    const onResize = () => { size = fitCanvas(canvas) }
    window.addEventListener('resize', onResize)

    const emitHud = () => {
      emitter.emit('hud', {
        score: state.score,
        primaryLabel: 'RUN MULT',
        primaryValue: `x${state.runMultiplier}`,
        secondaryLabel: 'CAVERN',
        secondaryValue: String(state.cavern + 1),
        gauge: state.fuel / FUEL_CAPACITY,
        gaugeLabel: 'FUEL',
      })
    }

    const finish = (reason: 'wrecked' | 'dry') => {
      if (finished) return
      finished = true
      thrustDrone?.stop()
      thrustDrone = undefined
      audio.play({ frequency: 180, endFrequency: 48, duration: 0.9, waveform: 'sawtooth', volume: 0.42 })

      const landing = state.lastLanding
      const summary = reason === 'dry'
        ? 'Tanks dry. The drone came down where it fell.'
        : landing && landing.padMultiplier === 0
          ? 'Touched down off-pad. The drone tipped over.'
          : 'Came in too hard. The drone tipped over.'

      emitter.emit('gameover', {
        score: state.score,
        summary,
        stats: [
          { label: 'LANDINGS', value: String(state.landings) },
          { label: 'PERFECT', value: String(state.perfectLandings) },
          { label: 'RUN MULT', value: `x${state.runMultiplier}` },
          { label: 'FUEL LEFT', value: `${Math.round((state.fuel / FUEL_CAPACITY) * 100)}%` },
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

        if (state.phase === 'landed') {
          transition += dt
          updateView(view, state, {
            thrusting: false, hardBurn: false, groundEffect: 0,
            scraped: false, landed: false, wrecked: false,
          }, dt)
          if (transition >= CAVERN_PAUSE) {
            transition = 0
            nextCavern(state, rng)
          }
          input.endFrame()
          emitHud()
          return
        }

        hardBurn = input.state.space
        const events = step(state, {
          rotateLeft: input.state.left,
          rotateRight: input.state.right,
          thrust: input.state.up,
          survey: input.state.down,
          hardBurn,
        }, dt, rng)

        if (events.thrusting) {
          if (!thrustDrone) thrustDrone = audio.drone(70, 0.05)
          thrustDrone?.setFrequency(hardBurn ? 130 : 78)
          thrustDrone?.setVolume(hardBurn ? 0.1 : 0.05)
        } else {
          thrustDrone?.setVolume(0)
        }

        if (events.scraped) {
          juice.addTrauma(TRAUMA_SMALL * 0.7)
          audio.noise(0.12, 0.16, 1400)
        }

        if (events.landed) {
          const perfect = events.landed.perfect
          juice.addTrauma(perfect ? TRAUMA_BIG : TRAUMA_SMALL)
          juice.freeze(HITSTOP_LARGE)
          juice.burst(state.ship.x, state.ship.y, {
            count: perfect ? 30 : 14,
            speed: [2, 9],
            life: [0.4, 1],
            size: [0.06, 0.18],
            hue: perfect ? 150 : 40,
          })
          audio.play(perfect
            ? { frequency: 520, endFrequency: 1180, duration: 0.5, waveform: 'sine', volume: 0.42 }
            : { frequency: 320, endFrequency: 470, duration: 0.28, waveform: 'triangle', volume: 0.32 })
          if (perfect) {
            audio.play({ frequency: 780, endFrequency: 1560, duration: 0.6, waveform: 'sine', volume: 0.26 })
          }
        }

        if (events.wrecked) {
          juice.addTrauma(TRAUMA_CATASTROPHE)
          juice.freeze(HITSTOP_HUGE)
          juice.burst(state.ship.x, state.ship.y, {
            count: 46, speed: [3, 16], life: [0.5, 1.4], size: [0.08, 0.24], hue: 18,
          })
          audio.noise(0.5, 0.4, 700)
          finish('wrecked')
        }

        updateView(view, state, {
          thrusting: events.thrusting === true,
          hardBurn,
          groundEffect: events.groundEffect ?? 0,
          scraped: events.scraped === true,
          landed: events.landed !== undefined,
          wrecked: events.wrecked !== undefined,
        }, dt)

        input.endFrame()
        emitHud()
      },
      render() {
        render(ctx, state, view, juice, size.width, size.height, hardBurn)
      },
    })

    emitHud()
    loop.start()

    return {
      pause() {
        loop.pause()
        thrustDrone?.setVolume(0)
      },
      resume: () => loop.resume(),
      destroy() {
        loop.stop()
        thrustDrone?.stop()
        input.destroy()
        window.removeEventListener('resize', onResize)
        emitter.clear()
      },
      on: emitter.on,
    }
  },
}

export default descent
