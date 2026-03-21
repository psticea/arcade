import { useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react'
import { useGameLoop } from '../hooks/useGameLoop.ts'
import { createInitialState, type GameState } from '../game/gameState.ts'
import { getDifficulty, getLevel } from '../game/difficulty.ts'
import { spawnWord, updateWords, findMatchingWord, resetRecentWords } from '../game/wordManager.ts'
import { spawnExplosion, updateParticles } from '../game/particleSystem.ts'
import { renderBackground, renderWords, renderParticles, renderDangerZone } from '../game/renderer.ts'
import { calculateScore, getMissedPenalty } from '../game/scoring.ts'
import { HUD } from './HUD.tsx'
import { InputBar } from './InputBar.tsx'
import '../styles/theme.css'

interface GameCanvasProps {
  onGameOver: (state: GameState) => void
}

export function GameCanvas({ onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GameState>(createInitialState())
  const inputRef = useRef('')
  const [hudState, setHudState] = useState({ score: 0, combo: 0, lives: 3, level: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    resetRecentWords()
    stateRef.current = createInitialState()
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      setCanvasSize({ width: container.clientWidth, height: container.clientHeight })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const gameLoop = useCallback(
    (dt: number, elapsed: number) => {
      const state = stateRef.current
      if (state.status !== 'playing') return

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      state.elapsedTime = elapsed
      state.level = getLevel(elapsed)
      const difficulty = getDifficulty(elapsed)

      // Spawn words
      const timeSinceSpawn = (elapsed - state.lastSpawnTime) * 1000
      if (timeSinceSpawn >= difficulty.spawnIntervalMs && state.words.length < difficulty.maxWordsOnScreen) {
        state.words.push(spawnWord(state.nextWordId++, canvas.width, difficulty))
        state.lastSpawnTime = elapsed
      }

      // Update words
      state.words = updateWords(state.words, dt)

      // Check for words that hit the bottom
      const missed = state.words.filter((w) => w.y > canvas.height - 60)
      if (missed.length > 0) {
        state.words = state.words.filter((w) => w.y <= canvas.height - 60)
        state.lives -= missed.length
        state.wordsMissed += missed.length
        state.combo = 0
        state.score = Math.max(0, state.score - missed.reduce((s, _w) => s + getMissedPenalty(state.level), 0))

        if (state.lives <= 0) {
          state.status = 'gameover'
          onGameOver({ ...state })
          return
        }
      }

      // Update input matching
      const currentInput = inputRef.current
      for (const word of state.words) {
        word.targeted = false
        word.matchedChars = 0
      }
      if (currentInput.length > 0) {
        const match = findMatchingWord(state.words, currentInput)
        if (match) {
          match.targeted = true
          match.matchedChars = currentInput.length
        }
      }

      // Update particles
      state.particles = updateParticles(state.particles, dt)

      // Render
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      renderBackground(ctx, canvas.width, canvas.height, elapsed)
      renderDangerZone(ctx, canvas.width, canvas.height)
      renderWords(ctx, state.words)
      renderParticles(ctx, state.particles)

      // Update HUD (throttled by React batching)
      setHudState({ score: state.score, combo: state.combo, lives: state.lives, level: state.level })
    },
    [onGameOver],
  )

  useGameLoop(gameLoop, stateRef.current.status === 'playing')

  const handleInput = useCallback((value: string) => {
    inputRef.current = value
    const state = stateRef.current

    const match = findMatchingWord(state.words, value)
    if (match && value.toLowerCase() === match.text.toLowerCase()) {
      // Word completed!
      const wordCenter = match.x + (match.text.length * 9)
      state.particles.push(...spawnExplosion(wordCenter, match.y, match.text.length))
      state.words = state.words.filter((w) => w.id !== match.id)
      state.combo += 1
      state.maxCombo = Math.max(state.maxCombo, state.combo)
      state.wordsTyped += 1
      state.score += calculateScore(match.text.length, state.combo, state.level)
      inputRef.current = ''
      return ''
    }
    return value
  }, [])

  return (
    <div className="game-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="game-canvas"
      />
      <HUD score={hudState.score} combo={hudState.combo} lives={hudState.lives} level={hudState.level} />
      <InputBar onInput={handleInput} />
    </div>
  )
}
