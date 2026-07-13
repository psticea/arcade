import { describe, expect, it } from 'vitest'
import { calculateKeyboardInset, isKeyboardViewport } from '../game/mobileViewport.ts'

describe('calculateKeyboardInset', () => {
  it('returns the covered portion of a stable viewport', () => {
    expect(calculateKeyboardInset(844, 500, 0)).toBe(344)
  })

  it('accounts for a shifted visual viewport', () => {
    expect(calculateKeyboardInset(844, 500, 24)).toBe(320)
  })

  it('ignores small browser chrome changes', () => {
    expect(calculateKeyboardInset(844, 790, 0)).toBe(0)
  })

  it('never returns a negative inset', () => {
    expect(calculateKeyboardInset(700, 760, 0)).toBe(0)
  })
})

describe('isKeyboardViewport', () => {
  it('recognizes a focused-input height drop as a keyboard', () => {
    expect(isKeyboardViewport(390, 844, 390, 500, true)).toBe(true)
  })

  it('does not mistake a resize without input focus for a keyboard', () => {
    expect(isKeyboardViewport(390, 844, 390, 500, false)).toBe(false)
  })

  it('does not mistake an orientation change for a keyboard', () => {
    expect(isKeyboardViewport(390, 844, 844, 390, true)).toBe(false)
  })
})