// Save, list and delete runs.
/* eslint-disable @typescript-eslint/no-unused-vars -- stubs; removed when implemented */
import type { Annotation, RunMeta } from '../model/types.ts'
import type { PadDb } from './db.ts'

export interface StoredRun {
  meta: RunMeta
  csv: string
}

export type RunPatch = Partial<Pick<RunMeta, 'displayName' | 'tags'>>

export function saveRun(_db: PadDb, _meta: RunMeta, _csv: string): Promise<void> {
  throw new Error('not implemented')
}

export function getRun(_db: PadDb, _id: string): Promise<StoredRun | undefined> {
  throw new Error('not implemented')
}

export function listRuns(_db: PadDb): Promise<RunMeta[]> {
  throw new Error('not implemented')
}

export function updateRun(_db: PadDb, _id: string, _patch: RunPatch): Promise<RunMeta | undefined> {
  throw new Error('not implemented')
}

export function deleteRun(_db: PadDb, _id: string): Promise<void> {
  throw new Error('not implemented')
}

export function clearHistory(_db: PadDb): Promise<void> {
  throw new Error('not implemented')
}

export function addAnnotation(_db: PadDb, _annotation: Omit<Annotation, 'id'>): Promise<number> {
  throw new Error('not implemented')
}

export function listAnnotations(_db: PadDb, _runId: string): Promise<Annotation[]> {
  throw new Error('not implemented')
}
