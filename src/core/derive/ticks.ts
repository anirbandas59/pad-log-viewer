// 7-digit timestamps to BigInt ticks; durations.
//
// Ticks are 100 ns units since the Unix epoch, UTC. JavaScript Date keeps only
// milliseconds, so the fractional part is read as text and added as BigInt.

export const TICKS_PER_MS = 10_000n
export const TICKS_PER_SECOND = 10_000_000n

// 2026-10-01T09:15:30.1234567Z, space separator allowed, zone optional (UTC when absent).
const ISO =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(Z|[+-]\d{2}:?\d{2})?$/i
// 10/1/2026 9:15:30.1234567 AM (month/day/year, 12- or 24-hour clock).
const US = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))? ?(AM|PM)?$/i

function utcTicks(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  fraction: string | undefined,
): bigint | null {
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null
  const ms = Date.UTC(year, month - 1, day, hour, minute, second)
  const check = new Date(ms)
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  const frac = BigInt((fraction ?? '').padEnd(7, '0'))
  return BigInt(ms) * TICKS_PER_MS + frac
}

function offsetTicks(zone: string | undefined): bigint {
  if (!zone || zone.toUpperCase() === 'Z') return 0n
  const sign = zone.startsWith('-') ? -1n : 1n
  const digits = zone.slice(1).replace(':', '')
  const minutes = BigInt(Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)))
  return sign * minutes * 60n * TICKS_PER_SECOND
}

/** Parses a PAD timestamp into ticks; null when the text is not a valid timestamp. */
export function parseTimestamp(text: string): bigint | null {
  const s = text.trim()
  let m = ISO.exec(s)
  if (m) {
    const [, y, mo, d, h, mi, se, frac, zone] = m
    const t = utcTicks(+y!, +mo!, +d!, +h!, +mi!, +se!, frac)
    return t === null ? null : t - offsetTicks(zone)
  }
  m = US.exec(s)
  if (m) {
    const [, mo, d, y, h, mi, se, frac, ampm] = m
    let hour = +h!
    if (ampm) {
      if (hour < 1 || hour > 12) return null
      hour = (hour % 12) + (ampm.toUpperCase() === 'PM' ? 12 : 0)
    }
    return utcTicks(+y!, +mo!, +d!, hour, +mi!, +se!, frac)
  }
  return null
}

/** Formats ticks as ISO 8601 UTC with 7 fractional digits. */
export function ticksToIso(ticks: bigint): string {
  let seconds = ticks / TICKS_PER_SECOND
  let frac = ticks % TICKS_PER_SECOND
  if (frac < 0n) {
    frac += TICKS_PER_SECOND
    seconds -= 1n
  }
  const base = new Date(Number(seconds) * 1000).toISOString().slice(0, 19)
  return `${base}.${frac.toString().padStart(7, '0')}Z`
}

/** end − start in ticks. Negative when the log has end before start. */
export function durationTicks(start: bigint, end: bigint): bigint {
  return end - start
}
