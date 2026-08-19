import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameDefinition, GameInstance, HudState, GameOverPayload } from '../lib/types.ts'
import { getAudio, SFX } from '../lib/audio.ts'
import { formatScore } from '../lib/math.ts'
import { InitialsEntry } from './InitialsEntry.tsx'
import { TouchControls } from './TouchControls.tsx'
import { isTouchDevice, pressEscape } from './touch.ts'
import { getScores, qualifies, submitScore, type ScoreEntry } from './scores.ts'
import { dailySeed } from '../lib/prng.ts'

interface Props {
  game: GameDefinition
  modeId: string
  onExit: () => void
}

type Phase = 'loading' | 'playing' | 'paused' | 'gameover' | 'initials' | 'error'

const HUD_INTERVAL_MS = 80

/**
 * Hosts one game: owns the canvas, mounts the module, and renders the chrome
 * around it. HUD updates are sampled on an interval rather than per frame so
 * React never re-renders at 120 Hz.
 */
export function GameHost({ game, modeId, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const instanceRef = useRef<GameInstance | undefined>(undefined)
  const hudRef = useRef<HudState | undefined>(undefined)

  const [phase, setPhase] = useState<Phase>('loading')
  const [hud, setHud] = useState<HudState | undefined>(undefined)
  const [result, setResult] = useState<GameOverPayload | undefined>(undefined)
  const [board, setBoard] = useState<ScoreEntry[]>(() =>
    getScores(window.localStorage, game.id, modeId))
  const [runKey, setRunKey] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const mode = game.modes.find((m) => m.id === modeId) ?? game.modes[0]
  const modeName = mode?.name ?? modeId
  const touch = useMemo(() => isTouchDevice(), [])
  // Games with a d-pad need the playfield to end above the controls; the
  // tap-anywhere games do not, since their control is the whole screen.
  const showsPad = touch && game.touchKeys.length > 1

  // Mount the game module. Re-runs on restart via runKey.
  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setResult(undefined)
    hudRef.current = undefined
    setHud(undefined)

    const audio = getAudio()
    audio.unlock()

    game.load().then((module) => {
      if (cancelled || !canvasRef.current) return
      const seed = modeId === 'daily' ? dailySeed() : (Date.now() ^ (runKey * 2654435761)) >>> 0
      const instance = module.default.mount(canvasRef.current, { seed, mode: modeId })
      instanceRef.current = instance

      instance.on('hud', (next) => { hudRef.current = next })
      instance.on('gameover', (payload) => {
        setResult(payload)
        setPhase(qualifies(window.localStorage, game.id, modeId, payload.score)
          ? 'initials'
          : 'gameover')
      })

      setPhase('playing')
    }).catch((error: unknown) => {
      if (cancelled) return
      setErrorMessage(error instanceof Error ? error.message : String(error))
      setPhase('error')
    })

    return () => {
      cancelled = true
      instanceRef.current?.destroy()
      instanceRef.current = undefined
      getAudio().stopAll()
    }
  }, [game, modeId, runKey])

  // Sample the HUD at a fixed rate instead of every frame.
  useEffect(() => {
    if (phase !== 'playing') return
    const id = window.setInterval(() => {
      if (hudRef.current) setHud({ ...hudRef.current })
    }, HUD_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [phase])

  const restart = useCallback(() => {
    setBoard(getScores(window.localStorage, game.id, modeId))
    setRunKey((k) => k + 1)
  }, [game.id, modeId])

  // Escape pauses; space resumes. Only active during play/pause.
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'paused') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        setPhase((current) => {
          if (current === 'playing') {
            instanceRef.current?.pause()
            return 'paused'
          }
          if (current === 'paused') {
            instanceRef.current?.resume()
            return 'playing'
          }
          return current
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase])

  // Game-over screen keys.
  useEffect(() => {
    if (phase !== 'gameover') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault()
        if (event.repeat) return
        getAudio().play(SFX.coin())
        restart()
      } else if (event.code === 'Escape') {
        event.preventDefault()
        getAudio().play(SFX.back())
        onExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, restart, onExit])

  const handleInitials = useCallback((initials: string) => {
    if (result) {
      const entries = submitScore(window.localStorage, game.id, modeId, {
        initials,
        score: Math.floor(result.score),
        date: new Date().toISOString(),
      })
      setBoard(entries)
    }
    setPhase('gameover')
  }, [result, game.id, modeId])

  return (
    <div
      className="host"
      data-touch={touch ? 'true' : undefined}
      data-pad={showsPad ? 'true' : undefined}
      style={{ ['--accent' as string]: game.accent }}
    >
      <canvas ref={canvasRef} className="host-canvas" tabIndex={0} aria-label={`${game.name} play area`} />

      {phase === 'playing' && hud && <Hud hud={hud} gameName={game.name} />}

      {phase === 'playing' && touch && (
        <TouchControls
          keys={game.touchKeys}
          actionLabel={game.actionLabel}
          tapAnywhere={game.touchKeys.length === 1}
          onPause={pressEscape}
        />
      )}

      {phase === 'loading' && (
        <div className="overlay">
          <p className="overlay-title">LOADING {game.name}</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="overlay">
          <p className="overlay-title">CABINET OUT OF ORDER</p>
          <p className="overlay-body">{errorMessage}</p>
          <p className="overlay-hint">ESC to return</p>
          <button type="button" className="overlay-button" onClick={onExit}>BACK</button>
        </div>
      )}

      {phase === 'paused' && (
        <div className="overlay">
          <p className="overlay-title">PAUSED</p>
          <button type="button" className="overlay-button is-primary" onClick={pressEscape}>
            RESUME
          </button>
          <button type="button" className="overlay-button" onClick={onExit}>QUIT TO ARCADE</button>
          {!touch && <p className="overlay-hint">ESC resume</p>}
        </div>
      )}

      {phase === 'initials' && result && (
        <InitialsEntry score={result.score} onSubmit={handleInitials} touch={touch} />
      )}

      {phase === 'gameover' && result && (
        <div className="overlay">
          <p className="overlay-kicker">{game.name} · {modeName}</p>
          <p className="overlay-title">{formatScore(result.score)}</p>
          <p className="overlay-body">{result.summary}</p>
          <ul className="stat-list">
            {result.stats.map((stat) => (
              <li key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </li>
            ))}
          </ul>
          {board.length > 0 && (
            <ol className="score-board">
              {board.slice(0, 5).map((entry, i) => (
                <li key={`${entry.date}-${i}`}>
                  <span className="rank">{i + 1}</span>
                  <span className="initials">{entry.initials}</span>
                  <span className="points">{formatScore(entry.score)}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="overlay-actions">
            <button type="button" className="overlay-button is-primary" onClick={restart}>
              PLAY AGAIN
            </button>
            <button type="button" className="overlay-button" onClick={onExit}>ARCADE</button>
          </div>
          {!touch && <p className="overlay-hint">SPACE play again · ESC arcade</p>}
        </div>
      )}
    </div>
  )
}

function Hud({ hud, gameName }: { hud: HudState; gameName: string }) {
  return (
    <div className="hud">
      <div className="hud-block">
        <span className="hud-label">{gameName}</span>
        <span className="hud-value hud-score">{formatScore(hud.score)}</span>
      </div>
      <div className="hud-right">
        <div className="hud-block">
          <span className="hud-label">{hud.primaryLabel}</span>
          <span className="hud-value">{hud.primaryValue}</span>
        </div>
        {hud.secondaryLabel && (
          <div className="hud-block">
            <span className="hud-label">{hud.secondaryLabel}</span>
            <span className="hud-value">{hud.secondaryValue}</span>
          </div>
        )}
      </div>
      {hud.gauge !== undefined && (
        <div className="hud-gauge">
          <span className="hud-label">{hud.gaugeLabel ?? 'FUEL'}</span>
          <div className="gauge-track">
            <div
              className="gauge-fill"
              style={{ transform: `scaleX(${Math.max(0, Math.min(1, hud.gauge))})` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
