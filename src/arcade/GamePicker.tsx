import { useEffect, useMemo, useState } from 'react'
import { GAMES } from './games.ts'
import { useMenuKeys } from './useMenuKeys.ts'
import { getBestScore } from './scores.ts'
import { isTouchDevice } from './touch.ts'
import { getAudio, SFX } from '../lib/audio.ts'
import { formatScore } from '../lib/math.ts'
import type { GameDefinition } from '../lib/types.ts'

interface Props {
  onSelect: (game: GameDefinition, modeId: string) => void
}

/**
 * The home page: five cabinets.
 *
 * Driven by the keyboard, but every control is also a real button, because a
 * touch device has no arrow keys and no space bar. Starting a game is an
 * explicit control rather than a second tap on the selected cabinet, which was
 * undiscoverable.
 */
export function GamePicker({ onSelect }: Props) {
  const [index, setIndex] = useState(0)
  const [modeIndex, setModeIndex] = useState(0)

  const game = GAMES[index]
  const audio = useMemo(() => getAudio(), [])
  const touch = useMemo(() => isTouchDevice(), [])

  useEffect(() => {
    setModeIndex(0)
  }, [index])

  const start = (target: GameDefinition, mode: number) => {
    const chosen = target.modes[mode] ?? target.modes[0]
    if (!chosen) return
    audio.unlock()
    audio.play(SFX.coin())
    onSelect(target, chosen.id)
  }

  useMenuKeys((code) => {
    audio.unlock()
    if (!game) return

    if (code === 'ArrowLeft') {
      setIndex((i) => (i - 1 + GAMES.length) % GAMES.length)
      audio.play(SFX.move())
    } else if (code === 'ArrowRight') {
      setIndex((i) => (i + 1) % GAMES.length)
      audio.play(SFX.move())
    } else if (code === 'ArrowUp') {
      setModeIndex((m) => (m - 1 + game.modes.length) % game.modes.length)
      audio.play(SFX.move())
    } else if (code === 'ArrowDown') {
      setModeIndex((m) => (m + 1) % game.modes.length)
      audio.play(SFX.move())
    } else if (code === 'Space' || code === 'Enter') {
      start(game, modeIndex)
    }
  })

  if (!game) return null

  return (
    <div className="picker">
      <header className="picker-head">
        <h1 className="picker-title">ARCADE</h1>
        <p className="picker-sub">
          {touch ? 'Five cabinets. Pick one and play.' : 'Five cabinets. Arrow keys and space. Nothing else.'}
        </p>
      </header>

      <div className="cabinet-row" role="listbox" aria-label="Games">
        {GAMES.map((entry, i) => {
          const selected = i === index
          const best = entry.modes[0]
            ? getBestScore(window.localStorage, entry.id, entry.modes[0].id)
            : 0
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
                if (selected) start(entry, modeIndex)
                else {
                  setIndex(i)
                  audio.play(SFX.move())
                }
              }}
            >
              <span className="cabinet-marquee">{entry.name}</span>
              <CabinetArt id={entry.id} accent={entry.accent} />
              <span className="cabinet-best">BEST {formatScore(best)}</span>
            </button>
          )
        })}
      </div>

      <div className="picker-detail" key={game.id} style={{ ['--accent' as string]: game.accent }}>
        <p className="picker-tagline">{game.tagline}</p>

        {game.modes.length > 1 && (
          <div className="mode-list" role="radiogroup" aria-label="Mode">
            {game.modes.map((mode, i) => (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={i === modeIndex}
                className={`mode${i === modeIndex ? ' is-selected' : ''}`}
                onClick={() => {
                  audio.unlock()
                  setModeIndex(i)
                  audio.play(SFX.move())
                }}
              >
                <span className="mode-name">{mode.name}</span>
                <span className="mode-desc">{mode.description}</span>
              </button>
            ))}
          </div>
        )}

        <button type="button" className="play-button" onClick={() => start(game, modeIndex)}>
          PLAY {game.name}
        </button>

        <dl className="picker-controls">
          <div><dt>{touch ? 'PAD' : 'ARROWS'}</dt><dd>{game.arrows}</dd></div>
          <div><dt>{touch ? game.actionLabel : 'SPACE'}</dt><dd>{game.space}</dd></div>
        </dl>

        {!touch && (
          <p className="picker-hint">
            ← → cabinet{game.modes.length > 1 ? ' · ↑ ↓ mode' : ''} · SPACE insert coin
          </p>
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
