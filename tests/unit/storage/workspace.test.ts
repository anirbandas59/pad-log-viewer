import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDb, type PadDb } from '../../../src/core/storage/db.ts'
import {
  addAnnotation,
  getRun,
  listAnnotations,
  listRuns,
  saveRun,
} from '../../../src/core/storage/history.ts'
import {
  WORKSPACE_FORMAT,
  WORKSPACE_SCHEMA_VERSION,
  exportWorkspace,
  importWorkspace,
  parseWorkspace,
  planImport,
  serializeWorkspace,
  workspaceFileName,
  type WorkspaceBundle,
} from '../../../src/core/storage/workspace.ts'
import { CSV, freshIndexedDb, makeMeta } from '../helpers/storage.ts'

const A = makeMeta({
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  importedAt: '2026-10-11T08:00:00.000Z',
})
const B = makeMeta({
  id: 'bbbbbbbb-0000-4000-8000-000000000002',
  importedAt: '2026-10-12T08:00:00.000Z',
})
const C = makeMeta({
  id: 'cccccccc-0000-4000-8000-000000000003',
  importedAt: '2026-10-13T08:00:00.000Z',
})
const NOW = new Date('2026-10-13T10:00:00.000Z')

let db: PadDb
beforeEach(async () => {
  freshIndexedDb()
  db = await openDb()
})
afterEach(() => db.close())

/** A second, independent in-memory database standing in for another machine. */
async function otherMachine(): Promise<PadDb> {
  freshIndexedDb()
  return openDb()
}

function bundleOf(...runs: WorkspaceBundle['runs']): WorkspaceBundle {
  return {
    format: WORKSPACE_FORMAT,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: NOW.toISOString(),
    runs,
  }
}

describe('exportWorkspace', () => {
  it('carries the schema version, format and export time', async () => {
    const bundle = await exportWorkspace(db, NOW)
    expect(bundle).toEqual({
      format: 'pad-log-viewer-workspace',
      schemaVersion: 1,
      exportedAt: '2026-10-13T10:00:00.000Z',
      runs: [],
    })
    expect(JSON.parse(serializeWorkspace(bundle)).schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION)
  })

  it('holds every run with its meta, raw CSV and annotations', async () => {
    await saveRun(db, A, CSV)
    await saveRun(db, B, 'b csv')
    await addAnnotation(db, {
      runId: A.id,
      logIndex: 7,
      kind: 'bookmark',
      text: '',
      createdAt: 't1',
    })
    await addAnnotation(db, { runId: A.id, kind: 'note', text: 'retry on Monday', createdAt: 't2' })
    const bundle = await exportWorkspace(db, NOW)
    expect(bundle.runs.map((r) => r.meta.id)).toEqual([B.id, A.id])
    const a = bundle.runs.find((r) => r.meta.id === A.id)!
    expect(a.meta).toEqual(A)
    expect(a.csv).toBe(CSV)
    expect(a.annotations).toEqual([
      { logIndex: 7, kind: 'bookmark', text: '', createdAt: 't1' },
      { kind: 'note', text: 'retry on Monday', createdAt: 't2' },
    ])
    expect(bundle.runs.find((r) => r.meta.id === B.id)!.annotations).toEqual([])
  })
})

describe('serializeWorkspace / parseWorkspace', () => {
  it('round-trips a bundle, BigInt ticks included, without losing precision', async () => {
    const bundle = bundleOf({
      meta: A,
      csv: CSV,
      annotations: [{ kind: 'note', text: '日本語', createdAt: 't' }],
    })
    const text = serializeWorkspace(bundle)
    expect(JSON.parse(text).runs[0].meta.runStart).toBe('17602614900001234')
    const parsed = parseWorkspace(text)
    expect(parsed).toEqual({ ok: true, bundle })
  })

  it.each([
    ['not JSON', '{not json', /not a workspace file/i],
    ['a JSON array', '[]', /not a workspace file/i],
    [
      'another format',
      JSON.stringify({ format: 'something-else', schemaVersion: 1, runs: [] }),
      /not a workspace file/i,
    ],
    [
      'no schema version',
      JSON.stringify({ format: WORKSPACE_FORMAT, runs: [] }),
      /schema version/i,
    ],
    [
      'a newer schema version',
      JSON.stringify({ format: WORKSPACE_FORMAT, schemaVersion: 2, runs: [] }),
      /newer version/i,
    ],
  ])('rejects %s', (_label, text, message) => {
    const result = parseWorkspace(text)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(message)
  })

  function withRun(run: unknown): string {
    return JSON.stringify({
      format: WORKSPACE_FORMAT,
      schemaVersion: 1,
      exportedAt: 'x',
      runs: [run],
    })
  }
  const goodRun = JSON.parse(serializeWorkspaceSafe())

  function serializeWorkspaceSafe(): string {
    // Built by hand so this table does not depend on serializeWorkspace.
    return JSON.stringify({
      meta: {
        ...A,
        runStart: A.runStart.toString(),
        runEnd: A.runEnd.toString(),
        durationTicks: A.durationTicks.toString(),
      },
      csv: CSV,
      annotations: [],
    })
  }

  it('accepts a hand-built run', () => {
    expect(parseWorkspace(withRun(goodRun)).ok).toBe(true)
  })

  it.each([
    ['a run without CSV', { ...goodRun, csv: undefined }],
    ['a run without an id', { ...goodRun, meta: { ...goodRun.meta, id: '' } }],
    ['a non-integer tick value', { ...goodRun, meta: { ...goodRun.meta, runStart: '1.5' } }],
    ['a non-numeric row count', { ...goodRun, meta: { ...goodRun.meta, rowCount: 'many' } }],
    [
      'an unknown overall status',
      { ...goodRun, meta: { ...goodRun.meta, overallStatus: 'Maybe' } },
    ],
    ['non-string tags', { ...goodRun, meta: { ...goodRun.meta, tags: [1] } }],
    [
      'an unknown annotation kind',
      { ...goodRun, annotations: [{ kind: 'flag', text: '', createdAt: 't' }] },
    ],
    [
      'a fractional annotation row',
      { ...goodRun, annotations: [{ kind: 'note', logIndex: 1.5, text: '', createdAt: 't' }] },
    ],
  ])('rejects %s', (_label, run) => {
    const result = parseWorkspace(withRun(run))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/run 1/i)
  })

  it('rejects a bundle that holds the same run id twice', () => {
    const text = JSON.stringify({
      format: WORKSPACE_FORMAT,
      schemaVersion: 1,
      exportedAt: 'x',
      runs: [goodRun, goodRun],
    })
    const result = parseWorkspace(text)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/more than once/i)
  })

  it('drops unknown fields instead of storing them', () => {
    const text = withRun({ ...goodRun, extra: 1, meta: { ...goodRun.meta, injected: '<script>' } })
    const result = parseWorkspace(text)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.bundle.runs[0]).not.toHaveProperty('extra')
      expect(result.bundle.runs[0]!.meta).not.toHaveProperty('injected')
    }
  })
})

