import { describe, expect, it } from 'vitest'
import { SLOWEST_COUNT, summarizeRun } from '../../../src/core/derive/summary.ts'
import type { LogRow } from '../../../src/core/model/types.ts'

function mk(
  logIndex: number,
  start: number,
  duration: number,
  extra: Partial<LogRow> = {},
): LogRow {
  return {
    logIndex,
    actionIndex: logIndex,
    subflow: 'main',
    module: 'Variables',
    moduleDisplay: 'Variables',
    action: 'Assign',
    actionDisplay: 'Set variable',
    level: '',
    message: '',
    status: 'Succeeded',
    startTicks: BigInt(start),
    endTicks: BigInt(start + duration),
    startIso: '',
    endIso: '',
    durationTicks: BigInt(duration),
    offsetTicks: 0n,
    inputs: [],
    outputs: [],
    inputsRaw: '',
    outputsRaw: '',
    payloadMalformed: false,
    truncated: false,
    extra: {},
    effect: '',
    depth: 0,
    isFailure: false,
    searchText: '',
    ...extra,
  }
}

describe('summarizeRun', () => {
  it('lists the 10 slowest actions, longest first, ties by Log index', () => {
    const durations = [5, 90, 30, 70, 70, 10, 100, 1, 60, 40, 80, 20, 50, 70, 3]
    const rows = durations.map((d, i) => mk(i + 1, i * 1000, d))
    const s = summarizeRun(rows, 0n, 15_000n)
    expect(SLOWEST_COUNT).toBe(10)
    expect(s.slowest.map((r) => r.logIndex)).toEqual([7, 2, 11, 4, 5, 14, 9, 13, 10, 3])
  })

  it('returns every row when there are fewer than 10', () => {
    const s = summarizeRun([mk(1, 0, 5), mk(2, 10, 9)], 0n, 19n)
    expect(s.slowest.map((r) => r.logIndex)).toEqual([2, 1])
  })

  it('splits wall-clock time between subflows and sums to the run duration', () => {
    const rows = [
      mk(1, 0, 2, { subflow: 'main' }),
      mk(2, 10, 1, { subflow: 'main', action: 'CallFunction' }),
      mk(3, 12, 5, { subflow: 'Sub' }),
      mk(4, 30, 4, { subflow: 'Sub' }),
      mk(5, 40, 10, { subflow: 'main' }),
    ]
    const s = summarizeRun(rows, 0n, 50n)
    expect(s.durationTicks).toBe(50n)
    expect(s.timePerSubflow).toEqual([
      { subflow: 'Sub', ticks: 28n },
      { subflow: 'main', ticks: 22n },
    ])
    expect(s.timePerSubflow.reduce((a, b) => a + b.ticks, 0n)).toBe(s.durationTicks)
  })

  it('counts failures and warnings and finds the first failure by Log index', () => {
    const rows = [
      mk(1, 0, 1),
      mk(2, 1, 1, { level: 'Warning' }),
      mk(3, 2, 1, { status: 'Failed', isFailure: true }),
      mk(4, 3, 1, { level: 'Error', isFailure: true }),
    ]
    const s = summarizeRun(rows, 0n, 4n)
    expect(s.failureCount).toBe(2)
    expect(s.warningCount).toBe(1)
    expect(s.firstFailure?.logIndex).toBe(3)
    expect(s.overallStatus).toBe('Failed')
  })

  it('works in Log index order even when rows arrive out of order', () => {
    const rows = [
      mk(3, 20, 5, { subflow: 'Sub', status: 'Failed', isFailure: true }),
      mk(1, 0, 5, { subflow: 'main' }),
      mk(2, 10, 5, { subflow: 'main', level: 'Error', isFailure: true }),
    ]
    const s = summarizeRun(rows, 0n, 30n)
    expect(s.firstFailure?.logIndex).toBe(2)
    expect(s.timePerSubflow).toEqual([
      { subflow: 'main', ticks: 20n },
      { subflow: 'Sub', ticks: 10n },
    ])
    expect([...s.facets.subflow.keys()]).toEqual(['main', 'Sub'])
  })

  it('reports Succeeded without failures and Unknown for an empty run', () => {
    expect(summarizeRun([mk(1, 0, 1)], 0n, 1n).overallStatus).toBe('Succeeded')
    const empty = summarizeRun([], 0n, 0n)
    expect(empty.overallStatus).toBe('Unknown')
    expect(empty.firstFailure).toBeNull()
    expect(empty.slowest).toEqual([])
    expect(empty.timePerSubflow).toEqual([])
  })

  it('counts facets in order of first appearance', () => {
    const rows = [
      mk(1, 0, 1, { subflow: 'main', moduleDisplay: 'Variables' }),
      mk(2, 1, 1, { subflow: 'Sub', moduleDisplay: 'Excel', level: 'Error', status: 'Failed' }),
      mk(3, 2, 1, { subflow: 'main', moduleDisplay: 'Variables' }),
    ]
    const s = summarizeRun(rows, 0n, 3n)
    expect([...s.facets.subflow]).toEqual([
      ['main', 2],
      ['Sub', 1],
    ])
    expect([...s.facets.module]).toEqual([
      ['Variables', 2],
      ['Excel', 1],
    ])
    expect([...s.facets.status]).toEqual([
      ['Succeeded', 2],
      ['Failed', 1],
    ])
    expect([...s.facets.level]).toEqual([
      ['', 2],
      ['Error', 1],
    ])
    expect(s.subflowCount).toBe(2)
    expect(s.rowCount).toBe(3)
  })
})
