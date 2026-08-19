/**
 * Procedural audio. No asset files — every sound is synthesized at runtime.
 *
 * The `AudioContext` is created lazily on the first user gesture because browsers
 * start it suspended; building the graph at module load leaves the first run
 * silent while every later run has sound.
 */

export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle'

export interface ToneSpec {
  frequency: number
  /** Sweep to this frequency over the note. Defaults to no sweep. */
  endFrequency?: number
  duration: number
  waveform?: Waveform
  volume?: number
  attack?: number
  /** Randomise pitch by this fraction so repeats never sound identical. */
  jitter?: number
}

export interface ArcadeAudio {
  readonly enabled: boolean
  setEnabled(enabled: boolean): void
  /** Create/resume the context. Must be called from a user gesture. */
  unlock(): void
  play(spec: ToneSpec): void
  noise(duration: number, volume?: number, filterHz?: number): void
  /** Start a continuous drone; returns a handle to retune or stop it. */
  drone(frequency: number, volume?: number): DroneHandle | undefined
  stopAll(): void
}

export interface DroneHandle {
  setFrequency(frequency: number): void
  setVolume(volume: number): void
  stop(): void
}

let shared: ArcadeAudio | undefined

export function getAudio(): ArcadeAudio {
  if (!shared) shared = createAudio()
  return shared
}

export function createAudio(): ArcadeAudio {
  let ctx: AudioContext | undefined
  let master: GainNode | undefined
  let enabled = true
  const drones = new Set<DroneHandle>()

  const ensure = (): AudioContext | undefined => {
    if (typeof window === 'undefined') return undefined
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return undefined
    if (!ctx) {
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = 0.35
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  return {
    get enabled() { return enabled },

    setEnabled(value) {
      enabled = value
      if (master) master.gain.value = value ? 0.35 : 0
    },

    unlock() {
      ensure()
    },

    play(spec) {
      if (!enabled) return
      const audio = ensure()
      if (!audio || !master) return
      const {
        frequency, endFrequency, duration,
        waveform = 'square', volume = 0.5, attack = 0.005, jitter = 0.08,
      } = spec

      const detune = 1 + (Math.random() * 2 - 1) * jitter
      const now = audio.currentTime
      const osc = audio.createOscillator()
      const gain = audio.createGain()

      osc.type = waveform
      osc.frequency.setValueAtTime(Math.max(20, frequency * detune), now)
      if (endFrequency !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFrequency * detune),
          now + duration,
        )
      }

      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume, now + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

      osc.connect(gain)
      gain.connect(master)
      osc.start(now)
      osc.stop(now + duration + 0.02)
    },

    noise(duration, volume = 0.3, filterHz = 1200) {
      if (!enabled) return
      const audio = ensure()
      if (!audio || !master) return
      const frames = Math.max(1, Math.floor(audio.sampleRate * duration))
      const buffer = audio.createBuffer(1, frames, audio.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < frames; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
      }
      const source = audio.createBufferSource()
      source.buffer = buffer
      const filter = audio.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = filterHz
      const gain = audio.createGain()
      gain.gain.value = volume
      source.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      source.start()
    },

    drone(frequency, volume = 0.08) {
      const audio = ensure()
      if (!audio || !master) return undefined
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = frequency
      gain.gain.value = enabled ? volume : 0
      const filter = audio.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 600
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      osc.start()

      const handle: DroneHandle = {
        setFrequency(next) {
          osc.frequency.setTargetAtTime(next, audio.currentTime, 0.08)
        },
        setVolume(next) {
          gain.gain.setTargetAtTime(enabled ? next : 0, audio.currentTime, 0.1)
        },
        stop() {
          try {
            gain.gain.setTargetAtTime(0, audio.currentTime, 0.05)
            osc.stop(audio.currentTime + 0.3)
          } catch {
            // Already stopped — nothing to do.
          }
          drones.delete(handle)
        },
      }
      drones.add(handle)
      return handle
    },

    stopAll() {
      for (const handle of [...drones]) handle.stop()
    },
  }
}

/** Shared UI sounds so every screen in the arcade agrees. */
export const SFX = {
  move: (): ToneSpec => ({ frequency: 420, duration: 0.05, waveform: 'square', volume: 0.18 }),
  select: (): ToneSpec => ({ frequency: 660, endFrequency: 990, duration: 0.12, waveform: 'square', volume: 0.25 }),
  back: (): ToneSpec => ({ frequency: 440, endFrequency: 220, duration: 0.12, waveform: 'square', volume: 0.22 }),
  coin: (): ToneSpec => ({ frequency: 880, endFrequency: 1320, duration: 0.18, waveform: 'square', volume: 0.3 }),
}
