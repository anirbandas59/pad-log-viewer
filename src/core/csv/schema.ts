// Expected CSV columns and header aliases.

export type ColumnKey =
  | 'startTime'
  | 'endTime'
  | 'subflow'
  | 'logIndex'
  | 'actionIndex'
  | 'moduleName'
  | 'actionName'
  | 'moduleDisplayName'
  | 'actionDisplayName'
  | 'logLevel'
  | 'logMessage'
  | 'status'
  | 'inputs'
  | 'outputs'

export interface ColumnSpec {
  key: ColumnKey
  header: string
  required: boolean
  aliases: string[]
}

export const COLUMNS: readonly ColumnSpec[] = []

export interface HeaderResolution {
  /** Column key → original header text in the file. */
  mapping: Partial<Record<ColumnKey, string>>
  /** Canonical names of required columns that are absent. */
  missing: string[]
  /** Headers that match no known column, in file order. */
  extra: string[]
}

export function normalizeHeader(header: string): string {
  void header
  throw new Error('not implemented')
}

export function resolveHeaders(headers: readonly string[]): HeaderResolution {
  void headers
  throw new Error('not implemented')
}
