import { useRef, useCallback, useEffect } from 'react'

export function useGameLoop(
  callback: (dt: number, elapsed: number) => void,
  running: boolean,
): void {
  const callbackRef = useRef(callback)
  const lastTimeRef = useRef(0)
  const elapsedTimeRef = useRef(0)
  const rafRef = useRef(0)

  callbackRef.current = callback

  const loop = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp
    }

    const rawDelta = (timestamp - lastTimeRef.current) / 1000
    const dt = Math.min(rawDelta, 0.05)
    elapsedTimeRef.current += rawDelta
    lastTimeRef.current = timestamp

    callbackRef.current(dt, elapsedTimeRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  useEffect(() => {
    if (running) {
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(rafRef.current)
    }
  }, [running, loop])
}
