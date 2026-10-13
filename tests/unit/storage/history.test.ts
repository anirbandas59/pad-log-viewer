import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDb, setSetting, getSetting, type PadDb } from '../../../src/core/storage/db.ts'
import {
  addAnnotation,
  clearHistory,
  deleteRun,
  getRun,
  listAnnotations,
  listRuns,
  replaceRowAnnotations,
  saveRun,
  updateRun,
} from '../../../src/core/storage/history.ts'
import { CSV, freshIndexedDb, makeMeta } from '../helpers/storage.ts'

const A = makeMeta({
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  importedAt: '2026-10-11T08:00:00.000Z',
})
const B = makeMeta({
  id: 'bbbbbbbb-0000-4000-8000-000000000002',
  importedAt: '2026-10-13T08:00:00.000Z',
})
const C = makeMeta({
  id: 'cccccccc-0000-4000-8000-000000000003',
  importedAt: '2026-10-12T08:00:00.000Z',
})

let db: PadDb
beforeEach(async () => {
  freshIndexedDb()
  db = await openDb()
})
afterEach(() => db.close())

describe('saveRun / getRun', () => {
  it('stores the meta and the raw CSV under the run id, BigInt ticks intact', async () => {
    await saveRun(db, A, CSV)
    const stored = await getRun(db, A.id)
    expect(stored).toEqual({ meta: A, csv: CSV })
    expect(typeof stored!.meta.runStart).toBe('bigint')
    expect(await db.get('files', A.id)).toBe(CSV)
  })

  it('returns undefined for an unknown run', async () => {
    expect(await getRun(db, 'missing')).toBeUndefined()
  })

  it('replaces a run saved again with the same id', async () => {
    await saveRun(db, A, CSV)
    await saveRun(db, { ...A, rowCount: 99 }, 'new csv')
    expect(await getRun(db, A.id)).toEqual({ meta: { ...A, rowCount: 99 }, csv: 'new csv' })
    expect(await listRuns(db)).toHaveLength(1)
  })
})

describe('listRuns', () => {
  it('is empty for a new database', async () => {
    expect(await listRuns(db)).toEqual([])
  })

  it('lists runs newest import first', async () => {
    await saveRun(db, A, CSV)
    await saveRun(db, B, CSV)
    await saveRun(db, C, CSV)
    expect((await listRuns(db)).map((m) => m.id)).toEqual([B.id, C.id, A.id])
  })
})

describe('updateRun', () => {
  it('changes display name and tags and keeps everything else', async () => {
    await saveRun(db, A, CSV)
    const updated = await updateRun(db, A.id, { displayName: 'Nightly', tags: ['prod'] })
    const expected = { ...A, displayName: 'Nightly', tags: ['prod'] }
    expect(updated).toEqual(expected)
    expect(await getRun(db, A.id)).toEqual({ meta: expected, csv: CSV })
  })

  it('returns undefined and writes nothing for an unknown run', async () => {
    expect(await updateRun(db, 'missing', { displayName: 'x' })).toBeUndefined()
    expect(await listRuns(db)).toEqual([])
  })
})

describe('annotations', () => {
  it('adds annotations with generated ids and lists them per run in insertion order', async () => {
    const id1 = await addAnnotation(db, {
      runId: A.id,
      logIndex: 4,
      kind: 'bookmark',
      text: '',
      createdAt: '2026-10-13T09:00:00.000Z',
    })
    await addAnnotation(db, { runId: B.id, kind: 'note', text: 'other run', createdAt: 't' })
    const id3 = await addAnnotation(db, {
      runId: A.id,
      kind: 'note',
      text: 'run note',
      createdAt: '2026-10-13T09:05:00.000Z',
    })
    expect(id3).toBeGreaterThan(id1)
    const list = await listAnnotations(db, A.id)
    expect(list.map((a) => a.id)).toEqual([id1, id3])
    expect(list[0]).toMatchObject({ runId: A.id, logIndex: 4, kind: 'bookmark' })
    expect(list[1]).toMatchObject({ kind: 'note', text: 'run note' })
    expect(list[1]).not.toHaveProperty('logIndex')
  })
})

describe('replaceRowAnnotations', () => {
  const t = '2026-10-13T09:00:00.000Z'

  it("replaces one row's annotations and leaves other rows, runs and run notes alone", async () => {
    await addAnnotation(db, { runId: A.id, logIndex: 4, kind: 'note', text: 'old', createdAt: t })
    await addAnnotation(db, { runId: A.id, logIndex: 9, kind: 'bookmark', text: '', createdAt: t })
    await addAnnotation(db, { runId: A.id, kind: 'note', text: 'run note', createdAt: t })
    await addAnnotation(db, { runId: B.id, logIndex: 4, kind: 'note', text: 'B', createdAt: t })

    const list = await replaceRowAnnotations(db, A.id, 4, [
      { kind: 'bookmark', text: '', createdAt: t },
      { kind: 'note', text: 'new', createdAt: t },
    ])
    expect(list).toEqual(await listAnnotations(db, A.id))
    expect(list.map((a) => [a.logIndex, a.kind, a.text])).toEqual([
      [9, 'bookmark', ''],
      [undefined, 'note', 'run note'],
      [4, 'bookmark', ''],
      [4, 'note', 'new'],
    ])
    expect(list.every((a) => a.runId === A.id && typeof a.id === 'number')).toBe(true)
    expect((await listAnnotations(db, B.id)).map((a) => a.text)).toEqual(['B'])
  })

  it("clears a row's annotations when given none", async () => {
    await addAnnotation(db, { runId: A.id, logIndex: 4, kind: 'note', text: 'old', createdAt: t })
    expect(await replaceRowAnnotations(db, A.id, 4, [])).toEqual([])
  })
})

describe('deleteRun', () => {
  it("removes the run's meta, raw CSV and annotations, and nothing of other runs", async () => {
    await saveRun(db, A, CSV)
    await saveRun(db, B, 'b csv')
    await addAnnotation(db, { runId: A.id, kind: 'note', text: 'a', createdAt: 't' })
    await addAnnotation(db, { runId: B.id, kind: 'note', text: 'b', createdAt: 't' })
    await deleteRun(db, A.id)
    expect(await getRun(db, A.id)).toBeUndefined()
    expect(await db.get('files', A.id)).toBeUndefined()
    expect(await listAnnotations(db, A.id)).toEqual([])
    expect(await getRun(db, B.id)).toEqual({ meta: B, csv: 'b csv' })
    expect(await listAnnotations(db, B.id)).toHaveLength(1)
  })

  it('is a no-op for an unknown run', async () => {
    await saveRun(db, A, CSV)
    await deleteRun(db, 'missing')
    expect(await listRuns(db)).toHaveLength(1)
  })
})

describe('clearHistory', () => {
  it('removes every run, file and annotation but keeps settings', async () => {
    await saveRun(db, A, CSV)
    await saveRun(db, B, CSV)
    await addAnnotation(db, { runId: A.id, kind: 'bookmark', text: '', createdAt: 't' })
    await setSetting(db, 'theme', 'light')
    await clearHistory(db)
    expect(await listRuns(db)).toEqual([])
    expect(await db.count('files')).toBe(0)
    expect(await db.count('annotations')).toBe(0)
    expect(await getSetting(db, 'theme')).toBe('light')
  })
})
