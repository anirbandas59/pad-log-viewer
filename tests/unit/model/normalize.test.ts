import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../../src/core/csv/parseCsv.ts'
import { isFailureRow, normalizeRows } from '../../../src/core/model/normalize.ts'
import { HEADERS, isoAt, param, row, syntheticRun, toCsv } from '../helpers/syntheticLog.ts'

function normalize(rows: Record<string, string>[], headers?: readonly string[]) {
  const parsed = parseCsv(toCsv(rows, headers))
  if (!parsed.ok) throw new Error(parsed.error.message)
  return normalizeRows(parsed.rows, parsed.mapping)
}

describe('isFailureRow', () => {
  it('detects failures from Status or Log level', () => {
    expect(isFailureRow('Failed', '')).toBe(true)
    expect(isFailureRow('failed', '')).toBe(true)
    expect(isFailureRow('Succeeded', 'Error')).toBe(true)
    expect(isFailureRow('Succeeded', '')).toBe(false)
    expect(isFailureRow('Succeeded', 'Warning')).toBe(false)
    expect(isFailureRow('', '')).toBe(false)
  })
})

describe('normalizeRows', () => {
  it('sorts rows by Log index, not by file order or Action index', () => {
    const run = normalize([
      row({ 'Log index': '3', 'Action index': '1' }),
      row({ 'Log index': '1', 'Action index': '9' }),
      row({ 'Log index': '10', 'Action index': '1' }),
      row({ 'Log index': '2', 'Action index': '5' }),
    ])
    expect(run.rows.map((r) => r.logIndex)).toEqual([1, 2, 3, 10])
    expect(run.rows.map((r) => r.actionIndex)).toEqual([9, 5, 1, 1])
  })

  it('converts timestamps to ticks with exact sub-millisecond durations', () => {
    const run = normalize([
      row({ 'Log index': '1', 'Start time': isoAt(1), 'End time': isoAt(4) }),
      row({ 'Log index': '2', 'Start time': isoAt(10_001), 'End time': isoAt(10_001 + 9_999) }),
    ])
    const [a, b] = run.rows
    expect(a!.durationTicks).toBe(3n)
    expect(b!.durationTicks).toBe(9_999n)
    expect(a!.startIso).toBe(isoAt(1))
    expect(b!.offsetTicks).toBe(10_000n)
    expect(run.runStart).toBe(a!.startTicks)
    expect(run.runEnd).toBe(b!.endTicks)
  })

  it('maps every column into the LogRow', () => {
    const run = normalize([
      row({
        'Log index': '7',
        'Action index': '4',
        Subflow: 'Process_Invoice',
        'Module name': 'Excel',
        'Action name': 'ReadFromExcel',
        'Module display name': 'Excel',
        'Action display name': 'Read from Excel worksheet',
        'Log level': 'Error',
        'Log message': 'Sheet not found',
        Status: 'Failed',
      }),
    ])
    expect(run.rows[0]).toMatchObject({
      logIndex: 7,
      actionIndex: 4,
      subflow: 'Process_Invoice',
      module: 'Excel',
      action: 'ReadFromExcel',
      moduleDisplay: 'Excel',
      actionDisplay: 'Read from Excel worksheet',
      level: 'Error',
      message: 'Sheet not found',
      status: 'Failed',
      isFailure: true,
      effect: '',
      depth: 0,
      searchText: '',
    })
  })

  it('parses Inputs and Outputs and flags truncated values', () => {
    const run = normalize([
      row({
        'Log index': '1',
        Outputs: JSON.stringify({ V: param('Variable', 'abc...', 'txt_Payload') }),
      }),
    ])
    const r = run.rows[0]!
    expect(r.inputs[0]).toMatchObject({ key: 'Value', value: 'value 1' })
    expect(r.outputs[0]).toMatchObject({ variable: 'txt_Payload', truncated: true })
    expect(r.truncated).toBe(true)
    expect(r.payloadMalformed).toBe(false)
  })

  it('keeps the raw string of malformed JSON and flags the row', () => {
    const raw = '{"Text": {"value": "broken'
    const r = normalize([row({ 'Log index': '1', Inputs: raw })]).rows[0]!
    expect(r.payloadMalformed).toBe(true)
    expect(r.inputsRaw).toBe(raw)
    expect(r.inputs).toEqual([])
  })

  it('keeps unknown extra columns on the row', () => {
    const r = normalize([row({ 'Log index': '1', Machine: 'VM-01' })], [...HEADERS, 'Machine'])
      .rows[0]!
    expect(r.extra).toEqual({ Machine: 'VM-01' })
  })

  it('defaults optional columns that are absent to empty strings', () => {
    const headers = HEADERS.filter((h) => h !== 'Log level' && h !== 'Module name')
    const r = normalize([row({ 'Log index': '1' })], headers).rows[0]!
    expect(r.level).toBe('')
    expect(r.module).toBe('')
  })

  it('reports and skips rows with an unreadable Log index', () => {
    const run = normalize([
      row({ 'Log index': '1' }),
      { ...row({ 'Log index': '2' }), 'Log index': 'x' },
    ])
    expect(run.rows).toHaveLength(1)
    expect(run.issues).toHaveLength(1)
    expect(run.issues[0]!.message).toMatch(/log index/i)
  })

  it('reports unreadable timestamps and falls back without throwing', () => {
    const run = normalize([
      row({ 'Log index': '1' }),
      row({ 'Log index': '2', 'End time': 'not a time' }),
      row({ 'Log index': '3', 'Start time': '', 'End time': '' }),
    ])
    expect(run.rows).toHaveLength(3)
    expect(run.rows[1]!.endTicks).toBe(run.rows[1]!.startTicks)
    expect(run.rows[1]!.durationTicks).toBe(0n)
    expect(run.rows[1]!.endIso).toBe('')
    expect(run.rows[2]!.startTicks).toBe(run.runStart)
    expect(run.issues.map((i) => i.row)).toEqual([2, 3])
  })

  it('returns an empty run for no rows', () => {
    const run = normalizeRows([], {})
    expect(run.rows).toEqual([])
    expect(run.runStart).toBe(0n)
    expect(run.runEnd).toBe(0n)
  })
})

describe('10k-row performance', () => {
  it('parses and normalizes 10,000 rows in under 1 second', () => {
    // Fastest of three runs: a single run can be slowed by other test workers sharing the CPU.
    const text = toCsv(syntheticRun(10_000))
    const times: number[] = []
    let run!: ReturnType<typeof normalizeRows>
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now()
      const parsed = parseCsv(text)
      if (!parsed.ok) throw new Error(parsed.error.message)
      run = normalizeRows(parsed.rows, parsed.mapping)
      times.push(performance.now() - t0)
    }
    const elapsed = Math.min(...times)
    expect(run.rows).toHaveLength(10_000)
    expect(run.issues).toEqual([])
    expect(run.rows.filter((r) => r.isFailure)).toHaveLength(10)
    console.log(`10k rows: ${text.length} chars, parse + normalize ${elapsed.toFixed(0)} ms`)
    expect(elapsed).toBeLessThan(1000)
  })
})
