import { describe, expect, it } from 'vitest'
import { parseFileName } from '../../../src/core/csv/fileName.ts'

const GUID = '0b5e2f6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b'

describe('parseFileName', () => {
  it('splits flow name, GUID and export timestamp', () => {
    expect(parseFileName(`Invoice_${GUID}_20261001091530.csv`)).toEqual({
      fileName: `Invoice_${GUID}_20261001091530.csv`,
      flowName: 'Invoice',
      runId: GUID,
      exportedAt: '20261001091530',
      matched: true,
    })
  })

  it('keeps underscores in the flow name', () => {
    const info = parseFileName(`Invoice_Processing_v2_EU_${GUID}_2026-10-01T09-15-30.csv`)
    expect(info.flowName).toBe('Invoice_Processing_v2_EU')
    expect(info.runId).toBe(GUID)
    expect(info.exportedAt).toBe('2026-10-01T09-15-30')
  })

  it('anchors on the last GUID so a timestamp with underscores stays whole', () => {
    const info = parseFileName(`My_Flow_${GUID}_2026-10-01_09-15-30.csv`)
    expect(info.flowName).toBe('My_Flow')
    expect(info.exportedAt).toBe('2026-10-01_09-15-30')
  })

  it('lower-cases the GUID and accepts an upper-case extension', () => {
    const info = parseFileName(`Flow_${GUID.toUpperCase()}_1.CSV`)
    expect(info.runId).toBe(GUID)
    expect(info.matched).toBe(true)
  })

  it('ignores a directory prefix', () => {
    expect(parseFileName(`C:\\fakepath\\Flow_${GUID}_1.csv`).flowName).toBe('Flow')
    expect(parseFileName(`some/dir/Flow_${GUID}_1.csv`).fileName).toBe(`Flow_${GUID}_1.csv`)
  })

  it('falls back to the file name when the pattern does not match', () => {
    expect(parseFileName('run export.csv')).toEqual({
      fileName: 'run export.csv',
      flowName: 'run export',
      runId: null,
      exportedAt: null,
      matched: false,
    })
  })

  it('rejects GUIDs that are not strict 8-4-4-4-12 hex', () => {
    expect(parseFileName('Flow_0b5e2f6a-1c2d-4e3f-8a9b-0c1d2e3f4a5_1.csv').matched).toBe(false)
    expect(parseFileName('Flow_zb5e2f6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b_1.csv').matched).toBe(false)
    expect(parseFileName(`Flow_${GUID}.csv`).matched).toBe(false)
    expect(parseFileName(`${GUID}_1.csv`).matched).toBe(false)
  })
})
