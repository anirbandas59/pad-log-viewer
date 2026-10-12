// Papa Parse wrapper and header validation.
import type { ColumnKey } from './schema.ts'

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
  void text
  throw new Error('not implemented')
}

export function parseCsv(text: string): ParseCsvResult {
  void text
  throw new Error('not implemented')
}
