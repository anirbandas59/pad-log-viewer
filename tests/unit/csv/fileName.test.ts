import { describe, expect, it } from 'vitest'
import { isSameExport, isSameRun, parseFileName } from '../../../src/core/csv/fileName.ts'

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

// Real portal exports use hyphens: <flow>-<run guid>-<export timestamp>.csv.
describe('parseFileName with the portal export format', () => {
  it('splits a hyphen-separated name and keeps underscores in the flow name', () => {
    expect(parseFileName(`Invoice_Run_Main-${GUID}-20261012T113808Z.csv`)).toEqual({
      fileName: `Invoice_Run_Main-${GUID}-20261012T113808Z.csv`,
      flowName: 'Invoice_Run_Main',
      runId: GUID,
      exportedAt: '20261012T113808Z',
      matched: true,
    })
  })

  it('keeps hyphens in the flow name and anchors on the last GUID', () => {
    const info = parseFileName(`My-Flow-v2-${GUID}-20261012T113808Z.csv`)
    expect(info.flowName).toBe('My-Flow-v2')
    expect(info.runId).toBe(GUID)
    expect(info.exportedAt).toBe('20261012T113808Z')
  })
})

describe('export identity', () => {
  const a = parseFileName(`Flow-${GUID}-20261012T113808Z.csv`)
  const sameExport = parseFileName(`Flow-${GUID.toUpperCase()}-20261012T113808Z.csv`)
  const reExport = parseFileName(`Flow-${GUID}-20261013T080000Z.csv`)
  const otherRun = parseFileName(`Flow-1b5e2f6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b-20261012T113808Z.csv`)

  it('treats the same run GUID and export timestamp as the same export', () => {
    expect(isSameExport(a, sameExport)).toBe(true)
    expect(isSameExport(a, reExport)).toBe(false)
  })

  it('treats the same run GUID with another timestamp as a re-export of the same run', () => {
    expect(isSameRun(a, reExport)).toBe(true)
    expect(isSameRun(a, otherRun)).toBe(false)
  })

  it('never matches names without a run GUID', () => {
    const plain = parseFileName('export.csv')
    expect(isSameRun(plain, plain)).toBe(false)
    expect(isSameExport(plain, plain)).toBe(false)
  })
})
