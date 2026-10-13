// M7: Errors tab — each failed row with the rows before it.
import { describe, expect, it } from 'vitest'
import { errorContexts } from '../../../src/core/derive/errors.ts'

const r = (logIndex: number, isFailure = false) => ({ logIndex, isFailure })
const ids = (rows: { logIndex: number }[]) => rows.map((x) => x.logIndex)

describe('errorContexts', () => {
  it('gives each failure, in Log index order, with the 3 rows before it', () => {
    const rows = [r(5), r(1), r(2), r(3), r(4, true), r(6), r(7), r(9, true), r(8)]
    const result = errorContexts(rows)
    expect(result.map((c) => c.failure.logIndex)).toEqual([4, 9])
    expect(ids(result[0]!.before)).toEqual([1, 2, 3])
    expect(ids(result[1]!.before)).toEqual([6, 7, 8])
  })

  it('takes fewer rows near the start, and other failures can be context', () => {
    const result = errorContexts([r(1, true), r(2, true), r(3)])
    expect(ids(result[0]!.before)).toEqual([])
    expect(ids(result[1]!.before)).toEqual([1])
  })

  it('takes a different number of rows before', () => {
    const rows = [r(1), r(2), r(3), r(4), r(5, true)]
    expect(ids(errorContexts(rows, 1)[0]!.before)).toEqual([4])
    expect(ids(errorContexts(rows, 0)[0]!.before)).toEqual([])
  })

  it('is empty when nothing failed', () => {
    expect(errorContexts([r(1), r(2)])).toEqual([])
  })
})
