import { useCallback, useEffect, useRef } from 'react'
import type { ArcadeKey, GameDefinition } from '../lib/types.ts'
import { holdKey, releaseKey } from './touch.ts'

interface Props {
  /** Which of the five keys this game actually uses. */
  keys: readonly ArcadeKey[]
  /** Label for the action button, e.g. "BLOOM" or "FLIP". */
  actionLabel: string
  /** Games needing only SPACE turn the whole play area into a tap target. */
  tapAnywhere?: boolean
  layout?: GameDefinition['touchLayout']
  labels?: GameDefinition['touchLabels']
  onPause: () => void
}

/**
 * On-screen controls for touch devices.
 *
 * Buttons hold their key for as long as a finger is down, so thrust, flippers
 * and the plunger charge behave the same as on a keyboard.
 */
export function TouchControls({ keys, actionLabel, tapAnywhere, layout, labels, onPause }: Props) {
  const heldRef = useRef(new Set<ArcadeKey>())

  // A finger lifted outside its button would otherwise leave the key stuck down.
  useEffect(() => {
    const releaseAll = () => {
      for (const key of heldRef.current) releaseKey(key)
      heldRef.current.clear()
    }
    window.addEventListener('pointerup', releaseAll)
    window.addEventListener('pointercancel', releaseAll)
    window.addEventListener('blur', releaseAll)
    return () => {
      releaseAll()
      window.removeEventListener('pointerup', releaseAll)
      window.removeEventListener('pointercancel', releaseAll)
      window.removeEventListener('blur', releaseAll)
    }
  }, [])

  const bind = useCallback((key: ArcadeKey) => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault()
      if (heldRef.current.has(key)) return
      heldRef.current.add(key)
      holdKey(key)
    },
    onPointerUp: (event: React.PointerEvent) => {
      event.preventDefault()
      if (!heldRef.current.delete(key)) return
      releaseKey(key)
    },
    onPointerLeave: () => {
      if (!heldRef.current.delete(key)) return
      releaseKey(key)
    },
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  }), [])

  const uses = (key: ArcadeKey) => keys.includes(key)

  return (
    <div className="touch-controls" aria-hidden="true">
      <button type="button" className="touch-pause" onClick={onPause}>❙❙</button>

      {tapAnywhere ? (
        <button type="button" className="touch-anywhere" {...bind('space')}>
          <span>TAP ANYWHERE TO {actionLabel}</span>
        </button>
      ) : layout === 'split' ? (
        <SplitControls uses={uses} bind={bind} labels={labels} actionLabel={actionLabel} />
      ) : (
        <div className="touch-pad">
          <div className="touch-dpad">
            {uses('up') && <button type="button" className="touch-btn up" {...bind('up')}>▲</button>}
            <div className="touch-row">
              {uses('left') && <button type="button" className="touch-btn" {...bind('left')}>◀</button>}
              {uses('right') && <button type="button" className="touch-btn" {...bind('right')}>▶</button>}
            </div>
            {uses('down') && <button type="button" className="touch-btn down" {...bind('down')}>▼</button>}
          </div>

          {uses('space') && (
            <button type="button" className="touch-action" {...bind('space')}>
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

type Binder = (key: ArcadeKey) => Record<string, unknown>

/**
 * Steering left, power right.
 *
 * A lander needs rotation and thrust at the same moment, and a cross d-pad
 * cannot give you that: one thumb ends up covering two axes while the other
 * reaches across the screen for the action button. Splitting the two roles
 * across the bottom corners puts every control under a thumb that is already
 * resting there, and lets the buttons be much larger than a cross allows.
 */
function SplitControls({
  uses, bind, labels, actionLabel,
}: {
  uses: (key: ArcadeKey) => boolean
  bind: Binder
  labels: GameDefinition['touchLabels']
  actionLabel: string
}) {
  return (
    <div className="touch-split">
      <div className="touch-steer">
        {uses('left') && <button type="button" className="touch-round" {...bind('left')}>◀</button>}
        {uses('right') && <button type="button" className="touch-round" {...bind('right')}>▶</button>}
      </div>

      <div className="touch-power">
        {uses('down') && (
          <button type="button" className="touch-minor" {...bind('down')}>
            {labels?.tertiary ?? 'LOOK'}
          </button>
        )}
        {uses('space') && (
          <button type="button" className="touch-minor is-hot" {...bind('space')}>
            {labels?.secondary ?? actionLabel}
          </button>
        )}
        {uses('up') && (
          <button type="button" className="touch-thrust" {...bind('up')}>
            {labels?.primary ?? 'THRUST'}
          </button>
        )}
      </div>
    </div>
  )
}
