// Run-level metrics and slowest actions.
import type { LogRow, OverallStatus } from '../model/types.ts'

export const SLOWEST_COUNT = 10

export interface SubflowTime {
  subflow: string
  ticks: bigint
}

export interface RunSummary {
  durationTicks: bigint
  rowCount: number
  subflowCount: number
  failureCount: number
  warningCount: number
  overallStatus: OverallStatus
  firstFailure: LogRow | null
  /** Up to 10 rows, longest first; ties by Log index. */
  slowest: LogRow[]
  /** Wall-clock time per subflow, largest first; sums to the run duration. */
  timePerSubflow: SubflowTime[]
  /** Value → row count, in order of first appearance. */
  facets: {
    subflow: Map<string, number>
    module: Map<string, number>
    status: Map<string, number>
    level: Map<string, number>
  }
}

export function summarizeRun(
  rows: readonly LogRow[],
  runStart: bigint,
  runEnd: bigint,
): RunSummary {
  void rows
  void runStart
  void runEnd
  throw new Error('not implemented')
}
