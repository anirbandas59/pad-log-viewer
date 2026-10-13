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

export function queryHistory(runs: readonly RunMeta[], query: HistoryQuery = {}): RunMeta[] {
  void runs
  void query
  throw new Error('not implemented')
}

export function historyTags(runs: readonly RunMeta[]): string[] {
  void runs
  throw new Error('not implemented')
}
