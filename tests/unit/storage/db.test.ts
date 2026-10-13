import { beforeEach, describe, expect, it } from 'vitest'
import {
  DB_NAME,
  DB_VERSION,
  getSetting,
  openDb,
  setSetting,
} from '../../../src/core/storage/db.ts'
import { CSV, freshIndexedDb, makeMeta } from '../helpers/storage.ts'

beforeEach(freshIndexedDb)

describe('openDb', () => {
  it('opens database pad-log-viewer at schema version 1', async () => {
    const db = await openDb()
    expect(db.name).toBe(DB_NAME)
    expect(DB_NAME).toBe('pad-log-viewer')
    expect(db.version).toBe(DB_VERSION)
    expect(DB_VERSION).toBe(1)
    db.close()
  })

  it('creates the runs, files, annotations and settings stores with their keys and indexes', async () => {
    const db = await openDb()
    expect([...db.objectStoreNames].sort()).toEqual(['annotations', 'files', 'runs', 'settings'])
    const tx = db.transaction(['runs', 'files', 'annotations', 'settings'])
    const runs = tx.objectStore('runs')
    expect(runs.keyPath).toBe('id')
    expect([...runs.indexNames].sort()).toEqual(['flowName', 'importedAt', 'overallStatus'])
    const files = tx.objectStore('files')
    expect(files.keyPath).toBeNull()
    expect([...files.indexNames]).toEqual([])
    const annotations = tx.objectStore('annotations')
    expect(annotations.keyPath).toBe('id')
    expect(annotations.autoIncrement).toBe(true)
    expect([...annotations.indexNames]).toEqual(['runId'])
    expect(tx.objectStore('settings').keyPath).toBeNull()
    await tx.done
    db.close()
  })

  it('keeps stored data when the database is opened again', async () => {
    const first = await openDb()
    await first.put('runs', makeMeta())
    await first.put('files', CSV, makeMeta().id)
    first.close()
    const second = await openDb()
    expect(await second.get('runs', makeMeta().id)).toEqual(makeMeta())
    expect(await second.get('files', makeMeta().id)).toBe(CSV)
    second.close()
  })
})

describe('getSetting / setSetting', () => {
  it('returns undefined for a setting never written', async () => {
    const db = await openDb()
    expect(await getSetting(db, 'theme')).toBeUndefined()
    db.close()
  })

  it('round-trips structured values and overwrites by key', async () => {
    const db = await openDb()
    await setSetting(db, 'columns', { message: false, duration: true })
    await setSetting(db, 'theme', 'dark')
    await setSetting(db, 'theme', 'light')
    expect(await getSetting(db, 'columns')).toEqual({ message: false, duration: true })
    expect(await getSetting<string>(db, 'theme')).toBe('light')
    db.close()
  })
})
