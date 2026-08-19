import { useCallback, useState } from 'react'
import { GamePicker } from './arcade/GamePicker.tsx'
import { GameHost } from './arcade/GameHost.tsx'
import type { GameDefinition } from './lib/types.ts'
import './styles/theme.css'

interface Session {
  game: GameDefinition
  modeId: string
}

export function App() {
  const [session, setSession] = useState<Session | undefined>(undefined)

  const start = useCallback((game: GameDefinition, modeId: string) => {
    setSession({ game, modeId })
  }, [])

  const exit = useCallback(() => setSession(undefined), [])

  return (
    <main className="arcade">
      {session
        ? <GameHost game={session.game} modeId={session.modeId} onExit={exit} />
        : <GamePicker onSelect={start} />}
    </main>
  )
}
