// Papa Parse wrapper and header validation.
import Papa from 'papaparse'
import { resolveHeaders, type ColumnKey } from './schema.ts'

export type RawRow = Record<string, string>

export interface ParsedCsv {
  ok: true
  headers: string[]
  rows: RawRow[]
  mapping: Partial<Record<ColumnKey, string>>
  extraColumns: string[]
  /** Non-fatal problems, e.g. a row with the wrong number of fields. */
  warnings: string[]
}

export type CsvError =
  | { kind: 'empty'; message: string }
  | { kind: 'missing-columns'; message: string; missing: string[] }

export type ParseCsvResult = ParsedCsv | { ok: false; error: CsvError }

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export interface SepLine {
  /** The skipped `sep=` line including its line break, or '' when there is none. */
  line: string
  delimiter: string | null
  /** Text after the BOM and the `sep=` line. */
  body: string
}

/** Splits off the Excel `sep=<char>` hint line that portal exports start with. */
export function splitSepLine(text: string): SepLine {
  const body = stripBom(text)
  const m = /^sep=(.)(\r\n|\n|\r)/i.exec(body)
  if (!m) return { line: '', delimiter: null, body }
  return { line: m[0], delimiter: m[1]!, body: body.slice(m[0].length) }
}

/** Parses PAD run-log CSV text (RFC 4180) and validates its headers. */
export function parseCsv(text: string): ParseCsvResult {
  const { body, delimiter } = splitSepLine(text)
  const result = Papa.parse<string[]>(body, {
    skipEmptyLines: 'greedy',
    // Papa auto-detects when the file gives no sep= hint.
    ...(delimiter ? { delimiter } : {}),
  })
  const [headerRow, ...dataRows] = result.data
  if (!headerRow || dataRows.length === 0) {
    return { ok: false, error: { kind: 'empty', message: 'The file has no log rows.' } }
  }
  const headers = headerRow.map((h) => h.trim())
  const { mapping, missing, extra } = resolveHeaders(headers)
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        kind: 'missing-columns',
        missing,
        message: `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
      },
    }
  }

  // Rows are counted from the first data row; embedded newlines make line numbers unreliable.
  const warnings = result.errors.map((e) => `Row ${e.row ?? 0}: ${e.message}`)
  const rows: RawRow[] = new Array(dataRows.length)
  for (let i = 0; i < dataRows.length; i++) {
    const fields = dataRows[i]!
    if (fields.length !== headers.length) {
      warnings.push(`Row ${i + 1}: expected ${headers.length} fields but found ${fields.length}.`)
    }
    const out: RawRow = {}
    // Duplicate headers: the first occurrence wins, matching resolveHeaders.
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c]!
      if (!(h in out)) out[h] = fields[c] ?? ''
    }
    rows[i] = out
  }
  return { ok: true, headers, rows, mapping, extraColumns: extra, warnings }
}
