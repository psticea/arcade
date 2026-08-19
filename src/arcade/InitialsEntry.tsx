import { useReducer, useRef } from 'react'
import { useMenuKeys } from './useMenuKeys.ts'
import { getAudio, SFX } from '../lib/audio.ts'
import { formatScore } from '../lib/math.ts'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '

interface Props {
  score: number
  onSubmit: (initials: string) => void
}

/**
 * Classic three-letter entry, driven by the same five keys as the games.
 *
 * Position and letters live in refs rather than state: key presses can arrive
 * faster than React re-renders, and reading them from a stale closure meant a
 * quick triple-tap of SPACE never reached the commit.
 */
export function InitialsEntry({ score, onSubmit }: Props) {
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

  useMenuKeys((code) => {
    if (submittedRef.current) return
    const audio = getAudio()

    if (code === 'ArrowUp' || code === 'ArrowDown') {
      const delta = code === 'ArrowUp' ? -1 : 1
      const at = positionRef.current
      const value = lettersRef.current[at] ?? 0
      lettersRef.current[at] = (value + delta + ALPHABET.length) % ALPHABET.length
      audio.play(SFX.move())
      forceRender()
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
          return (
            <span
              key={i}
              className={`initial${i === positionRef.current ? ' is-active' : ''}`}
            >
              {character === ' ' ? '_' : character}
            </span>
          )
        })}
      </div>
      <p className="overlay-hint">↑↓ letter · ←→ position · SPACE confirm</p>
    </div>
  )
}
