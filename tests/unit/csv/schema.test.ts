import { describe, expect, it } from 'vitest'
import { COLUMNS, normalizeHeader, resolveHeaders } from '../../../src/core/csv/schema.ts'
import { HEADERS } from '../helpers/syntheticLog.ts'

describe('COLUMNS', () => {
  it('covers every column of the input contract once', () => {
    expect(COLUMNS.map((c) => c.header)).toEqual([...HEADERS])
  })
})

describe('normalizeHeader', () => {
  it('ignores case, spacing, underscores and a BOM', () => {
    const n = normalizeHeader('Log index')
    expect(normalizeHeader('  LOG   INDEX ')).toBe(n)
    expect(normalizeHeader('LogIndex')).toBe(n)
    expect(normalizeHeader('log_index')).toBe(n)
    expect(normalizeHeader('\uFEFFLog index')).toBe(n)
  })
})

describe('resolveHeaders', () => {
  it('maps every canonical header with nothing missing or extra', () => {
    const r = resolveHeaders(HEADERS)
    expect(r.missing).toEqual([])
    expect(r.extra).toEqual([])
    expect(r.mapping.logIndex).toBe('Log index')
    expect(r.mapping.outputs).toBe('Outputs')
  })

  it('maps variants and aliases to the original header text', () => {
    const r = resolveHeaders(
      HEADERS.map((h) => (h === 'Subflow' ? 'Subflow name' : h.toUpperCase())),
    )
    expect(r.missing).toEqual([])
    expect(r.mapping.subflow).toBe('Subflow name')
    expect(r.mapping.startTime).toBe('START TIME')
  })

  it('lists missing required columns by canonical name', () => {
    const r = resolveHeaders(HEADERS.filter((h) => h !== 'Log index' && h !== 'Status'))
    expect(r.missing).toEqual(['Log index', 'Status'])
  })

  it('does not require optional columns', () => {
    const optional = COLUMNS.filter((c) => !c.required).map((c) => c.header)
    expect(optional.length).toBeGreaterThan(0)
    expect(resolveHeaders(HEADERS.filter((h) => !optional.includes(h))).missing).toEqual([])
  })

  it('keeps unknown extra columns in file order', () => {
    expect(resolveHeaders([...HEADERS, 'Machine', 'Attempt']).extra).toEqual(['Machine', 'Attempt'])
  })

  it('uses the first of duplicate headers and reports the rest as extra', () => {
    const r = resolveHeaders([...HEADERS, 'status'])
    expect(r.mapping.status).toBe('Status')
    expect(r.extra).toEqual(['status'])
  })
})
