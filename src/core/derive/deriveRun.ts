// Per-row and per-run derivations over a normalized run.
import type { NormalizedRun } from '../model/normalize.ts'
import type { LogRow } from '../model/types.ts'
import type { DepthRules } from './blocks.ts'
import type { RunSummary } from './summary.ts'
import type { VariableIndex } from './variables.ts'

export interface DerivedRun {
  /** New rows with effect, depth and searchText filled; the input rows are not changed. */
  rows: LogRow[]
  variables: VariableIndex
  summary: RunSummary
}

export function deriveRun(run: NormalizedRun, rules?: DepthRules): DerivedRun {
  void run
  void rules
  throw new Error('not implemented')
}
