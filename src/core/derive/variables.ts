// Variable assignment index.
/* eslint-disable @typescript-eslint/no-unused-vars -- M7 stubs until the implementation lands */
import type { LogRow } from '../model/types.ts'

export interface Assignment {
  logIndex: number
  subflow: string
  value: string
  truncated: boolean
}

/** Variable name → assignments ordered by Log index; names in order of first assignment. */
export type VariableIndex = Map<string, Assignment[]>

/** Indexes every output parameter that names a variable (the variable it writes). */
export function buildVariableIndex(
  rows: readonly Pick<LogRow, 'logIndex' | 'subflow' | 'outputs'>[],
): VariableIndex {
  const ordered = [...rows].sort((a, b) => a.logIndex - b.logIndex)
  const index: VariableIndex = new Map()
  for (const row of ordered) {
    for (const p of row.outputs) {
      if (!p.variable) continue
      let list = index.get(p.variable)
      if (!list) index.set(p.variable, (list = []))
      list.push({
        logIndex: row.logIndex,
        subflow: row.subflow,
        value: p.value,
        truncated: p.truncated,
      })
    }
  }
  return index
}

export interface VariableSummary {
  name: string
  count: number
  first: Assignment
  last: Assignment
}

export function variableSummaries(_index: VariableIndex, _query = ''): VariableSummary[] {
  throw new Error('not implemented')
}
