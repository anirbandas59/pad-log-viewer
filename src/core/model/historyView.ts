// Search, filter and sort for the Home history list.
import type { OverallStatus, RunMeta } from './types.ts'

export type HistorySort = 'imported' | 'runStart' | 'duration'

export interface HistoryQuery {
  /** Matched case-insensitively against display name, flow name and file name. */
  text?: string
  status?: OverallStatus | 'all'
  /** null or undefined: any tag. */
  tag?: string | null
  sort?: HistorySort
}

const desc = (a: bigint, b: bigint) => (a === b ? 0 : a > b ? -1 : 1)

const SORTS: Record<HistorySort, (a: RunMeta, b: RunMeta) => number> = {
  imported: (a, b) => b.importedAt.localeCompare(a.importedAt),
  runStart: (a, b) => desc(a.runStart, b.runStart),
  duration: (a, b) => desc(a.durationTicks, b.durationTicks),
}

/** The runs matching every given filter, newest import first unless another sort is chosen. */
export function queryHistory(runs: readonly RunMeta[], query: HistoryQuery = {}): RunMeta[] {
  const text = query.text?.trim().toLowerCase() ?? ''
  const status = query.status ?? 'all'
  return runs
    .filter(
      (r) =>
        (status === 'all' || r.overallStatus === status) &&
        (!query.tag || r.tags.includes(query.tag)) &&
        (!text ||
          [r.displayName, r.flowName, r.fileName].some((s) => s.toLowerCase().includes(text))),
    )
    .sort(SORTS[query.sort ?? 'imported'])
}

/** Every tag used in history, once each, sorted. */
export function historyTags(runs: readonly RunMeta[]): string[] {
  return [...new Set(runs.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b))
}
