import { useState, useRef, useEffect, useCallback } from 'react'
import type { GameLanguage } from '../game/wordManager.ts'
import { getUiCopy } from '../uiCopy.ts'

interface InputBarProps {
  onInput: (value: string) => string
  keyboardInset?: number
  language: GameLanguage
}

export function InputBar({ onInput, keyboardInset = 0, language }: InputBarProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const text = getUiCopy(language)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleClick = () => inputRef.current?.focus()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const result = onInput(raw)
      setValue(result)
    },
    [onInput],
  )

  return (
    <div
      className="input-bar"
      style={{ transform: `translate3d(0, ${-keyboardInset}px, 0)` }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        className="input-field"
        aria-label={text.input.label}
        placeholder={text.input.placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  )
}