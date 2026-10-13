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

/** Variables in order of first assignment, filtered by name (case-insensitive). */
export function variableSummaries(index: VariableIndex, query = ''): VariableSummary[] {
  const q = query.trim().toLowerCase()
  const list: VariableSummary[] = []
  for (const [name, assignments] of index) {
    if (q && !name.toLowerCase().includes(q)) continue
    list.push({
      name,
      count: assignments.length,
      first: assignments[0]!,
      last: assignments.at(-1)!,
    })
  }
  return list
}
