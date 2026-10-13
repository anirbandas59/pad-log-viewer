// Execution-log filters: search, facets, Errors only and Hide noise.
/* eslint-disable @typescript-eslint/no-unused-vars -- M7 stubs until the implementation lands */
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
  bookmarkedOnly: boolean
}

export const EMPTY_FILTERS: LogFilters = {
  text: '',
  subflows: [],
  statuses: [],
  modules: [],
  errorsOnly: false,
  hideNoise: false,
  bookmarkedOnly: false,
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

/** The status shown for a row: failures first, then warnings by Log level. */
export function rowStatusKind(row: Pick<LogRow, 'status' | 'level' | 'isFailure'>): RowStatusKind {
  if (row.isFailure) return 'Failed'
  if (/warn/i.test(row.level)) return 'Warning'
  if (/^succeeded$/i.test(row.status)) return 'Succeeded'
  return 'Unknown'
}

// "Hide noise" collapses Set variable and If/Else rows (architecture: Execution log table).
const NOISE = /^(variables\.(assign|setvariable)|conditionals\.(if|else|elseif))$/i

export function isNoise(row: Pick<LogRow, 'module' | 'action'>): boolean {
  return NOISE.test(`${row.module}.${row.action}`)
}

/**
 * Rows matching every active filter, in their original order: AND across facets and
 * toggles, OR within a facet. Search terms are matched against the precomputed,
 * lower-cased `searchText`.
 */
export function filterRows<T extends Row>(
  rows: readonly T[],
  filters: LogFilters,
  _bookmarked: ReadonlySet<number> = new Set(),
): T[] {
  const terms = filters.text.toLowerCase().split(/\s+/).filter(Boolean)
  const subflows = filters.subflows.length ? new Set(filters.subflows) : null
  const statuses = filters.statuses.length ? new Set(filters.statuses) : null
  const modules = filters.modules.length ? new Set(filters.modules) : null
  if (
    !terms.length &&
    !subflows &&
    !statuses &&
    !modules &&
    !filters.errorsOnly &&
    !filters.hideNoise
  ) {
    return [...rows]
  }
  return rows.filter(
    (row) =>
      (!filters.errorsOnly || row.isFailure) &&
      (!filters.hideNoise || !isNoise(row)) &&
      (!subflows || subflows.has(row.subflow)) &&
      (!modules || modules.has(row.moduleDisplay)) &&
      (!statuses || statuses.has(rowStatusKind(row))) &&
      terms.every((t) => row.searchText.includes(t)),
  )
}

/** Active filters for the "N filters" count: the search, each facet value and each toggle. */
export function activeFilterCount(filters: LogFilters): number {
  return (
    (filters.text.trim() ? 1 : 0) +
    filters.subflows.length +
    filters.statuses.length +
    filters.modules.length +
    (filters.errorsOnly ? 1 : 0) +
    (filters.hideNoise ? 1 : 0)
  )
}
