// Keyboard navigation over the (filtered) execution log.
import type { LogRow } from '../model/types.ts'

/**
 * The Log index one row up (delta < 0) or down (delta > 0) from the selection, stopping at
 * the ends. With no selection it starts at the first (down) or last (up) row; a selection
 * hidden by the filters moves to the nearest visible row in that direction.
 */
export function stepSelection(
  rows: readonly Pick<LogRow, 'logIndex'>[],
  current: number | null,
  delta: number,
): number | null {
  if (rows.length === 0) return null
  const last = rows.length - 1
  if (current === null) return rows[delta < 0 ? last : 0]!.logIndex
  const at = rows.findIndex((r) => r.logIndex === current)
  if (at >= 0) return rows[Math.min(last, Math.max(0, at + delta))]!.logIndex
  if (delta > 0) return (rows.find((r) => r.logIndex > current) ?? rows[last]!).logIndex
  return (rows.findLast((r) => r.logIndex < current) ?? rows[0]!).logIndex
}

/** The next failed row after the selection, wrapping round to the first; null if none failed. */
export function nextFailure(
  rows: readonly Pick<LogRow, 'logIndex' | 'isFailure'>[],
  current: number | null,
): number | null {
  const after = rows.find((r) => r.isFailure && (current === null || r.logIndex > current))
  return (after ?? rows.find((r) => r.isFailure))?.logIndex ?? null
}
