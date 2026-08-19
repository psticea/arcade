import { useReducer, useRef } from 'react'
import { useMenuKeys } from './useMenuKeys.ts'
import { getAudio, SFX } from '../lib/audio.ts'
import { formatScore } from '../lib/math.ts'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '

interface Props {
  score: number
  onSubmit: (initials: string) => void
  touch?: boolean
}

/**
 * Classic three-letter entry, driven by the same five keys as the games.
 *
 * Position and letters live in refs rather than state: key presses can arrive
 * faster than React re-renders, and reading them from a stale closure meant a
 * quick triple-tap of SPACE never reached the commit.
 */
export function InitialsEntry({ score, onSubmit, touch }: Props) {
  const lettersRef = useRef([0, 0, 0])
  const positionRef = useRef(0)
  const submittedRef = useRef(false)
  const [, forceRender] = useReducer((n: number) => n + 1, 0)

  const commit = () => {
    if (submittedRef.current) return
    submittedRef.current = true
    const initials = lettersRef.current.map((i) => ALPHABET[i] ?? 'A').join('').trim()
    onSubmit(initials || 'AAA')
  }

  /** Step one slot's letter, shared by the keyboard and the touch buttons. */
  const cycle = (slot: number, delta: number) => {
    const value = lettersRef.current[slot] ?? 0
    lettersRef.current[slot] = (value + delta + ALPHABET.length) % ALPHABET.length
    positionRef.current = slot
    forceRender()
  }

  useMenuKeys((code) => {
    if (submittedRef.current) return
    const audio = getAudio()

    if (code === 'ArrowUp' || code === 'ArrowDown') {
      cycle(positionRef.current, code === 'ArrowUp' ? -1 : 1)
      audio.play(SFX.move())
    } else if (code === 'ArrowLeft') {
      positionRef.current = Math.max(0, positionRef.current - 1)
      audio.play(SFX.move())
      forceRender()
    } else if (code === 'ArrowRight') {
      positionRef.current = Math.min(2, positionRef.current + 1)
      audio.play(SFX.move())
      forceRender()
    } else if (code === 'Space' || code === 'Enter') {
      audio.play(SFX.select())
      if (positionRef.current < 2) {
        positionRef.current += 1
        forceRender()
      } else {
        commit()
      }
    } else if (code === 'Escape') {
      commit()
    }
  })

  return (
    <div className="overlay">
      <p className="overlay-kicker">NEW HIGH SCORE</p>
      <p className="overlay-title">{formatScore(score)}</p>
      <div className="initials">
        {lettersRef.current.map((letterIndex, i) => {
          const character = ALPHABET[letterIndex] ?? 'A'
          const active = i === positionRef.current
          return touch ? (
            <div key={i} className="initial-column">
              <button
                type="button"
                className="initial-step"
                onClick={() => { cycle(i, -1); getAudio().play(SFX.move()) }}
                aria-label={`Previous letter for position ${i + 1}`}
              >▲</button>
              <span className={`initial${active ? ' is-active' : ''}`}>
                {character === ' ' ? '_' : character}
              </span>
              <button
                type="button"
                className="initial-step"
                onClick={() => { cycle(i, 1); getAudio().play(SFX.move()) }}
                aria-label={`Next letter for position ${i + 1}`}
              >▼</button>
            </div>
          ) : (
            <span key={i} className={`initial${active ? ' is-active' : ''}`}>
              {character === ' ' ? '_' : character}
            </span>
          )
        })}
      </div>
      {touch ? (
        <button type="button" className="overlay-button is-primary" onClick={commit}>
          CONFIRM
        </button>
      ) : (
        <p className="overlay-hint">↑↓ letter · ←→ position · SPACE confirm</p>
      )}
    </div>
  )
}
