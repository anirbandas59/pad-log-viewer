import { describe, expect, it } from 'vitest'
import { nextFailure, stepSelection } from '../../../src/core/derive/logNav.ts'

const rows = [2, 4, 6, 8].map((logIndex) => ({
  logIndex,
  isFailure: logIndex === 4 || logIndex === 8,
}))

describe('stepSelection', () => {
  it('moves up and down, stopping at the ends', () => {
    expect(stepSelection(rows, 4, 1)).toBe(6)
    expect(stepSelection(rows, 4, -1)).toBe(2)
    expect(stepSelection(rows, 8, 1)).toBe(8)
    expect(stepSelection(rows, 2, -1)).toBe(2)
  })

  it('starts at the first row going down and the last going up', () => {
    expect(stepSelection(rows, null, 1)).toBe(2)
    expect(stepSelection(rows, null, -1)).toBe(8)
  })

  it('moves to the nearest visible row when the selection was filtered out', () => {
    expect(stepSelection(rows, 5, 1)).toBe(6)
    expect(stepSelection(rows, 5, -1)).toBe(4)
    expect(stepSelection(rows, 99, -1)).toBe(8)
  })

  it('is null with no rows', () => {
    expect(stepSelection([], 3, 1)).toBeNull()
  })
})

describe('nextFailure', () => {
  it('finds the next failure after the selection, wrapping round', () => {
    expect(nextFailure(rows, null)).toBe(4)
    expect(nextFailure(rows, 4)).toBe(8)
    expect(nextFailure(rows, 5)).toBe(8)
    expect(nextFailure(rows, 8)).toBe(4)
  })

  it('is null when no row failed', () => {
    expect(nextFailure([{ logIndex: 1, isFailure: false }], null)).toBeNull()
  })
})
