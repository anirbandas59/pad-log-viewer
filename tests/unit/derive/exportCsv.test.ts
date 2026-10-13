// M7: Export filtered CSV. Acceptance: the exported CSV re-imports cleanly.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFileName } from '../../../src/core/csv/fileName.ts'
import { parseCsv } from '../../../src/core/csv/parseCsv.ts'
import { deriveCsv } from '../../../src/core/derive/deriveRun.ts'
import { EXPORT_HEADERS, filteredFileName, rowsToCsv } from '../../../src/core/derive/exportCsv.ts'
import { EMPTY_FILTERS, filterRows } from '../../../src/core/derive/filter.ts'
import { ingestCsv } from '../../../src/core/model/ingest.ts'
import type { LogRow } from '../../../src/core/model/types.ts'
import { NESTED_FIXTURE, REAL_FIXTURE } from '../helpers/fixtures.ts'
import { HEADERS, row, syntheticRun, toCsv } from '../helpers/syntheticLog.ts'

const FAILED_FIXTURE =
  'tests/fixtures/synthetic/Invoice_Processing_v2_6f1c2a9e-3b4d-4c5e-9f60-7a8b9c0d1e2f_20261001T091500Z.csv'

function derive(text: string): LogRow[] {
  const result = deriveCsv(text)
  if (!result.ok) throw new Error(result.error)
  return result.run.rows
}

/** Everything a row carries from its own cells (offset and depth depend on the other rows). */
function cells(r: LogRow): Partial<LogRow> {
  const rest: Partial<LogRow> = { ...r }
  delete rest.offsetTicks
  delete rest.depth
  return rest
}

describe('rowsToCsv', () => {
  it('writes the PAD columns in export order, after the BOM and sep= line', () => {
    const csv = rowsToCsv(derive(toCsv([row({ 'Log index': '1' })])))
    expect(csv.startsWith('\uFEFFsep=,\r\n')).toBe(true)
    const parsed = parseCsv(csv)
    if (!parsed.ok) throw new Error(parsed.error.message)
    expect(parsed.headers).toEqual([...EXPORT_HEADERS])
    expect(EXPORT_HEADERS).toEqual(HEADERS)
  })

  for (const path of [FAILED_FIXTURE, NESTED_FIXTURE, REAL_FIXTURE]) {
    it(`round-trips every row of ${basename(path)} cell for cell`, () => {
      const rows = derive(readFileSync(path, 'utf8'))
      const back = derive(rowsToCsv(rows))
      expect(back.map(cells)).toEqual(rows.map(cells))
      expect(back.map((r) => r.depth)).toEqual(rows.map((r) => r.depth))
    })
  }

  it('round-trips a filtered subset: values, ticks, payloads and flags', () => {
    const all = derive(toCsv(syntheticRun(2_000)))
    const subset = filterRows(all, { ...EMPTY_FILTERS, text: 'excel' })
    expect(subset.length).toBeGreaterThan(100)
    const back = derive(rowsToCsv(subset))
    expect(back.map(cells)).toEqual(subset.map(cells))
    expect(back.some((r) => r.truncated)).toBe(true)
  })

  it('keeps quotes, commas, line breaks, leading spaces and formula-like text verbatim', () => {
    const tricky = [
      'say "hi", then\r\nleave',
      '  padded  ',
      '=HYPERLINK("x")',
      '+1',
      'ünïcödé 請求書',
    ]
    const rows = derive(
      toCsv(
        tricky.map((message, i) =>
          row({ 'Log index': String(i + 1), 'Log message': message, Status: 'Failed' }),
        ),
      ),
    )
    const back = derive(rowsToCsv(rows))
    expect(back.map((r) => r.message)).toEqual(rows.map((r) => r.message))
    expect(rows.map((r) => r.message)).toEqual(tricky)
  })

  it('keeps malformed Inputs/Outputs cells and extra columns as they were', () => {
    const rows = derive(
      toCsv(
        [
          { ...row({ 'Log index': '1', Inputs: '{"broken": ' }), Machine: 'VM-01' },
          { ...row({ 'Log index': '2' }), Machine: '' },
        ],
        [...HEADERS, 'Machine'],
      ),
    )
    expect(rows[0]!.payloadMalformed).toBe(true)
    const csv = rowsToCsv(rows)
    const parsed = parseCsv(csv)
    if (!parsed.ok) throw new Error(parsed.error.message)
    expect(parsed.headers).toEqual([...EXPORT_HEADERS, 'Machine'])
    const back = derive(csv)
    expect(back[0]!.inputsRaw).toBe('{"broken": ')
    expect(back[0]!.payloadMalformed).toBe(true)
    expect(back.map((r) => r.extra)).toEqual([{ Machine: 'VM-01' }, { Machine: '' }])
  })

  it('writes only the header for no rows', () => {
    const parsed = parseCsv(rowsToCsv([]))
    if (!parsed.ok) throw new Error(parsed.error.message)
    expect(parsed.headers).toEqual([...EXPORT_HEADERS])
    expect(parsed.rows).toEqual([])
  })
})

describe('filteredFileName', () => {
  const now = new Date(Date.UTC(2026, 9, 13, 14, 5, 9))

  it('names the file after the flow, marked as filtered, with a UTC timestamp', () => {
    expect(filteredFileName('Invoice_Processing_v2', now)).toBe(
      'Invoice_Processing_v2-filtered-20261013T140509Z.csv',
    )
  })

  it('replaces characters that file names cannot hold', () => {
    expect(filteredFileName('a/b:c*?"<>|d', now)).toBe('a_b_c______d-filtered-20261013T140509Z.csv')
  })

  it('carries no run GUID, so re-importing adds a new run instead of offering Replace', () => {
    const name = filteredFileName('Invoice_Processing_v2', now)
    expect(parseFileName(name).runId).toBeNull()
  })
})

describe('re-import of an export', () => {
  it('ingests as its own run with the exported rows, and is recognised when dropped again', () => {
    const rows = derive(readFileSync(FAILED_FIXTURE, 'utf8'))
    const failures = filterRows(rows, { ...EMPTY_FILTERS, errorsOnly: true })
    const name = filteredFileName('Invoice_Processing_v2', new Date(Date.UTC(2026, 9, 13)))
    const csv = rowsToCsv(failures)
    const first = ingestCsv(name, csv, new Date())
    if (!first.ok) throw new Error(first.error)
    expect(first.run.warnings).toEqual([])
    expect(first.run.meta.rowCount).toBe(failures.length)
    expect(first.run.meta.failureCount).toBe(failures.length)
    expect(first.run.meta.id).toMatch(/^local-/)
    expect(first.run.meta.flowName).toBe('Invoice_Processing_v2-filtered-20261013T000000Z')
    const again = ingestCsv(`copy of ${name}`, csv, new Date())
    expect(again.ok && again.run.meta.id).toBe(first.run.meta.id)
  })
})
