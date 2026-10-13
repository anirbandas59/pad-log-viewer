// In-memory IndexedDB (fake-indexeddb) and RunMeta builders for the storage tests.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import type { RunMeta } from '../../../src/core/model/types.ts'

/** Replaces the global IndexedDB with an empty in-memory one, so each test starts clean. */
export function freshIndexedDb(): void {
  globalThis.indexedDB = new IDBFactory()
}

export function makeMeta(overrides: Partial<RunMeta> = {}): RunMeta {
  return {
    id: '0b5e2f6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b',
    flowName: 'Invoice_Main',
    fileName: 'Invoice_Main-0b5e2f6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b-20261012T113808Z.csv',
    exportedAt: '20261012T113808Z',
    // Beyond Number.MAX_SAFE_INTEGER, so a lossy round-trip through Number would show.
    runStart: 17602614900001234n,
    runEnd: 17602615200009876n,
    durationTicks: 300008642n,
    rowCount: 3,
    subflowCount: 1,
    failureCount: 0,
    overallStatus: 'Succeeded',
    importedAt: '2026-10-13T09:00:00.000Z',
    tags: [],
    displayName: 'Invoice_Main',
    ...overrides,
  }
}

export const CSV = 'sep=,\r\nStart time,End time\r\n"2026-10-12T11:38:08.1234567Z","…"\r\n'
