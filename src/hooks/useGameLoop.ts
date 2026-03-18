import { useRef, useCallback, useEffect } from 'react'

export function useGameLoop(
  callback: (dt: number, elapsed: number) => void,
  running: boolean,
): void {
  const callbackRef = useRef(callback)
  const startTimeRef = useRef(0)
  const lastTimeRef = useRef(0)
  const rafRef = useRef(0)

  callbackRef.current = callback

  const loop = useCallback((timestamp: number) => {
    if (startTimeRef.current === 0) {
      startTimeRef.current = timestamp
      lastTimeRef.current = timestamp
    }

    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05)
    const elapsed = (timestamp - startTimeRef.current) / 1000
    lastTimeRef.current = timestamp

    callbackRef.current(dt, elapsed)
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  useEffect(() => {
    if (running) {
      startTimeRef.current = 0
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(rafRef.current)
    }
  }, [running, loop])
}
