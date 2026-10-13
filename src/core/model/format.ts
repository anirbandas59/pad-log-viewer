// Display formatting shared by the UI.

/** A duration in ticks (100 ns), from `0.3 µs` up to `1h 15m`; `—` when negative. */
export function formatDuration(ticks: bigint): string {
  if (ticks < 0n) return '—'
  if (ticks < 10_000n) {
    const us = Number(ticks) / 10
    return `${Number.isInteger(us) ? us : us.toFixed(1)} µs`
  }
  if (ticks < 10_000_000n) return `${ticks / 10_000n} ms`
  const seconds = Number(ticks) / 1e7
  if (ticks < 600_000_000n) return `${seconds.toFixed(1)} s`
  const whole = Math.floor(seconds)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (whole < 3600) return `${Math.floor(whole / 60)}m ${pad(whole % 60)}s`
  return `${Math.floor(whole / 3600)}h ${pad(Math.floor((whole % 3600) / 60))}m`
}

/** A byte count as B, KB, MB or GB (powers of 1024). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

export function formatOffset(ticks: bigint): string {
  void ticks
  throw new Error('not implemented')
}
