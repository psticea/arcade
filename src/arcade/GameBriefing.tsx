import { useEffect, useMemo, useRef } from 'react'
import type { GameDefinition } from '../lib/types.ts'
import { getAudio, SFX } from '../lib/audio.ts'
import { isTouchDevice } from './touch.ts'

interface Props {
  game: GameDefinition
  modeId: string
  /** Label for the primary button. Differs when opened from a paused run. */
  startLabel?: string
  onStart: () => void
  onBack: () => void
}

/**
 * The briefing.
 *
 * Every game here is wordless while you play — no tutorial, no tooltips, no
 * text in the world. That is deliberate and it is good for the playing, but it
 * leaves the first thirty seconds as pure guesswork, and "what am I even meant
 * to do" is the most common reason someone puts an arcade game down.
 *
 * So this screen carries all of it: the fiction, the goal, how a run ends, how
 * points are actually calculated, and every control including whether it is
 * tapped or held. It appears once before a game starts and never interrupts a
 * run, so it costs one beat and buys back the whole first minute.
 */
export function GameBriefing({ game, modeId, startLabel, onStart, onBack }: Props) {
  const startRef = useRef<HTMLButtonElement>(null)
  const touch = useMemo(() => isTouchDevice(), [])
  const brief = game.briefing
  const mode = game.modes.find((m) => m.id === modeId) ?? game.modes[0]

  // Focus the primary action so a keyboard player can start without hunting,
  // and so a screen reader lands somewhere useful. `preventScroll` matters:
  // without it the browser scrolls the button into view, which on a phone
  // dumps the player at the bottom of the card past everything they came to
  // read.
  useEffect(() => {
    startRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault()
        onStart()
      } else if (event.code === 'Escape') {
        event.preventDefault()
        getAudio().play(SFX.back())
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onStart, onBack])

  return (
    <div className="briefing" style={{ ['--accent' as string]: game.accent }}>
      <div className="briefing-card">
        <header className="briefing-head">
          <p className="briefing-kicker">{game.name}{mode ? ` · ${mode.name}` : ''}</p>
          <p className="briefing-story">{brief.story}</p>
        </header>

        <section className="briefing-block">
          <h2 className="briefing-label">GOAL</h2>
          <p className="briefing-goal">{brief.goal}</p>
        </section>

        <section className="briefing-block">
          <h2 className="briefing-label">CONTROLS</h2>
          <ul className="control-list">
            {brief.controls.map((line) => (
              <li key={line.keys + line.action}>
                <span className="control-key">
                  {touch && line.touchKeys ? line.touchKeys : line.keys}
                </span>
                <span className="control-action">
                  {line.action}
                  {line.hold && <em className="control-hold">hold</em>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="briefing-block">
          <h2 className="briefing-label">SCORING</h2>
          <ul className="scoring-list">
            {brief.scoring.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </section>

        <section className="briefing-block">
          <h2 className="briefing-label">RUN ENDS</h2>
          <p className="briefing-ends">{brief.ends}</p>
        </section>

        {brief.tip && (
          <p className="briefing-tip"><strong>Tip</strong> {brief.tip}</p>
        )}

        <div className="briefing-actions">
          <button
            ref={startRef}
            type="button"
            className="overlay-button is-primary"
            onClick={onStart}
          >
            {startLabel ?? 'START'}
          </button>
          {!startLabel && (
            <button type="button" className="overlay-button" onClick={onBack}>
              BACK
            </button>
          )}
        </div>

        {!touch && (
          <p className="briefing-hint">
            {startLabel ? 'ESC close' : 'SPACE start · ESC back'}
          </p>
        )}
      </div>
    </div>
  )
}
