import type { GameModule, GameInstance, GameOptions, GameEventName, GameEvents } from './types.ts'

type Handlers = { [E in GameEventName]: Set<(payload: GameEvents[E]) => void> }

/** Typed event emitter shared by every game instance. */
export function createEmitter() {
  const handlers: Handlers = { hud: new Set(), gameover: new Set() }
  return {
    on<E extends GameEventName>(event: E, handler: (payload: GameEvents[E]) => void): () => void {
      handlers[event].add(handler as never)
      return () => { handlers[event].delete(handler as never) }
    },
    emit<E extends GameEventName>(event: E, payload: GameEvents[E]): void {
      for (const handler of handlers[event]) (handler as (p: GameEvents[E]) => void)(payload)
    },
    clear(): void {
      handlers.hud.clear()
      handlers.gameover.clear()
    },
  }
}

export type Emitter = ReturnType<typeof createEmitter>

export type { GameModule, GameInstance, GameOptions }
