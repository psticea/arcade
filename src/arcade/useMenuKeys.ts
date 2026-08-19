import { useEffect, useRef } from 'react'

type KeyHandler = (key: string) => void

/**
 * Menu keyboard handling for the shell.
 *
 * Games own their own input manager; this exists only for the screens around
 * them, and unmounts cleanly so the two never listen at the same time.
 */
export function useMenuKeys(handler: KeyHandler, active = true): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      const handled = [
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Space', 'Enter', 'Escape',
      ]
      if (!handled.includes(event.code)) return
      event.preventDefault()
      if (event.repeat && (event.code === 'Space' || event.code === 'Enter')) return
      handlerRef.current(event.code)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])
}
