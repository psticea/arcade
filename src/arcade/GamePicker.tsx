import { useEffect, useMemo, useState } from 'react'
import { GAMES } from './games.ts'
import { useMenuKeys } from './useMenuKeys.ts'
import { getBestScore } from './scores.ts'
import { getAudio, SFX } from '../lib/audio.ts'
import { formatScore } from '../lib/math.ts'
import type { GameDefinition } from '../lib/types.ts'

interface Props {
  onSelect: (game: GameDefinition, modeId: string) => void
}

/** The home page: five cabinets, chosen with the same keys the games use. */
export function GamePicker({ onSelect }: Props) {
  const [index, setIndex] = useState(0)
  const [modeIndex, setModeIndex] = useState(0)
  const [choosingMode, setChoosingMode] = useState(false)

  const game = GAMES[index]
  const audio = useMemo(() => getAudio(), [])

  useEffect(() => {
    setModeIndex(0)
  }, [index])

  useMenuKeys((code) => {
    audio.unlock()
    if (!game) return
    if (choosingMode) {
      if (code === 'ArrowLeft' || code === 'ArrowUp') {
        setModeIndex((m) => (m - 1 + game.modes.length) % game.modes.length)
        audio.play(SFX.move())
      } else if (code === 'ArrowRight' || code === 'ArrowDown') {
        setModeIndex((m) => (m + 1) % game.modes.length)
        audio.play(SFX.move())
      } else if (code === 'Space' || code === 'Enter') {
        const mode = game.modes[modeIndex]
        if (mode) {
          audio.play(SFX.coin())
          onSelect(game, mode.id)
        }
      } else if (code === 'Escape') {
        audio.play(SFX.back())
        setChoosingMode(false)
      }
      return
    }

    if (code === 'ArrowLeft') {
      setIndex((i) => (i - 1 + GAMES.length) % GAMES.length)
      audio.play(SFX.move())
    } else if (code === 'ArrowRight') {
      setIndex((i) => (i + 1) % GAMES.length)
      audio.play(SFX.move())
    } else if (code === 'Space' || code === 'Enter') {
      audio.play(SFX.select())
      const only = game.modes[0]
      if (game.modes.length === 1 && only) {
        audio.play(SFX.coin())
        onSelect(game, only.id)
      } else {
        setChoosingMode(true)
      }
    }
  })

  if (!game) return null

  return (
    <div className="picker">
      <header className="picker-head">
        <h1 className="picker-title">ARCADE</h1>
        <p className="picker-sub">Five cabinets. Arrow keys and space. Nothing else.</p>
      </header>

      <div className="cabinet-row" role="listbox" aria-label="Games">
        {GAMES.map((entry, i) => {
          const selected = i === index
          return (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={`cabinet${selected ? ' is-selected' : ''}`}
              style={{ ['--accent' as string]: entry.accent }}
              onClick={() => {
                audio.unlock()
                const only = entry.modes[0]
                if (selected) {
                  if (entry.modes.length === 1 && only) onSelect(entry, only.id)
                  else setChoosingMode(true)
                } else {
                  setIndex(i)
                }
              }}
            >
              <span className="cabinet-marquee">{entry.name}</span>
              <CabinetArt id={entry.id} accent={entry.accent} />
              <span className="cabinet-best">
                BEST {formatScore(
                  entry.modes[0]
                    ? getBestScore(window.localStorage, entry.id, entry.modes[0].id)
                    : 0,
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="picker-detail" key={game.id}>
        <p className="picker-tagline">{game.tagline}</p>
        <dl className="picker-controls">
          <div><dt>ARROWS</dt><dd>{game.arrows}</dd></div>
          <div><dt>SPACE</dt><dd>{game.space}</dd></div>
        </dl>

        {choosingMode ? (
          <div className="mode-list">
            {game.modes.map((mode, i) => (
              <div key={mode.id} className={`mode${i === modeIndex ? ' is-selected' : ''}`}>
                <span className="mode-name">{mode.name}</span>
                <span className="mode-desc">{mode.description}</span>
              </div>
            ))}
            <p className="picker-hint">↑↓ choose mode · SPACE start · ESC back</p>
          </div>
        ) : (
          <p className="picker-hint">← → choose cabinet · SPACE insert coin</p>
        )}
      </div>
    </div>
  )
}

/** A tiny abstract mark per cabinet so the row reads at a glance. */
function CabinetArt({ id, accent }: { id: string; accent: string }) {
  const common = { stroke: accent, fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const }
  return (
    <svg className="cabinet-art" viewBox="0 0 64 64" aria-hidden="true">
      {id === 'coil' && (
        <path {...common} d="M12 20h24v12H20v12h32" />
      )}
      {id === 'descent' && (
        <>
          <path {...common} d="M32 14l8 14H24z" />
          <path {...common} d="M8 50h16l8-6 8 6h16" />
        </>
      )}
      {id === 'lumen' && (
        <>
          <circle {...common} cx="32" cy="32" r="18" />
          <circle {...common} cx="32" cy="32" r="7" />
          <path {...common} d="M32 14v-6M50 32h6M32 50v6M14 32H8" />
        </>
      )}
      {id === 'glassworks' && (
        <>
          <path {...common} d="M14 12v26l14 12M50 12v26L36 50" />
          <circle {...common} cx="32" cy="26" r="5" />
        </>
      )}
      {id === 'ballast' && (
        <>
          <path {...common} d="M14 8v48M50 8v48" />
          <path {...common} d="M24 20c10 6 10 14 0 20" />
          <circle {...common} cx="24" cy="20" r="3" />
        </>
      )}
    </svg>
  )
}
