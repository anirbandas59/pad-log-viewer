// Per-row and per-run derivations over a normalized run.
import type { NormalizedRun } from '../model/normalize.ts'
import type { LogRow } from '../model/types.ts'
import { DEFAULT_DEPTH_RULES, computeDepths, type DepthRules } from './blocks.ts'
import { effectSummary } from './effect.ts'
import { searchText } from './search.ts'
import { summarizeRun, type RunSummary } from './summary.ts'
import { buildVariableIndex, type VariableIndex } from './variables.ts'

export interface DerivedRun {
  /** New rows with effect, depth and searchText filled; the input rows are not changed. */
  rows: LogRow[]
  variables: VariableIndex
  summary: RunSummary
}

/** Pipeline stages 5–6: per-row derivations, then the per-run index and summary. */
export function deriveRun(run: NormalizedRun, rules: DepthRules = DEFAULT_DEPTH_RULES): DerivedRun {
  const depths = computeDepths(run.rows, rules)
  const rows = run.rows.map((row, i) => {
    const effect = effectSummary(row, rules)
    const derived: LogRow = { ...row, effect, depth: depths[i]! }
    derived.searchText = searchText(derived)
    return derived
  })
  return {
    rows,
    variables: buildVariableIndex(rows),
    summary: summarizeRun(rows, run.runStart, run.runEnd),
  }
}