describe('workspaceFileName', () => {
  it('names the file by local date with the .padworkspace.json extension', () => {
    expect(workspaceFileName(new Date(2026, 9, 3, 23, 59))).toBe(
      'pad-log-viewer-2026-10-03.padworkspace.json',
    )
  })
})

describe('planImport', () => {
  it('splits bundle runs into new ones and ones already in history, by run GUID', async () => {
    await saveRun(db, A, CSV)
    const plan = await planImport(
      db,
      bundleOf({ meta: A, csv: CSV, annotations: [] }, { meta: B, csv: CSV, annotations: [] }),
    )
    expect(plan).toEqual({ added: [B.id], conflicts: [A.id] })
  })
})

describe('importWorkspace', () => {
  it('merges by run GUID: adds new runs and keeps local runs not in the bundle', async () => {
    await saveRun(db, A, 'local a')
    const result = await importWorkspace(
      db,
      bundleOf({
        meta: B,
        csv: 'b csv',
        annotations: [{ kind: 'note', text: 'from bundle', createdAt: 't' }],
      }),
    )
    expect(result).toEqual({ added: [B.id], replaced: [], skipped: [] })
    expect(await getRun(db, A.id)).toEqual({ meta: A, csv: 'local a' })
    expect(await getRun(db, B.id)).toEqual({ meta: B, csv: 'b csv' })
    expect(await listAnnotations(db, B.id)).toMatchObject([
      { runId: B.id, kind: 'note', text: 'from bundle' },
    ])
  })

  it('leaves a run already in history untouched unless the user chose to overwrite it', async () => {
    await saveRun(db, A, 'local a')
    await addAnnotation(db, { runId: A.id, kind: 'note', text: 'local note', createdAt: 't' })
    const incoming = { ...A, displayName: 'From bundle' }
    const result = await importWorkspace(
      db,
      bundleOf({ meta: incoming, csv: 'bundle a', annotations: [] }),
    )
    expect(result).toEqual({ added: [], replaced: [], skipped: [A.id] })
    expect(await getRun(db, A.id)).toEqual({ meta: A, csv: 'local a' })
    expect(await listAnnotations(db, A.id)).toMatchObject([{ text: 'local note' }])
  })

  it("overwrites a confirmed run's meta, CSV and annotations with the bundle's", async () => {
    await saveRun(db, A, 'local a')
    await saveRun(db, C, 'local c')
    await addAnnotation(db, { runId: A.id, kind: 'note', text: 'local note', createdAt: 't' })
    await addAnnotation(db, { runId: C.id, kind: 'note', text: 'keep me', createdAt: 't' })
    const incoming = { ...A, displayName: 'From bundle' }
    const result = await importWorkspace(
      db,
      bundleOf({
        meta: incoming,
        csv: 'bundle a',
        annotations: [{ kind: 'bookmark', logIndex: 2, text: '', createdAt: 't' }],
      }),
      { overwrite: new Set([A.id]) },
    )
    expect(result).toEqual({ added: [], replaced: [A.id], skipped: [] })
    expect(await getRun(db, A.id)).toEqual({ meta: incoming, csv: 'bundle a' })
    expect(await listAnnotations(db, A.id)).toMatchObject([
      { runId: A.id, kind: 'bookmark', logIndex: 2 },
    ])
    expect(await listAnnotations(db, C.id)).toMatchObject([{ text: 'keep me' }])
  })

  it('moves a whole workspace to another machine', async () => {
    await saveRun(db, A, CSV)
    await saveRun(db, B, 'b csv')
    await addAnnotation(db, {
      runId: A.id,
      logIndex: 3,
      kind: 'bookmark',
      text: '',
      createdAt: 't1',
    })
    const text = serializeWorkspace(await exportWorkspace(db, NOW))
    db.close()

    db = await otherMachine()
    const parsed = parseWorkspace(text)
    if (!parsed.ok) throw new Error(parsed.error)
    await importWorkspace(db, parsed.bundle)
    expect(await listRuns(db)).toEqual([B, A])
    expect(await getRun(db, A.id)).toEqual({ meta: A, csv: CSV })
    expect(await listAnnotations(db, A.id)).toMatchObject([
      { runId: A.id, logIndex: 3, kind: 'bookmark', text: '', createdAt: 't1' },
    ])
  })
})
