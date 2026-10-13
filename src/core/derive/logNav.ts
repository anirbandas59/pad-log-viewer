// Keyboard navigation over the (filtered) execution log.
import type { LogRow } from '../model/types.ts'

export function stepSelection(
  rows: readonly Pick<LogRow, 'logIndex'>[],
  current: number | null,
  delta: number,
): number | null {
  void rows
  void current
  void delta
  throw new Error('not implemented')
}

export function nextFailure(
  rows: readonly Pick<LogRow, 'logIndex' | 'isFailure'>[],
  current: number | null,
): number | null {
  void rows
  void current
  throw new Error('not implemented')
}
