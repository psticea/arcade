import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { App } from '../App.tsx'

describe('App rendering', () => {
  it('should render the start screen', () => {
    const { container } = render(<App />)
    console.log('HTML output:', container.innerHTML)
    expect(container.innerHTML).toContain('PRESS ENTER TO START')
  })
})
