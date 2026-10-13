import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifyDrop,
  contentRunId,
  ingestCsv,
  mergeReplace,
} from '../../../src/core/model/ingest.ts'
import { NESTED_FIXTURE, REAL_FIXTURE } from '../helpers/fixtures.ts'
import { makeMeta } from '../helpers/storage.ts'
import { HEADERS, row, toCsv } from '../helpers/syntheticLog.ts'

const SYNTHETIC =
  'tests/fixtures/synthetic/Invoice_Processing_v2_6f1c2a9e-3b4d-4c5e-9f60-7a8b9c0d1e2f_20261001T091500Z.csv'
const NOW = new Date('2026-10-13T09:30:00.000Z')

function ingestFixture(path: string) {
  const r = ingestCsv(basename(path), readFileSync(path, 'utf8'), NOW)
  if (!r.ok) throw new Error(r.error)
  return r.run
}

describe('ingestCsv', () => {
  it('builds the run meta of a portal export from its name and rows', () => {
    const { meta, csv } = ingestFixture(REAL_FIXTURE)
    expect(meta).toMatchObject({
      id: '00000000-0000-4000-8000-000000000007',
      flowName: 'Invoice_Extraction_Main',
      fileName: basename(REAL_FIXTURE),
      exportedAt: '20261012T113808Z',
      rowCount: 1235,
      failureCount: 0,
      overallStatus: 'Succeeded',
      importedAt: '2026-10-13T09:30:00.000Z',
      tags: [],
      displayName: 'Invoice_Extraction_Main',
    })
    expect(meta.subflowCount).toBeGreaterThan(10)
    expect(meta.runEnd > meta.runStart).toBe(true)
    expect(meta.durationTicks).toBe(meta.runEnd - meta.runStart)
    expect(csv).toBe(readFileSync(REAL_FIXTURE, 'utf8'))
  })

  it('counts failures and marks a failed run', () => {
    const { meta } = ingestFixture(SYNTHETIC)
    expect(meta.failureCount).toBe(2)
    expect(meta.overallStatus).toBe('Failed')
    expect(meta.id).toBe('6f1c2a9e-3b4d-4c5e-9f60-7a8b9c0d1e2f')
  })

  it('gives a file without a run GUID a stable id from its content', () => {
    const text = readFileSync(NESTED_FIXTURE, 'utf8')
    const a = ingestCsv('my export.csv', text, NOW)
    const b = ingestCsv('renamed.csv', text, NOW)
    if (!a.ok || !b.ok) throw new Error('ingest failed')
    expect(a.run.meta.id).toBe(contentRunId(text))
    expect(b.run.meta.id).toBe(a.run.meta.id)
    expect(a.run.meta.flowName).toBe('my export')
    expect(a.run.meta.exportedAt).toBeNull()
  })

  it('rejects a file that is not a .csv', () => {
    const r = ingestCsv('notes.txt', 'hello', NOW)
    expect(r).toEqual({ ok: false, fileName: 'notes.txt', error: expect.stringMatching(/csv/i) })
  })

  it('rejects missing columns and names them', () => {
    const r = ingestCsv(
      'x.csv',
      toCsv(
        [row({ 'Log index': '1' })],
        HEADERS.filter((h) => h !== 'Status'),
      ),
      NOW,
    )
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/Status/)
  })

  it('rejects an empty file and a file with no readable rows', () => {
    expect(ingestCsv('empty.csv', '', NOW).ok).toBe(false)
    const unreadable = toCsv([{ ...row({ 'Log index': '1' }), 'Log index': 'x' }])
    const r = ingestCsv('bad.csv', unreadable, NOW)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/no readable/i)
  })

  it('reports per-row problems as warnings without rejecting the file', () => {
    const text = toCsv([row({ 'Log index': '1' }), row({ 'Log index': '2', 'End time': 'later' })])
    const r = ingestCsv('w.csv', text, NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.run.warnings).toHaveLength(1)
    expect(r.run.warnings[0]).toMatch(/End time/)
  })
})

describe('contentRunId', () => {
  it('is stable, content-dependent and never a run GUID', () => {
    expect(contentRunId('abc')).toBe(contentRunId('abc'))
    expect(contentRunId('abc')).not.toBe(contentRunId('abd'))
    expect(contentRunId('abc')).toMatch(/^local-[0-9a-f]{16}$/)
  })
})

describe('classifyDrop', () => {
  const stored = makeMeta({ id: 'g1', exportedAt: '20261012T113808Z' })

  it('is new when no stored run has the id', () => {
    expect(classifyDrop(makeMeta({ id: 'g2' }), [stored])).toEqual({ kind: 'new' })
  })

  it('is the same export when id and export timestamp match', () => {
    expect(classifyDrop(makeMeta({ id: 'g1', exportedAt: '20261012T113808Z' }), [stored])).toEqual({
      kind: 'sameExport',
      existing: stored,
    })
  })

  it('is a re-export when the id matches with another export timestamp', () => {
    expect(classifyDrop(makeMeta({ id: 'g1', exportedAt: '20261013T080000Z' }), [stored])).toEqual({
      kind: 'reExport',
      existing: stored,
    })
  })

  it('treats a content id match as the same export', () => {
    const local = makeMeta({ id: 'local-00aa', exportedAt: null })
    expect(classifyDrop({ ...local }, [local]).kind).toBe('sameExport')
  })
})

describe('mergeReplace', () => {
  it("takes the re-export's data but keeps the user's display name and tags", () => {
    const stored = makeMeta({
      id: 'g1',
      exportedAt: 'old',
      displayName: 'Month-end run',
      tags: ['prod', 'ticket-42'],
      rowCount: 3,
    })
    const incoming = makeMeta({
      id: 'g1',
      exportedAt: 'new',
      displayName: 'Invoice_Main',
      tags: [],
      rowCount: 9,
      importedAt: '2026-10-14T00:00:00.000Z',
    })
    expect(mergeReplace(stored, incoming)).toEqual({
      ...incoming,
      displayName: 'Month-end run',
      tags: ['prod', 'ticket-42'],
    })
  })
})
