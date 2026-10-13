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

/** Time since run start as `+mm:ss.fff` (or `+h:mm:ss.fff`), milliseconds truncated. */
export function formatOffset(ticks: bigint): string {
  const sign = ticks < 0n ? '-' : '+'
  const totalMs = (ticks < 0n ? -ticks : ticks) / 10_000n
  const ms = Number(totalMs % 1000n)
  const totalSeconds = Number(totalMs / 1000n)
  const s = totalSeconds % 60
  const m = Math.floor(totalSeconds / 60) % 60
  const h = Math.floor(totalSeconds / 3600)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  const clock = `${pad(m)}:${pad(s)}.${pad(ms, 3)}`
  return h > 0 ? `${sign}${h}:${clock}` : `${sign}${clock}`
}
