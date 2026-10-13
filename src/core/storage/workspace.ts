// Workspace bundle export/import.
/* eslint-disable @typescript-eslint/no-unused-vars -- stubs; removed when implemented */
import type { Annotation, RunMeta } from '../model/types.ts'
import type { PadDb } from './db.ts'

export const WORKSPACE_FORMAT = 'pad-log-viewer-workspace'
export const WORKSPACE_SCHEMA_VERSION = 1

export interface WorkspaceRun {
  meta: RunMeta
  csv: string
  annotations: Omit<Annotation, 'id' | 'runId'>[]
}

export interface WorkspaceBundle {
  format: typeof WORKSPACE_FORMAT
  schemaVersion: number
  exportedAt: string
  runs: WorkspaceRun[]
}

export type ParseWorkspaceResult =
  { ok: true; bundle: WorkspaceBundle } | { ok: false; error: string }

export interface ImportPlan {
  added: string[]
  conflicts: string[]
}

export interface ImportResult {
  added: string[]
  replaced: string[]
  skipped: string[]
}

export function exportWorkspace(_db: PadDb, _now?: Date): Promise<WorkspaceBundle> {
  throw new Error('not implemented')
}

export function serializeWorkspace(_bundle: WorkspaceBundle): string {
  throw new Error('not implemented')
}

export function parseWorkspace(_text: string): ParseWorkspaceResult {
  throw new Error('not implemented')
}

export function workspaceFileName(_now: Date): string {
  throw new Error('not implemented')
}

export function planImport(_db: PadDb, _bundle: WorkspaceBundle): Promise<ImportPlan> {
  throw new Error('not implemented')
}

export function importWorkspace(
  _db: PadDb,
  _bundle: WorkspaceBundle,
  _options?: { overwrite?: ReadonlySet<string> },
): Promise<ImportResult> {
  throw new Error('not implemented')
}
