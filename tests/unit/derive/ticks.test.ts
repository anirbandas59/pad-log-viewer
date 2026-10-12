import { describe, expect, it } from 'vitest'
import {
  TICKS_PER_MS,
  TICKS_PER_SECOND,
  durationTicks,
  parseTimestamp,
  ticksToIso,
} from '../../../src/core/derive/ticks.ts'

const BASE = BigInt(Date.UTC(2026, 9, 1, 9, 15, 30)) * TICKS_PER_MS

describe('parseTimestamp', () => {
  it('parses ISO 8601 with 7 fractional digits into exact ticks', () => {
    expect(parseTimestamp('2026-10-01T09:15:30.1234567Z')).toBe(BASE + 1_234_567n)
  })

  it('accepts a space separator and treats a missing zone as UTC', () => {
    expect(parseTimestamp('2026-10-01 09:15:30.1234567')).toBe(BASE + 1_234_567n)
  })

  it('applies an explicit UTC offset', () => {
    expect(parseTimestamp('2026-10-01T11:15:30.0000001+02:00')).toBe(BASE + 1n)
    expect(parseTimestamp('2026-10-01T08:45:30.0000000-00:30')).toBe(BASE)
  })

  it('pads shorter fractions and accepts no fraction', () => {
    expect(parseTimestamp('2026-10-01T09:15:30.5Z')).toBe(BASE + 5_000_000n)
    expect(parseTimestamp('2026-10-01T09:15:30Z')).toBe(BASE)
  })

  it('parses the US short format with AM/PM', () => {
    expect(parseTimestamp('10/1/2026 9:15:30.1234567 AM')).toBe(BASE + 1_234_567n)
    expect(parseTimestamp('10/1/2026 9:15:30.1234567 PM')).toBe(
      BASE + 12n * 3600n * TICKS_PER_SECOND + 1_234_567n,
    )
    expect(parseTimestamp('10/01/2026 12:00:00 AM')).toBe(
      BigInt(Date.UTC(2026, 9, 1)) * TICKS_PER_MS,
    )
  })

  it('trims surrounding whitespace', () => {
    expect(parseTimestamp('  2026-10-01T09:15:30.1234567Z ')).toBe(BASE + 1_234_567n)
  })

  it('returns null for empty, malformed or out-of-range values', () => {
    for (const bad of [
      '',
      'yesterday',
      '2026-13-01T00:00:00Z',
      '2026-02-30T00:00:00Z',
      '2026-10-01T25:00:00Z',
      '2026-10-01T09:15:30.12345678Z',
    ]) {
      expect(parseTimestamp(bad), bad).toBeNull()
    }
  })
})

describe('durationTicks', () => {
  it('keeps sub-millisecond durations exact', () => {
    const start = parseTimestamp('2026-10-01T09:15:30.0000001Z')!
    const end = parseTimestamp('2026-10-01T09:15:30.0000004Z')!
    expect(durationTicks(start, end)).toBe(3n)
  })

  it('is end minus start across seconds', () => {
    const start = parseTimestamp('2026-10-01T09:15:30.9999999Z')!
    const end = parseTimestamp('2026-10-01T09:15:31.0000002Z')!
    expect(durationTicks(start, end)).toBe(3n)
  })
})

describe('ticksToIso', () => {
  it('formats ticks back to ISO with 7 fractional digits', () => {
    expect(ticksToIso(BASE + 1_234_567n)).toBe('2026-10-01T09:15:30.1234567Z')
    expect(ticksToIso(BASE + 1n)).toBe('2026-10-01T09:15:30.0000001Z')
  })

  it('round-trips parseTimestamp', () => {
    const iso = '2024-02-29T23:59:59.9999999Z'
    expect(ticksToIso(parseTimestamp(iso)!)).toBe(iso)
  })
})
