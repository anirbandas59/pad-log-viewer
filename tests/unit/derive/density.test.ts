// M7: density toggle.
import { describe, expect, it } from 'vitest'
import { ROW_HEIGHT, readDensity } from '../../../src/core/derive/density.ts'

describe('density', () => {
  it('has comfortable 40 px and compact 28 px rows', () => {
    expect(ROW_HEIGHT).toEqual({ comfortable: 40, compact: 28 })
  })

  it('reads a stored density, defaulting to comfortable', () => {
    expect(readDensity('compact')).toBe('compact')
    expect(readDensity('comfortable')).toBe('comfortable')
    expect(readDensity(undefined)).toBe('comfortable')
    expect(readDensity('tiny')).toBe('comfortable')
    expect(readDensity(28)).toBe('comfortable')
  })
})
