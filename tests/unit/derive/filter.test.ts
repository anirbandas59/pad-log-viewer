import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../../src/core/csv/parseCsv.ts'
import { deriveRun } from '../../../src/core/derive/deriveRun.ts'
import {
  EMPTY_FILTERS,
  activeFilterCount,
  filterRows,
  isNoise,
  rowStatusKind,
  type LogFilters,
} from '../../../src/core/derive/filter.ts'
import { normalizeRows } from '../../../src/core/model/normalize.ts'
import { syntheticRun, toCsv } from '../helpers/syntheticLog.ts'

type R = Parameters<typeof filterRows>[0][number] & { logIndex: number }
const r = (logIndex: number, o: Partial<R> = {}): R => ({
  logIndex,
  status: 'Succeeded',
  level: '',
  isFailure: false,
  subflow: 'main',
  module: 'Variables',
  moduleDisplay: 'Variables',
  action: 'Assign',
  searchText: '',
  ...o,
})
const ids = (rows: { logIndex: number }[]) => rows.map((x) => x.logIndex)
const f = (o: Partial<LogFilters>): LogFilters => ({ ...EMPTY_FILTERS, ...o })

const rows = [
  r(1, { searchText: 'set variable\ntxt_path\nc:\\data\\in.txt' }),
  r(2, {
    subflow: 'Init',
    module: 'Excel',
    moduleDisplay: 'Excel',
    action: 'LaunchExcel',
    searchText: 'launch excel\ninvoice.xlsx',
  }),
  r(3, {
    module: 'Conditionals',
    moduleDisplay: 'Conditionals',
    action: 'If',
    searchText: 'if\ncondition = true',
  }),
  r(4, {
    subflow: 'Init',
    status: 'Failed',
    isFailure: true,
    module: 'Web',
    moduleDisplay: 'HTTP',
    action: 'InvokeWebService',
    searchText: 'invoke web service\ntimeout\ninvoice',
  }),
  r(5, {
    level: 'Warning',
    module: 'FlowControl',
    moduleDisplay: 'Flow control',
    action: 'OnBlockError',
    searchText: 'on block error\nretry',
  }),
  r(6, {
    status: '',
    module: 'Excel',
    moduleDisplay: 'Excel',
    action: 'CloseExcel',
    searchText: 'close excel',
  }),
]

describe('rowStatusKind', () => {
  it('reads failures, warnings, successes and the rest', () => {
    expect(rows.map(rowStatusKind)).toEqual([
      'Succeeded',
      'Succeeded',
      'Succeeded',
      'Failed',
      'Warning',
      'Unknown',
    ])
  })
})

describe('isNoise', () => {
  it('is true for Set variable and If/Else rows only', () => {
    expect(isNoise({ module: 'Variables', action: 'Assign' })).toBe(true)
    expect(isNoise({ module: 'Variables', action: 'SetVariable' })).toBe(true)
    expect(isNoise({ module: 'Conditionals', action: 'If' })).toBe(true)
    expect(isNoise({ module: 'Conditionals', action: 'Else' })).toBe(true)
    expect(isNoise({ module: 'Variables', action: 'ConvertJsonToCustomObject' })).toBe(false)
    expect(isNoise({ module: 'File', action: 'IfFileAction' })).toBe(false)
    expect(isNoise({ module: 'Excel', action: 'LaunchExcel' })).toBe(false)
  })
})

describe('filterRows', () => {
  it('returns every row, in order, with no filters', () => {
    expect(ids(filterRows(rows, EMPTY_FILTERS))).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('needs every search term, ignoring case', () => {
    expect(ids(filterRows(rows, f({ text: 'INVOICE' })))).toEqual([2, 4])
    expect(ids(filterRows(rows, f({ text: '  invoice   timeout ' })))).toEqual([4])
    expect(ids(filterRows(rows, f({ text: 'c:\\data' })))).toEqual([1])
  })

  it('ORs values within a facet and ANDs across facets', () => {
    expect(ids(filterRows(rows, f({ subflows: ['Init'] })))).toEqual([2, 4])
    expect(ids(filterRows(rows, f({ modules: ['Excel', 'HTTP'] })))).toEqual([2, 4, 6])
    expect(ids(filterRows(rows, f({ statuses: ['Failed', 'Warning'] })))).toEqual([4, 5])
    expect(ids(filterRows(rows, f({ subflows: ['main'], modules: ['Excel'] })))).toEqual([6])
  })

  it('keeps failures only, and hides noise', () => {
    expect(ids(filterRows(rows, f({ errorsOnly: true })))).toEqual([4])
    expect(ids(filterRows(rows, f({ hideNoise: true })))).toEqual([2, 4, 5, 6])
  })

  it('returns the same row objects', () => {
    expect(filterRows(rows, f({ subflows: ['Init'] }))[0]).toBe(rows[1])
  })

  it('filters 10,000 rows in well under 100 ms', () => {
    const parsed = parseCsv(toCsv(syntheticRun(10_000)))
    if (!parsed.ok) throw new Error(parsed.error.message)
    const all = deriveRun(normalizeRows(parsed.rows, parsed.mapping)).rows
    const cases: Partial<LogFilters>[] = [
      { text: 'excel' },
      { text: 'batch 3 input' },
      { subflows: ['Init', 'Cleanup'], statuses: ['Succeeded'] },
      { modules: ['Excel'], hideNoise: true },
      { errorsOnly: true, text: 'timeout' },
    ]
    // Fastest of three runs: a single run can be slowed by other test workers sharing the CPU.
    for (const c of cases) {
      const times: number[] = []
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now()
        filterRows(all, f(c))
        times.push(performance.now() - t0)
      }
      expect(Math.min(...times), JSON.stringify(c)).toBeLessThan(100)
    }
  })
})

describe('activeFilterCount', () => {
  it('counts the search, each facet value and each toggle', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
    expect(activeFilterCount(f({ text: '   ' }))).toBe(0)
    expect(
      activeFilterCount(
        f({
          text: 'x',
          subflows: ['a', 'b'],
          statuses: ['Failed'],
          errorsOnly: true,
          hideNoise: true,
        }),
      ),
    ).toBe(6)
  })
})

describe('bookmarked only', () => {
  it('keeps the bookmarked rows, ANDed with the other filters', () => {
    const marked = new Set([2, 4, 6])
    expect(ids(filterRows(rows, f({ bookmarkedOnly: true }), marked))).toEqual([2, 4, 6])
    expect(ids(filterRows(rows, f({ bookmarkedOnly: true, text: 'excel' }), marked))).toEqual([
      2, 6,
    ])
    expect(filterRows(rows, f({ bookmarkedOnly: true }))).toEqual([])
    expect(ids(filterRows(rows, f({}), marked))).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('counts as one active filter', () => {
    expect(activeFilterCount(f({ bookmarkedOnly: true }))).toBe(1)
    expect(EMPTY_FILTERS.bookmarkedOnly).toBe(false)
  })
})
