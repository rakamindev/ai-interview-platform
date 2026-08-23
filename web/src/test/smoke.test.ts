import { describe, it, expect } from 'vitest'

describe('Test harness smoke test', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should have access to DOM APIs (jsdom)', () => {
    const div = document.createElement('div')
    div.textContent = 'Hello'
    expect(div.textContent).toBe('Hello')
  })
})
