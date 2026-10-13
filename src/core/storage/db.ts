// IndexedDB schema and migrations.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
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
  /** Theme, column visibility, storage-warning dismissed; keyed by setting name. */
  settings: { key: string; value: unknown }
}

export type PadDb = IDBPDatabase<PadLogViewerDB>

/**
 * Opens the app database, creating or migrating it to `DB_VERSION`. Each schema version adds
 * one `oldVersion < N` step, so a browser several versions behind replays them in order.
 * Rejects when IndexedDB is unavailable; the app then runs as a session-only viewer.
 */
export function openDb(): Promise<PadDb> {
  return openDB<PadLogViewerDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const runs = db.createObjectStore('runs', { keyPath: 'id' })
        runs.createIndex('importedAt', 'importedAt')
        runs.createIndex('flowName', 'flowName')
        runs.createIndex('overallStatus', 'overallStatus')
        db.createObjectStore('files')
        const annotations = db.createObjectStore('annotations', {
          keyPath: 'id',
          autoIncrement: true,
        })
        annotations.createIndex('runId', 'runId')
        db.createObjectStore('settings')
      }
    },
  })
}

export async function getSetting<T>(db: PadDb, key: string): Promise<T | undefined> {
  return (await db.get('settings', key)) as T | undefined
}

export async function setSetting(db: PadDb, key: string, value: unknown): Promise<void> {
  await db.put('settings', value, key)
}
