// UI formatting that depends on the viewer's locale.

/** Local date and time of a tick count (100 ns since the Unix epoch). */
export function formatTicks(ticks: bigint): string {
  return new Date(Number(ticks / 10_000n)).toLocaleString()
}
