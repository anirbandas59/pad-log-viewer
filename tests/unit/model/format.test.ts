import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration } from '../../../src/core/model/format.ts'

describe('formatDuration', () => {
  it.each([
    [0n, '0 µs'],
    [3n, '0.3 µs'],
    [9_999n, '999.9 µs'],
    [10_000n, '1 ms'],
    [9_990_000n, '999 ms'],
    [10_000_000n, '1.0 s'],
    [123_400_000n, '12.3 s'],
    [599_999_999n, '60.0 s'],
    [600_000_000n, '1m 00s'],
    [1_357_370_000n, '2m 15s'],
    [36_000_000_000n, '1h 00m'],
    [45_300_000_000n, '1h 15m'],
  ])('%s ticks → %s', (ticks, text) => {
    expect(formatDuration(ticks)).toBe(text)
  })

  it('shows a dash for a negative duration', () => {
    expect(formatDuration(-1n)).toBe('—')
  })
})

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1536, '1.5 KB'],
    [2_411_724, '2.3 MB'],
    [1_181_116_006, '1.1 GB'],
  ])('%s → %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text)
  })
})
