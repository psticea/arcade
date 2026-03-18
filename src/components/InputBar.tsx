import { useState, useRef, useEffect, useCallback } from 'react'

interface InputBarProps {
  onInput: (value: string) => string
}

export function InputBar({ onInput }: InputBarProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setValue('')
        onInput('')
      }
    },
    [onInput],
  )

  return (
    <div className="input-bar">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="input-field"
        placeholder="Type the falling words..."
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  )
}