import { describe, expect, it } from 'vitest'

describe('smoke', () => {
  it('runs the test toolchain', () => {
    expect(10_000_000n * 2n).toBe(20_000_000n)
  })
})
