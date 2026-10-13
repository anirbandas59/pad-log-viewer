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

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

/**
 * Run-level metrics over rows sorted by Log index. Time per subflow gives each row the
 * time from its start to the next row's start (the last row: to run end), so a Run
 * subflow action is not counted twice and the parts add up to the run duration.
 */
export function summarizeRun(
  rows: readonly LogRow[],
  runStart: bigint,
  runEnd: bigint,
): RunSummary {
  const facets = {
    subflow: new Map<string, number>(),
    module: new Map<string, number>(),
    status: new Map<string, number>(),
    level: new Map<string, number>(),
  }
  const time = new Map<string, bigint>()
  let failureCount = 0
  let warningCount = 0
  let firstFailure: LogRow | null = null

  rows.forEach((row, i) => {
    bump(facets.subflow, row.subflow)
    bump(facets.module, row.moduleDisplay)
    bump(facets.status, row.status)
    bump(facets.level, row.level)
    if (row.isFailure) {
      failureCount++
      firstFailure ??= row
    }
    if (/warn/i.test(row.level)) warningCount++
    const sliceEnd = rows[i + 1]?.startTicks ?? runEnd
    const slice = sliceEnd > row.startTicks ? sliceEnd - row.startTicks : 0n
    time.set(row.subflow, (time.get(row.subflow) ?? 0n) + slice)
  })

  const slowest = [...rows]
    .sort((a, b) =>
      a.durationTicks === b.durationTicks
        ? a.logIndex - b.logIndex
        : a.durationTicks > b.durationTicks
          ? -1
          : 1,
    )
    .slice(0, SLOWEST_COUNT)
  const timePerSubflow = [...time]
    .map(([subflow, ticks]) => ({ subflow, ticks }))
    .sort((a, b) => (a.ticks === b.ticks ? 0 : a.ticks > b.ticks ? -1 : 1))

  return {
    durationTicks: runEnd - runStart,
    rowCount: rows.length,
    subflowCount: facets.subflow.size,
    failureCount,
    warningCount,
    overallStatus: rows.length === 0 ? 'Unknown' : failureCount > 0 ? 'Failed' : 'Succeeded',
    firstFailure,
    slowest,
    timePerSubflow,
    facets,
  }
}
