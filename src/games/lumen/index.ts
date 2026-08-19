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
import { formatScore } from '../../lib/math.ts'
import {
  BOONS, LAMP_CAPACITY, LANTERN_CAPACITY, createState, huntingCount, step,
  type LumenState,
} from './simulation.ts'
import { pointAt, render } from './renderer.ts'

/**
 * LUMEN — the shell side: input, audio, juice and the HUD.
 *
 * The audio is adaptive rather than decorative. Two drones run for the whole
 * run: one tuned to how much light is left in the world, which sags as you lose
 * ground, and one that only exists while something is walking the rim toward
 * you. You can hear a hunter turn before you see it, which is the difference
 * between the dark being atmospheric and the dark being information.
 */

const TITLE_HOLD = 2.6
const POUR_TICK = 0.1

const lumen: GameModule = {
  mount(canvas: HTMLCanvasElement, options: GameOptions): GameInstance {
    const emitter = createEmitter()
    const rng = createRng(options.seed)
    const input = createInputManager()
    const juice = createJuice(640)
    const audio = getAudio()

    const state: LumenState = createState(rng)
    let size = fitCanvas(canvas)
    let finished = false
    let titleFade = TITLE_HOLD
    let pourTimer = 0
    let hum: DroneHandle | undefined
    let dread: DroneHandle | undefined
    let dreadLevel = 0

    const calm = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available in this browser')

    const onResize = () => { size = fitCanvas(canvas) }
    window.addEventListener('resize', onResize)

    // Reduced motion damps the camera but never the simulation, so the game is
    // the same game — it just stops throwing the screen around.
    const trauma = (amount: number) => juice.addTrauma(calm ? amount * 0.3 : amount)

    const held = { pour: false, draw: false }

    const emitHud = () => {
      emitter.emit('hud', {
        score: state.score,
        primaryLabel: 'MULT',
        primaryValue: `x${state.multiplier}`,
        secondaryLabel: 'WATCH',
        secondaryValue: String(state.watch + 1),
        gauge: state.lantern / LANTERN_CAPACITY,
        gaugeLabel: 'LANTERN',
      })
    }

    const finish = () => {
      if (finished) return
      finished = true
      hum?.stop()
      dread?.stop()
      hum = undefined
      dread = undefined
      audio.play({ frequency: 260, endFrequency: 32, duration: 1.6, waveform: 'sine', volume: 0.45 })

      const kept = Math.round(state.lightSpent)
      const lost = Math.round(state.lightStolen)
      const boonNames = state.boonsTaken.map((id) => BOONS[id].name)
      emitter.emit('gameover', {
        score: state.score,
        summary: lost > kept
          ? `The shades drank ${formatScore(lost)} light out of the ring and the lamps only burned ${formatScore(kept)}. You were robbed, not outlasted.`
          : `The lamps burned ${formatScore(kept)} light and the shades took ${formatScore(lost)}. The night simply outlasted the oil.`,
        stats: [
          { label: 'WATCHES', value: String(state.watch + 1) },
          { label: 'BURNED', value: String(state.burned) },
          { label: 'MAWS', value: String(state.mawsBurned) },
          { label: 'BEST BURN', value: formatScore(state.bestBurn) },
          { label: 'PEAK MULT', value: `x${state.peakMultiplier}` },
          { label: 'SIGNS', value: boonNames.length > 0 ? boonNames.join(' ') : 'NONE' },
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

        held.pour = input.state.space
        held.draw = input.state.down && !input.state.space
        titleFade = Math.max(0, titleFade - dt)

        const events = step(state, {
          left: input.state.left,
          right: input.state.right,
          pour: held.pour,
          draw: held.draw,
        }, dt, rng)

        if (!hum) hum = audio.drone(48, 0.05)
        if (!dread) dread = audio.drone(126, 0)

        // The base drone sags with the light left in the world, and the dread
        // layer only speaks while something is walking the rim after you.
        const light = state.lantern + state.lamps.reduce((sum, lamp) => sum + lamp.fuel, 0)
        const reserve = Math.min(1, light / (LAMP_CAPACITY * 2))
        hum?.setFrequency(38 + reserve * 26)
        const hunters = huntingCount(state)
        const wanted = Math.min(0.075, hunters * 0.028)
        if (Math.abs(wanted - dreadLevel) > 0.004) {
          dreadLevel = wanted
          dread?.setVolume(wanted)
        }

        if (held.pour || held.draw) {
          pourTimer -= dt
          if (pourTimer <= 0) {
            pourTimer = POUR_TICK
            const lamp = state.lamps[Math.round(state.keeper) % state.lamps.length]
            const fill = (lamp?.fuel ?? 0) / LAMP_CAPACITY
            audio.play({
              frequency: held.pour ? 300 + fill * 520 : 760 - fill * 400,
              duration: 0.05,
              waveform: 'triangle',
              volume: 0.1,
              jitter: 0.03,
            })
          }
        } else {
          pourTimer = 0
        }

        for (const burn of events.burned ?? []) {
          const point = pointAt(size.width, size.height, burn.angle, burn.climb)
          const big = burn.kind === 'maw'
          trauma(big ? TRAUMA_BIG : TRAUMA_SMALL * 0.5)
          if (big) juice.freeze(HITSTOP_SMALL)
          juice.burst(point.x, point.y, {
            count: big ? 30 : 11,
            speed: [30, big ? 250 : 140],
            life: [0.24, big ? 0.95 : 0.5],
            hue: big ? 32 : 44,
          })
          audio.play(big
            ? { frequency: 220, endFrequency: 880, duration: 0.5, waveform: 'sawtooth', volume: 0.34 }
            : {
              frequency: 620 + Math.min(8, state.multiplier) * 46,
              endFrequency: 1240,
              duration: 0.14,
              waveform: 'sine',
              volume: 0.24,
            })
        }

        if (events.latched !== undefined) {
          audio.play({ frequency: 340, endFrequency: 150, duration: 0.4, waveform: 'triangle', volume: 0.3 })
        }
        if (events.stolen !== undefined) {
          trauma(TRAUMA_BIG)
          juice.freeze(HITSTOP_SMALL)
          audio.noise(0.3, 0.34, 320)
          audio.play({ frequency: 180, endFrequency: 70, duration: 0.45, waveform: 'sawtooth', volume: 0.3 })
        }
        if (events.lampSnuffed !== undefined) {
          audio.noise(0.22, 0.2, 700)
        }
        if (events.lampLit !== undefined) {
          audio.play({ frequency: 420, endFrequency: 900, duration: 0.22, waveform: 'sine', volume: 0.22 })
        }
        if (events.boon !== undefined) {
          trauma(TRAUMA_SMALL)
          for (const [i, frequency] of [523, 659, 784, 1046].entries()) {
            window.setTimeout(
              () => audio.play({ frequency, duration: 0.24, waveform: 'sine', volume: 0.26 }),
              i * 80,
            )
          }
        }
        if (events.watchEnded !== undefined) {
          trauma(TRAUMA_SMALL)
          audio.play({ frequency: 392, endFrequency: 1176, duration: 1, waveform: 'sine', volume: 0.34 })
        }
        if (events.watchBegan !== undefined) {
          titleFade = TITLE_HOLD
          juice.freeze(HITSTOP_LARGE)
          audio.play({ frequency: 98, endFrequency: 74, duration: 1.4, waveform: 'triangle', volume: 0.4 })
        }
        if (events.died) {
          trauma(TRAUMA_CATASTROPHE)
          juice.freeze(HITSTOP_HUGE)
          finish()
        }

        input.endFrame()
        emitHud()
      },
      render() {
        render(ctx, state, size.width, size.height, {
          juice,
          input: held,
          titleFade: titleFade / TITLE_HOLD,
          calm,
        })
      },
    })

    emitHud()
    loop.start()

    return {
      pause() {
        loop.pause()
        hum?.setVolume(0)
        dread?.setVolume(0)
      },
      resume() {
        loop.resume()
        hum?.setVolume(0.05)
        dread?.setVolume(dreadLevel)
      },
      destroy() {
        loop.stop()
        hum?.stop()
        dread?.stop()
        input.destroy()
        window.removeEventListener('resize', onResize)
        emitter.clear()
      },
      on: emitter.on,
    }
  },
}

export default lumen
