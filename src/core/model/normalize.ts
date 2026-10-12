// Raw CSV row to LogRow.
import type { RawRow } from '../csv/parseCsv.ts'
import type { ColumnKey } from '../csv/schema.ts'
import type { LogRow } from './types.ts'

export interface NormalizeIssue {
  /** Log index of the affected row, or the 1-based data line when Log index is unreadable. */
  row: number
  message: string
}

export interface NormalizedRun {
  /** Sorted by Log index. */
  rows: LogRow[]
  runStart: bigint
  runEnd: bigint
  issues: NormalizeIssue[]
}

export function isFailureRow(status: string, level: string): boolean {
  void status
  void level
  throw new Error('not implemented')
}

export function normalizeRows(
  rows: readonly RawRow[],
  mapping: Partial<Record<ColumnKey, string>>,
): NormalizedRun {
  void rows
  void mapping
  throw new Error('not implemented')
}
