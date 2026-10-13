// "Export filtered CSV": rows back to PAD run-log CSV that re-imports cleanly.
import Papa from 'papaparse'
import { COLUMNS } from '../csv/schema.ts'
import type { LogRow } from '../model/types.ts'

/** The PAD columns, in portal export order. */
export const EXPORT_HEADERS: readonly string[] = COLUMNS.map((c) => c.header)

/** Each cell as the row read it: timestamps and Inputs/Outputs verbatim, numbers as text. */
function cells(row: LogRow): string[] {
  return [
    row.startIso,
    row.endIso,
    row.subflow,
    String(row.logIndex),
    String(row.actionIndex),
    row.module,
    row.action,
    row.moduleDisplay,
    row.actionDisplay,
    row.level,
    row.message,
    row.status,
    row.inputsRaw,
    row.outputsRaw,
  ]
}

/**
 * The rows as a PAD run-log CSV, laid out like a portal export (BOM, `sep=,` line, CRLF)
 * with any extra columns after the PAD ones. Values are written exactly as read, so the
 * file parses back to the same rows. Like the portal export, cells are not escaped for
 * spreadsheet formulas: doing so would change the values.
 */
export function rowsToCsv(rows: readonly LogRow[]): string {
  const extra: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const header of Object.keys(row.extra)) {
      if (!seen.has(header)) {
        seen.add(header)
        extra.push(header)
      }
    }
  }
  const body = Papa.unparse(
    {
      fields: [...EXPORT_HEADERS, ...extra],
      data: rows.map((row) => [...cells(row), ...extra.map((h) => row.extra[h] ?? '')]),
    },
    { newline: '\r\n' },
  )
  // Papa ends a header-only file with a line break of its own.
  return `\uFEFFsep=,\r\n${body.replace(/\r\n$/, '')}\r\n`
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * `<flow>-filtered-<yyyyMMddTHHmmssZ>.csv`. It deliberately carries no run GUID: dropped
 * back in, it is stored as a run of its own rather than offered as a Replace of the full run.
 */
export function filteredFileName(flowName: string, now: Date): string {
  const safe = flowName.replace(/[\\/:*?"<>|]/g, '_')
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  return `${safe}-filtered-${stamp}.csv`
}
