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

/** Parses PAD run-log CSV text (RFC 4180) and validates its headers. */
export function parseCsv(text: string): ParseCsvResult {
  const result = Papa.parse<string[]>(stripBom(text), { skipEmptyLines: 'greedy' })
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
