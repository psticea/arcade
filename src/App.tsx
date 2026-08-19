import { useCallback, useState } from 'react'
import { GamePicker } from './arcade/GamePicker.tsx'
import { GameHost } from './arcade/GameHost.tsx'
import { GameBriefing } from './arcade/GameBriefing.tsx'
import type { GameDefinition } from './lib/types.ts'
import './styles/theme.css'

interface Session {
  game: GameDefinition
  modeId: string
}

export function App() {
  const [session, setSession] = useState<Session | undefined>(undefined)
  // The briefing sits between choosing a game and playing it. It is a separate
  // phase rather than a panel on the picker so it gets the whole screen — these
  // explanations are the only text in the product and cramming them under a
  // cabinet row is how they end up unread.
  const [briefing, setBriefing] = useState<Session | undefined>(undefined)

  const choose = useCallback((game: GameDefinition, modeId: string) => {
    setBriefing({ game, modeId })
  }, [])

  const start = useCallback(() => {
    setBriefing((pending) => {
      if (pending) setSession(pending)
      return undefined
    })
  }, [])

  const exit = useCallback(() => setSession(undefined), [])
  const cancel = useCallback(() => setBriefing(undefined), [])

  return (
    <main className="arcade">
      {session ? (
        <GameHost game={session.game} modeId={session.modeId} onExit={exit} />
      ) : briefing ? (
        <GameBriefing
          game={briefing.game}
          modeId={briefing.modeId}
          onStart={start}
          onBack={cancel}
        />
      ) : (
        <GamePicker onSelect={choose} />
      )}
    </main>
  )
}
