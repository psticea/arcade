import { useState, useRef, useEffect, useCallback } from 'react'

interface InputBarProps {
  onInput: (value: string) => string
  keyboardInset?: number
}

export function InputBar({ onInput, keyboardInset = 0 }: InputBarProps) {
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
        aria-label="Word input"
        placeholder="Type the falling words..."
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  )
}