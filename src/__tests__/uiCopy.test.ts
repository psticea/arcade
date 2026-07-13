import { describe, expect, it } from 'vitest'
import { getUiCopy } from '../uiCopy.ts'

describe('getUiCopy', () => {
  it('provides distinct Romanian copy for every game surface', () => {
    const english = getUiCopy('english')
    const romanian = getUiCopy('romanian')

    expect(romanian.start.subtitle).not.toBe(english.start.subtitle)
    expect(romanian.hud.score).toBe('SCOR')
    expect(romanian.input.placeholder).not.toBe(english.input.placeholder)
    expect(romanian.game.targetPrompt).not.toBe(english.game.targetPrompt)
    expect(romanian.results.gameOver).toBe('JOC ÎNCHEIAT')
  })

  it('localizes dynamic feedback and accessibility text', () => {
    const romanian = getUiCopy('romanian')

    expect(romanian.hud.livesRemaining(2)).toContain('2')
    expect(romanian.game.target('casa')).toContain('casa')
    expect(romanian.game.missed(1, 5)).toContain('5')
    expect(romanian.game.points(40)).toContain('40')
  })

  it('provides labels for every difficulty tier', () => {
    for (const language of ['english', 'romanian'] as const) {
      expect(Object.keys(getUiCopy(language).difficulty)).toEqual([
        'easy',
        'medium',
        'hard',
        'expert',
      ])
    }
  })
})