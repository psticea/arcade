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

/** One line of the controls table in a game's briefing. */
export interface ControlLine {
  /** The key, as the player sees it: 'â† â†’', 'SPACE', 'â†‘'. */
  keys: string
  /** The same control on a touch device, when it differs. */
  touchKeys?: string
  /** What it does, in plain language. */
  action: string
  /** Whether it is tapped or held — the difference is often the whole skill. */
  hold?: boolean
}

/**
 * The briefing shown before a game starts.
 *
 * Every game in this arcade is deliberately wordless while you play, which is
 * good for the playing and terrible for the first thirty seconds. This is the
 * one place the game is allowed to explain itself — so it has to be complete
 * enough that nothing is a mystery, and short enough that it is actually read.
 */
export interface GameBriefing {
  /** One or two sentences of fiction. Sets the tone, never the rules. */
  story: string
  /** What the player is trying to do, in one sentence. */
  goal: string
  /** How the run ends. Every distinct failure, because surprises are unfair. */
  ends: string
  /** How points are earned, most important first. */
  scoring: string[]
  controls: ControlLine[]
  /** The one thing an expert knows that a beginner does not. */
  tip?: string
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
  /** Which of the five keys this game uses, for the on-screen touch controls. */
  touchKeys: readonly ArcadeKey[]
  /** Short verb for the touch action button, e.g. "BLOOM". */
  actionLabel: string
  /**
   * How to lay the on-screen controls out.
   *
   * `dpad` is the default cross plus an action button. `split` puts steering
   * under the left thumb and power under the right, which is the only layout
   * that works for a game needing both at once — a cross forces one thumb to
   * cover two axes and the other to reach across the screen.
   */
  touchLayout?: 'dpad' | 'split'
  /** Labels for the `split` layout's right-hand cluster. */
  touchLabels?: { primary: string; secondary?: string; tertiary?: string }
  /** Goal, story, scoring and controls, shown before the game starts. */
  briefing: GameBriefing
  load: () => Promise<{ default: GameModule }>
}
