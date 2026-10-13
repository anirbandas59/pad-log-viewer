// Execution-log filters: search, facets, Errors only and Hide noise.
import type { LogRow } from '../model/types.ts'

export type RowStatusKind = 'Succeeded' | 'Failed' | 'Warning' | 'Unknown'

export interface LogFilters {
  /** Whitespace-separated terms, all of which must occur in a row's search text. */
  text: string
  subflows: string[]
  statuses: RowStatusKind[]
  modules: string[]
  errorsOnly: boolean
  hideNoise: boolean
}

export const EMPTY_FILTERS: LogFilters = {
  text: '',
  subflows: [],
  statuses: [],
  modules: [],
  errorsOnly: false,
  hideNoise: false,
}

type Row = Pick<
  LogRow,
  | 'status'
  | 'level'
  | 'isFailure'
  | 'subflow'
  | 'moduleDisplay'
  | 'module'
  | 'action'
  | 'searchText'
>

export function rowStatusKind(row: Pick<LogRow, 'status' | 'level' | 'isFailure'>): RowStatusKind {
  void row
  throw new Error('not implemented')
}

export function isNoise(row: Pick<LogRow, 'module' | 'action'>): boolean {
  void row
  throw new Error('not implemented')
}

export function filterRows<T extends Row>(rows: readonly T[], filters: LogFilters): T[] {
  void rows
  void filters
  throw new Error('not implemented')
}

export function activeFilterCount(filters: LogFilters): number {
  void filters
  throw new Error('not implemented')
}
