// A dropped file → stored run: identify, parse, normalize and summarize (pipeline stages 1–4, 6.3).
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

export function contentRunId(text: string): string {
  void text
  throw new Error('not implemented')
}

export function ingestCsv(fileName: string, text: string, importedAt: Date): IngestResult {
  void fileName
  void text
  void importedAt
  throw new Error('not implemented')
}

export type DropKind = 'new' | 'sameExport' | 'reExport'

export interface DropDecision {
  kind: DropKind
  /** The stored run it matches, for sameExport and reExport. */
  existing?: RunMeta
}

export function classifyDrop(meta: RunMeta, existing: readonly RunMeta[]): DropDecision {
  void meta
  void existing
  throw new Error('not implemented')
}
