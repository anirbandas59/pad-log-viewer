// Facts of the first real PAD portal export (sanitized, 2026-10-13). Later milestones build on
// these; if a facts test fails after a parser change, the change disagrees with a real log.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseFileName } from '../../../src/core/csv/fileName.ts'
import { parseCsv } from '../../../src/core/csv/parseCsv.ts'
import { parsePayload } from '../../../src/core/derive/payload.ts'
import { normalizeRows } from '../../../src/core/model/normalize.ts'

const NAME = 'Invoice_Extraction_Main-00000000-0000-4000-8000-000000000007-20261012T113808Z.csv'
const text = readFileSync(`tests/fixtures/real/${NAME}`, 'utf8')

function parsed() {
  const r = parseCsv(text)
  if (!r.ok) throw new Error(r.error.message)
  return r
}

describe('real export fixture', () => {
  it('has the portal file-name format', () => {
    expect(parseFileName(NAME)).toMatchObject({
      matched: true,
      flowName: 'Invoice_Extraction_Main',
      runId: '00000000-0000-4000-8000-000000000007',
      exportedAt: '20261012T113808Z',
    })
  })

  it('starts with a BOM and a sep= line, and parses all 14 columns without warnings', () => {
    expect(text.startsWith('\uFEFFsep=,\r\n')).toBe(true)
    const r = parsed()
    expect(r.headers).toHaveLength(14)
    expect(r.extraColumns).toEqual([])
    expect(r.rows).toHaveLength(1235)
    expect(r.warnings).toEqual([])
  })

  it('has valid JSON payloads, 159 of them truncated by PAD', () => {
    const cells = parsed().rows.flatMap((r) => [r.Inputs ?? '', r.Outputs ?? ''])
    const payloads = cells.filter((c) => c.trim()).map((c) => parsePayload(c))
    expect(payloads.filter((p) => p.malformed)).toHaveLength(0)
    expect(payloads.filter((p) => p.truncated)).toHaveLength(159)
  })

  it('normalizes every row, ordered by Log index, with 7-digit ISO timestamps', () => {
    const r = parsed()
    expect(r.rows[0]!['Start time']).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z$/)
    const run = normalizeRows(r.rows, r.mapping)
    expect(run.issues).toEqual([])
    expect(run.rows).toHaveLength(1235)
    expect(run.rows.map((x) => x.logIndex)).toEqual(run.rows.map((_, i) => i + 1))
    expect(run.runEnd > run.runStart).toBe(true)
  })

  it('parses and normalizes well inside the < 1 s budget', () => {
    const t = performance.now()
    const r = parsed()
    normalizeRows(r.rows, r.mapping)
    expect(performance.now() - t).toBeLessThan(1000)
  })

  // Input for M2 block depth: real logs have far fewer End rows than block openers.
  it('records the block-action counts M2 depth rules must handle', () => {
    const counts = new Map<string, number>()
    for (const row of parsed().rows) {
      const key = `${row['Module name']}.${row['Action name']}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(Object.fromEntries([...counts].filter(([k]) => BLOCK_ACTIONS.includes(k)))).toEqual({
      'Conditionals.If': 155,
      'Conditionals.Else': 6,
      'Conditionals.Switch': 2,
      'Conditionals.Case': 2,
      'Loops.Foreach': 57,
      'Loops.Loop': 24,
      'Loops.Break': 20,
      'Loops.Continue': 18,
      'FlowControl.Block': 49,
      'FlowControl.End': 154,
      'System.IfProcessAction': 18,
      'File.IfFileAction': 11,
      'Folder.IfFolderExistsAction': 4,
    })
  })
})

const BLOCK_ACTIONS = [
  'Conditionals.If',
  'Conditionals.Else',
  'Conditionals.Switch',
  'Conditionals.Case',
  'Loops.Foreach',
  'Loops.Loop',
  'Loops.Break',
  'Loops.Continue',
  'FlowControl.Block',
  'FlowControl.End',
  'System.IfProcessAction',
  'File.IfFileAction',
  'Folder.IfFolderExistsAction',
]
