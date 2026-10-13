// Variable assignment index.
import type { LogRow } from '../model/types.ts'

export interface Assignment {
  logIndex: number
  subflow: string
  value: string
  truncated: boolean
}

/** Variable name → assignments ordered by Log index; names in order of first assignment. */
export type VariableIndex = Map<string, Assignment[]>

export function buildVariableIndex(
  rows: readonly Pick<LogRow, 'logIndex' | 'subflow' | 'outputs'>[],
): VariableIndex {
  void rows
  throw new Error('not implemented')
}
