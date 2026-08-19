/**
 * Shared vocabulary for the arcade.
 *
 * Every game is a `GameModule` that the shell mounts onto a canvas. Games never
 * import each other, and the shell never reaches into a game's internals — the
 * only channel is this contract.
 */

/** The five keys every game is restricted to. */
export type ArcadeKey = 'left' | 'right' | 'up' | 'down' | 'space'

/** Which keys are held right now. */
export type InputState = Record<ArcadeKey, boolean>

export function emptyInput(): InputState {
  return { left: false, right: false, up: false, down: false, space: false }
}

/** A live HUD reading. Games push these; the shell renders them. */
export interface HudState {
  score: number
  /** Primary secondary stat, e.g. multiplier or depth. */
  primaryLabel: string
  primaryValue: string
  /** Optional third readout. */
  secondaryLabel?: string
  secondaryValue?: string
  /** 0..1 resource bar, e.g. light or fuel. Omitted means no bar. */
  gauge?: number
  gaugeLabel?: string
}

export interface GameOverPayload {
  score: number
  /** Short human sentence about how the run ended. */
  summary: string
  /** Named end-of-run stats shown on the game-over screen. */
  stats: { label: string; value: string }[]
}

export interface GameEvents {
  hud: HudState
  gameover: GameOverPayload
}

export type GameEventName = keyof GameEvents

export interface GameOptions {
  seed: number
  /** Optional per-game variant, e.g. COIL's 'endless' | 'sprint'. */
  mode?: string
}

export interface GameInstance {
  pause(): void
  resume(): void
  /** Tear down completely: cancel frames, drop listeners, release resources. */
  destroy(): void
  on<E extends GameEventName>(event: E, handler: (payload: GameEvents[E]) => void): () => void
}

export interface GameModule {
  mount(canvas: HTMLCanvasElement, options: GameOptions): GameInstance
}

export interface GameMode {
  id: string
  name: string
  description: string
}

/** Catalogue entry used by the picker. Loader is dynamic so games code-split. */
export interface GameDefinition {
  id: string
  name: string
  tagline: string
  /** What the arrows mean in this game. */
  arrows: string
  /** What SPACE does in this game. */
  space: string
  accent: string
  modes: GameMode[]
  load: () => Promise<{ default: GameModule }>
}
