// IndexedDB schema and migrations.
/* eslint-disable @typescript-eslint/no-unused-vars -- stubs; removed when implemented */
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Annotation, RunMeta } from '../model/types.ts'

export const DB_NAME = 'pad-log-viewer'
export const DB_VERSION = 1

export interface PadLogViewerDB extends DBSchema {
  runs: {
    key: string
    value: RunMeta
    indexes: { importedAt: string; flowName: string; overallStatus: string }
  }
  /** Raw CSV text, keyed by run id. */
  files: { key: string; value: string }
  annotations: { key: number; value: Annotation; indexes: { runId: string } }
  settings: { key: string; value: unknown }
}

export type PadDb = IDBPDatabase<PadLogViewerDB>

export function openDb(): Promise<PadDb> {
  throw new Error('not implemented')
}

export function getSetting<T>(_db: PadDb, _key: string): Promise<T | undefined> {
  throw new Error('not implemented')
}

export function setSetting(_db: PadDb, _key: string, _value: unknown): Promise<void> {
  throw new Error('not implemented')
}
