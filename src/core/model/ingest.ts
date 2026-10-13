// A dropped file → stored run: identify, parse, normalize and summarize (pipeline stages 1–4, 6.3).
import { parseFileName } from '../csv/fileName.ts'
import { parseCsv } from '../csv/parseCsv.ts'
import { summarizeRun } from '../derive/summary.ts'
import { normalizeRows } from './normalize.ts'
import type { RunMeta } from './types.ts'

export interface IngestedRun {
  meta: RunMeta
  /** The file text, as stored in history (re-derived on open). */
  csv: string
  /** Non-fatal problems: malformed rows, unreadable cells. */
  warnings: string[]
}

export type IngestResult =
  { ok: true; run: IngestedRun } | { ok: false; fileName: string; error: string }

// Two 32-bit FNV-1a hashes with different offsets: fast on multi-MB text, 64 bits of spread.
function fnv1a(text: string, seed: number): string {
  let h = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * History key for a file whose name carries no run GUID: derived from the content, so
 * dropping the same file again (under any name) is recognised as the same export.
 */
export function contentRunId(text: string): string {
  return `local-${fnv1a(text, 0x811c9dc5)}${fnv1a(text, 0x01000193)}`
}

export function ingestCsv(fileName: string, text: string, importedAt: Date): IngestResult {
  const fail = (error: string): IngestResult => ({ ok: false, fileName, error })
  if (!/\.csv$/i.test(fileName)) {
    return fail('Not a CSV file. Drop the .csv run log exported from Power Automate.')
  }
  const parsed = parseCsv(text)
  if (!parsed.ok) return fail(parsed.error.message)
  const run = normalizeRows(parsed.rows, parsed.mapping)
  if (run.rows.length === 0) return fail('No readable log rows: no row has a readable Log index.')

  const summary = summarizeRun(run.rows, run.runStart, run.runEnd)
  const info = parseFileName(fileName)
  const meta: RunMeta = {
    id: info.runId ?? contentRunId(text),
    flowName: info.flowName,
    fileName: info.fileName,
    exportedAt: info.exportedAt,
    runStart: run.runStart,
    runEnd: run.runEnd,
    durationTicks: summary.durationTicks,
    rowCount: summary.rowCount,
    subflowCount: summary.subflowCount,
    failureCount: summary.failureCount,
    overallStatus: summary.overallStatus,
    importedAt: importedAt.toISOString(),
    tags: [],
    displayName: info.flowName,
  }
  const warnings = [...parsed.warnings, ...run.issues.map((i) => `Row ${i.row}: ${i.message}`)]
  return { ok: true, run: { meta, csv: text, warnings } }
}

export type DropKind = 'new' | 'sameExport' | 'reExport'

export interface DropDecision {
  kind: DropKind
  /** The stored run it matches, for sameExport and reExport. */
  existing?: RunMeta
}

/**
 * Same run GUID and export timestamp: the same export dropped again. Same GUID, another
 * export timestamp: a re-export of a stored run (the UI offers Replace). Otherwise new.
 */
export function classifyDrop(meta: RunMeta, existing: readonly RunMeta[]): DropDecision {
  const match = existing.find((m) => m.id === meta.id)
  if (!match) return { kind: 'new' }
  return { kind: match.exportedAt === meta.exportedAt ? 'sameExport' : 'reExport', existing: match }
}
