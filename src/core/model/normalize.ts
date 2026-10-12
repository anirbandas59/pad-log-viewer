// Raw CSV row to LogRow.
import type { RawRow } from '../csv/parseCsv.ts'
import type { ColumnKey } from '../csv/schema.ts'
import { parsePayload } from '../derive/payload.ts'
import { durationTicks, parseTimestamp } from '../derive/ticks.ts'
import type { LogRow } from './types.ts'

export interface NormalizeIssue {
  /** Log index of the affected row, or the 1-based data row when Log index is unreadable. */
  row: number
  message: string
}

export interface NormalizedRun {
  /** Sorted by Log index. */
  rows: LogRow[]
  runStart: bigint
  runEnd: bigint
  issues: NormalizeIssue[]
}

export function isFailureRow(status: string, level: string): boolean {
  return /fail/i.test(status) || /error|critical|fatal/i.test(level)
}

const INTEGER = /^\s*-?\d+\s*$/

/**
 * Turns parsed CSV rows into LogRows sorted by Log index. Rows with an
 * unreadable Log index are skipped; unreadable timestamps fall back (start →
 * run start, end → start) so the row stays visible. Both are reported in
 * `issues`. Effect, depth and search text are derived later (M2).
 */
export function normalizeRows(
  rows: readonly RawRow[],
  mapping: Partial<Record<ColumnKey, string>>,
): NormalizedRun {
  const known = new Set(Object.values(mapping))
  const get = (raw: RawRow, key: ColumnKey): string => {
    const header = mapping[key]
    return header === undefined ? '' : (raw[header] ?? '')
  }

  const issues: NormalizeIssue[] = []
  const out: LogRow[] = []
  const missingStart: LogRow[] = []
  let runStart: bigint | null = null
  let runEnd: bigint | null = null

  rows.forEach((raw, i) => {
    const logIndexText = get(raw, 'logIndex')
    if (!INTEGER.test(logIndexText)) {
      issues.push({ row: i + 1, message: `Unreadable Log index "${logIndexText}"; row skipped.` })
      return
    }
    const logIndex = Number(logIndexText)
    const actionIndexText = get(raw, 'actionIndex')
    const actionIndex = INTEGER.test(actionIndexText) ? Number(actionIndexText) : 0

    const startText = get(raw, 'startTime')
    const endText = get(raw, 'endTime')
    const start = parseTimestamp(startText)
    const end = parseTimestamp(endText)
    const bad = [start === null && 'Start time', end === null && 'End time'].filter(Boolean)
    if (bad.length > 0) {
      issues.push({ row: logIndex, message: `Unreadable ${bad.join(' and ')}.` })
    }

    const inputs = parsePayload(get(raw, 'inputs'))
    const outputs = parsePayload(get(raw, 'outputs'))
    const status = get(raw, 'status')
    const level = get(raw, 'logLevel')

    const extra: Record<string, string> = {}
    for (const header in raw) if (!known.has(header)) extra[header] = raw[header]!

    const startTicks = start ?? end ?? 0n
    const endTicks = end ?? startTicks
    const row: LogRow = {
      logIndex,
      actionIndex,
      subflow: get(raw, 'subflow'),
      module: get(raw, 'moduleName'),
      moduleDisplay: get(raw, 'moduleDisplayName'),
      action: get(raw, 'actionName'),
      actionDisplay: get(raw, 'actionDisplayName'),
      level,
      message: get(raw, 'logMessage'),
      status,
      startTicks,
      endTicks,
      startIso: start === null ? '' : startText.trim(),
      endIso: end === null ? '' : endText.trim(),
      durationTicks: durationTicks(startTicks, endTicks),
      offsetTicks: 0n,
      inputs: inputs.params,
      outputs: outputs.params,
      inputsRaw: inputs.raw,
      outputsRaw: outputs.raw,
      payloadMalformed: inputs.malformed || outputs.malformed,
      truncated: inputs.truncated || outputs.truncated,
      extra,
      effect: '',
      depth: 0,
      isFailure: isFailureRow(status, level),
      searchText: '',
    }
    if (start === null && end === null) missingStart.push(row)
    else {
      if (runStart === null || startTicks < runStart) runStart = startTicks
      if (runEnd === null || endTicks > runEnd) runEnd = endTicks
    }
    out.push(row)
  })

  const first = runStart ?? 0n
  for (const row of missingStart) {
    row.startTicks = first
    row.endTicks = first
  }
  for (const row of out) row.offsetTicks = row.startTicks - first
  out.sort((a, b) => a.logIndex - b.logIndex)
  return { rows: out, runStart: first, runEnd: runEnd ?? first, issues }
}
