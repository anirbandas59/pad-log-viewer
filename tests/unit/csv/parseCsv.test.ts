import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv, splitSepLine, stripBom } from '../../../src/core/csv/parseCsv.ts'
import { HEADERS, param, row, toCsv } from '../helpers/syntheticLog.ts'

function ok(text: string) {
  const r = parseCsv(text)
  if (!r.ok) throw new Error(`expected ok, got ${r.error.message}`)
  return r
}

describe('stripBom', () => {
  it('removes a leading BOM only', () => {
    expect(stripBom('\uFEFFa,b')).toBe('a,b')
    expect(stripBom('a,\uFEFFb')).toBe('a,\uFEFFb')
  })
})

describe('parseCsv', () => {
  it('parses RFC 4180 quoting with doubled quotes and embedded newlines', () => {
    const inputs = JSON.stringify({ Text: param('Text', 'say "hi"\nthen leave') })
    const text = toCsv([row({ 'Log index': '1', Inputs: inputs, 'Log message': 'a, b' })])
    expect(text).toContain('""')
    const r = ok(text)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]!.Inputs).toBe(inputs)
    expect(r.rows[0]!['Log message']).toBe('a, b')
  })

  it('strips a UTF-8 BOM so the first header still matches', () => {
    const r = ok('\uFEFF' + toCsv([row({ 'Log index': '1' })]))
    expect(r.headers[0]).toBe('Start time')
    expect(r.mapping.startTime).toBe('Start time')
  })

  it('keeps non-ASCII text intact', () => {
    const path = 'C:\\データ\\請求書_2026.xlsx'
    const r = ok(toCsv([row({ 'Log index': '1', 'Log message': path })]))
    expect(r.rows[0]!['Log message']).toBe(path)
  })

  it('accepts CRLF line endings and skips blank lines', () => {
    const text = toCsv([row({ 'Log index': '1' }), row({ 'Log index': '2' })]).replace(
      /\r?\n/g,
      '\r\n',
    )
    expect(ok(text + '\r\n\r\n').rows).toHaveLength(2)
  })

  it('rejects a file with missing required columns and names them', () => {
    const headers = HEADERS.filter((h) => h !== 'Start time' && h !== 'Inputs')
    const r = parseCsv(toCsv([row({ 'Log index': '1' })], headers))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.kind).toBe('missing-columns')
    expect(r.error.kind === 'missing-columns' && r.error.missing).toEqual(['Start time', 'Inputs'])
    expect(r.error.message).toContain('Start time')
  })

  it('rejects empty input and header-only files', () => {
    for (const text of ['', '\uFEFF', '   \n', HEADERS.join(',') + '\r\n']) {
      const r = parseCsv(text)
      expect(r.ok).toBe(false)
      expect(!r.ok && r.error.kind).toBe('empty')
    }
  })

  it('keeps unknown extra columns', () => {
    const r = ok(toCsv([row({ 'Log index': '1', Machine: 'VM-01' })], [...HEADERS, 'Machine']))
    expect(r.extraColumns).toEqual(['Machine'])
    expect(r.rows[0]!.Machine).toBe('VM-01')
  })

  it('warns about rows with the wrong number of fields', () => {
    const text = toCsv([row({ 'Log index': '1' })]) + '\r\nonly,three,fields'
    const r = ok(text)
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.warnings[0]).toMatch(/row 2/i)
  })

  it('parses the committed synthetic fixture', () => {
    const text = readFileSync(
      'tests/fixtures/synthetic/Invoice_Processing_v2_6f1c2a9e-3b4d-4c5e-9f60-7a8b9c0d1e2f_20261001T091500Z.csv',
      'utf8',
    )
    const r = ok(text)
    expect(r.rows.length).toBeGreaterThanOrEqual(15)
    expect(r.extraColumns).toEqual([])
  })
})

// Real portal exports start with an Excel separator hint line before the header row.
describe('parseCsv with a sep= line', () => {
  const body = toCsv([row({ 'Log index': '1' }), row({ 'Log index': '2' })], HEADERS)

  it('skips a leading sep=, line, with or without a BOM, and validates the real header', () => {
    for (const text of [`sep=,\r\n${body}`, `\uFEFFsep=,\r\n${body}`, `sep=,\n${body}`]) {
      const r = ok(text)
      expect(r.headers).toEqual([...HEADERS])
      expect(r.rows).toHaveLength(2)
      expect(r.rows[1]!['Log index']).toBe('2')
    }
  })

  it('uses the delimiter the sep= line names', () => {
    const semicolon = toCsv([row({ 'Log index': '1', 'Log message': 'a, b' })], HEADERS).replace(
      /,(?=(?:[^"]*"[^"]*")*[^"]*$)/gm,
      ';',
    )
    const r = ok(`sep=;\r\n${semicolon}`)
    expect(r.headers).toEqual([...HEADERS])
    expect(r.rows[0]!['Log message']).toBe('a, b')
  })

  it('reports the separator line it skipped', () => {
    expect(splitSepLine(`\uFEFFsep=,\r\n${body}`)).toEqual({
      line: 'sep=,\r\n',
      delimiter: ',',
      body,
    })
    expect(splitSepLine(body)).toEqual({ line: '', delimiter: null, body })
  })
})
