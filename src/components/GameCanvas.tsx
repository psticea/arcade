import { useRef, useCallback, useState, useEffect, useLayoutEffect, type CSSProperties } from 'react'
import { useGameLoop } from '../hooks/useGameLoop.ts'
import { createInitialState, type GameState } from '../game/gameState.ts'
import { getDifficulty, getLevel, getLevelProgress, type DifficultyTier } from '../game/difficulty.ts'
import {
  spawnWord,
  updateWords,
  findMatchingWord,
  resetRecentWords,
  type GameLanguage,
} from '../game/wordManager.ts'
import { spawnExplosion, updateParticles } from '../game/particleSystem.ts'
import { renderBackground, renderWords, renderParticles, renderDangerZone } from '../game/renderer.ts'
import { calculateScore, getMissedPenalty } from '../game/scoring.ts'
import { calculateKeyboardInset, isKeyboardViewport } from '../game/mobileViewport.ts'
import { HUD } from './HUD.tsx'
import { InputBar } from './InputBar.tsx'
import '../styles/theme.css'

interface GameCanvasProps {
  startingDifficulty: DifficultyTier
  language: GameLanguage
  onGameOver: (state: GameState) => void
}

export function GameCanvas({ startingDifficulty, language, onGameOver }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GameState>(createInitialState())
  const inputRef = useRef('')
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const initialDifficulty = getDifficulty(0, startingDifficulty)
  const initialProgress = getLevelProgress(0, startingDifficulty)
  const [targetText, setTargetText] = useState('')
  const [feedback, setFeedback] = useState<{ id: number; message: string; tone: 'success' | 'miss' }>()
  const [hudState, setHudState] = useState({
    score: 0,
    combo: 0,
    lives: 3,
    level: getLevel(0, startingDifficulty),
    tier: initialDifficulty.tier,
    levelProgress: initialProgress.progress,
    secondsToNextLevel: initialProgress.secondsRemaining,
  })
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [gameViewport, setGameViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    keyboardInset: 0,
  })

  useEffect(() => {
    resetRecentWords(language)
    stateRef.current = createInitialState()
  }, [language])

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
  }, [])

  const showFeedback = useCallback((message: string, tone: 'success' | 'miss') => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    setFeedback({ id: Date.now(), message, tone })
    feedbackTimerRef.current = setTimeout(() => setFeedback(undefined), 900)
  }, [])

  useLayoutEffect(() => {
    const visualViewport = window.visualViewport
    let stableWidth = window.innerWidth
    let stableHeight = window.innerHeight

    const updateGameViewport = () => {
      const visualHeight = visualViewport?.height ?? window.innerHeight
      const visualOffsetTop = visualViewport?.offsetTop ?? 0
      const layoutMatchesVisualViewport = Math.abs(window.innerHeight - visualHeight) < 2
      const keyboardIsOpen = isKeyboardViewport(
        stableWidth,
        stableHeight,
        window.innerWidth,
        visualHeight,
        document.activeElement?.tagName === 'INPUT',
      )

      if (!keyboardIsOpen && (layoutMatchesVisualViewport || Math.abs(window.innerWidth - stableWidth) > 80)) {
        stableWidth = window.innerWidth
        stableHeight = window.innerHeight
      }

      setGameViewport({
        width: stableWidth,
        height: stableHeight,
        keyboardInset: calculateKeyboardInset(stableHeight, visualHeight, visualOffsetTop),
      })
    }

    updateGameViewport()
    window.addEventListener('resize', updateGameViewport)
    visualViewport?.addEventListener('resize', updateGameViewport)
    visualViewport?.addEventListener('scroll', updateGameViewport)

    return () => {
      window.removeEventListener('resize', updateGameViewport)
      visualViewport?.removeEventListener('resize', updateGameViewport)
      visualViewport?.removeEventListener('scroll', updateGameViewport)
    }
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width > 0 && height > 0) {
        setCanvasSize({ width, height })
      }
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
      state.level = getLevel(elapsed, startingDifficulty)
      const difficulty = getDifficulty(elapsed, startingDifficulty)
      const levelProgress = getLevelProgress(elapsed, startingDifficulty)

      // Spawn words
      const timeSinceSpawn = (elapsed - state.lastSpawnTime) * 1000
      if (timeSinceSpawn >= difficulty.spawnIntervalMs && state.words.length < difficulty.maxWordsOnScreen) {
        const spawnedWord = spawnWord(state.nextWordId++, canvas.width, difficulty, language)
        state.words.push(spawnedWord)
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
        const scorePenalty = missed.reduce((sum) => sum + getMissedPenalty(state.level), 0)
        state.score = Math.max(0, state.score - scorePenalty)
        const lifeLabel = missed.length === 1 ? 'LIFE' : 'LIVES'
        showFeedback(`${missed.length} MISSED / -${missed.length} ${lifeLabel} / -${scorePenalty} PTS`, 'miss')

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
      setHudState({
        score: state.score,
        combo: state.combo,
        lives: state.lives,
        level: state.level,
        tier: difficulty.tier,
        levelProgress: levelProgress.progress,
        secondsToNextLevel: levelProgress.secondsRemaining,
      })
    },
    [language, onGameOver, showFeedback, startingDifficulty],
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
      state.charactersTyped += match.text.length
      const points = calculateScore(match.text.length, state.combo, state.level)
      state.score += points
      inputRef.current = ''
      setTargetText('')
      showFeedback(`+${points} PTS`, 'success')
      return ''
    }
    setTargetText(match?.text ?? '')
    return value
  }, [showFeedback])

  return (
    <div
      className="game-container"
      ref={containerRef}
      style={{
        '--game-width': `${gameViewport.width}px`,
        '--game-height': `${gameViewport.height}px`,
        '--keyboard-inset': `${gameViewport.keyboardInset}px`,
        '--keyboard-offset': `${-gameViewport.keyboardInset}px`,
      } as CSSProperties}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="game-canvas"
      />
      <HUD
        score={hudState.score}
        combo={hudState.combo}
        lives={hudState.lives}
        level={hudState.level}
        tier={hudState.tier}
        levelProgress={hudState.levelProgress}
        secondsToNextLevel={hudState.secondsToNextLevel}
      />
      <div
        className={`target-indicator ${targetText ? 'target-active' : ''}`}
        style={{ transform: `translate3d(-50%, ${-gameViewport.keyboardInset}px, 0)` }}
        aria-live="polite"
      >
        {targetText ? <>TARGET <strong>{targetText}</strong></> : 'TYPE TO TARGET THE LOWEST MATCHING WORD'}
      </div>
      {feedback && (
        <div key={feedback.id} className={`game-feedback feedback-${feedback.tone}`} aria-live="assertive">
          {feedback.message}
        </div>
      )}
      <InputBar
        onInput={handleInput}
        keyboardInset={gameViewport.keyboardInset}
      />
    </div>
  )
}
