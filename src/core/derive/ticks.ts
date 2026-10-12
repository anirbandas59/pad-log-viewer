// 7-digit timestamps to BigInt ticks; durations.

export const TICKS_PER_MS = 10_000n
export const TICKS_PER_SECOND = 10_000_000n

export function parseTimestamp(text: string): bigint | null {
  void text
  throw new Error('not implemented')
}

export function ticksToIso(ticks: bigint): string {
  void ticks
  throw new Error('not implemented')
}

export function durationTicks(start: bigint, end: bigint): bigint {
  void start
  void end
  throw new Error('not implemented')
}
