// Errors tab: each failed row with the rows before it.
import type { LogRow } from '../model/types.ts'

export interface ErrorContext<T> {
  failure: T
  /** Up to `before` rows just before the failure, in Log index order. */
  before: T[]
}

/** Every failed row in Log index order, each with the rows that led up to it. */
export function errorContexts<T extends Pick<LogRow, 'logIndex' | 'isFailure'>>(
  rows: readonly T[],
  before = 3,
): ErrorContext<T>[] {
  const ordered = [...rows].sort((a, b) => a.logIndex - b.logIndex)
  const result: ErrorContext<T>[] = []
  ordered.forEach((row, i) => {
    if (row.isFailure)
      result.push({ failure: row, before: ordered.slice(Math.max(0, i - before), i) })
  })
  return result
}
