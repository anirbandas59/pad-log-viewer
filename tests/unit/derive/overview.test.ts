import { describe, expect, it } from 'vitest'
import { deriveRun } from '../../../src/core/derive/deriveRun.ts'
import {
  SUBFLOW_PALETTE_SIZE,
  facetEntries,
  subflowBars,
  subflowColor,
} from '../../../src/core/derive/overview.ts'
import { NESTED_FIXTURE, REAL_FIXTURE, loadRun } from '../helpers/fixtures.ts'

describe('subflowBars', () => {
  it.each([
    ['real export', REAL_FIXTURE],
    ['nested fixture', NESTED_FIXTURE],
  ])('sum exactly to the run duration on the %s', (_name, path) => {
    const { summary } = deriveRun(loadRun(path))
    const bars = subflowBars(summary)
    expect(bars.length).toBe(summary.subflowCount)
    expect(bars.reduce((a, b) => a + b.ticks, 0n)).toBe(summary.durationTicks)
    expect(bars.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1, 9)
  })

  it('lists the largest share first, each with its palette colour', () => {
    const bars = subflowBars({
      durationTicks: 100n,
      timePerSubflow: [
        { subflow: 'Sub', ticks: 70n },
        { subflow: 'main', ticks: 30n },
      ],
    })
    expect(bars).toEqual([
      { subflow: 'Sub', ticks: 70n, share: 0.7, color: subflowColor('Sub') },
      { subflow: 'main', ticks: 30n, share: 0.3, color: subflowColor('main') },
    ])
  })

  it('gives zero shares for a zero-length run', () => {
    const bars = subflowBars({
      durationTicks: 0n,
      timePerSubflow: [{ subflow: 'main', ticks: 0n }],
    })
    expect(bars[0]!.share).toBe(0)
  })
})

describe('subflowColor', () => {
  it('is a stable palette index per name', () => {
    for (const name of ['main', 'Init', 'Process_Invoice', 'Get Email Details', '']) {
      const c = subflowColor(name)
      expect(Number.isInteger(c)).toBe(true)
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThan(SUBFLOW_PALETTE_SIZE)
      expect(subflowColor(name)).toBe(c)
    }
  })

  it('spreads real subflow names over the palette', () => {
    const { summary } = deriveRun(loadRun(REAL_FIXTURE))
    const colors = new Set(summary.timePerSubflow.map((s) => subflowColor(s.subflow)))
    expect(colors.size).toBeGreaterThanOrEqual(6)
  })
})

describe('facetEntries', () => {
  const facet = new Map([
    ['Variables', 5],
    ['Excel', 9],
    ['File', 5],
    ['HTTP', 1],
  ])

  it('sorts by count, keeping first-appearance order on ties', () => {
    expect(facetEntries(facet)).toEqual([
      { value: 'Excel', count: 9 },
      { value: 'Variables', count: 5 },
      { value: 'File', count: 5 },
      { value: 'HTTP', count: 1 },
    ])
  })

  it('folds everything past the limit into "Other"', () => {
    expect(facetEntries(facet, 2)).toEqual([
      { value: 'Excel', count: 9 },
      { value: 'Variables', count: 5 },
      { value: 'Other', count: 6 },
    ])
    expect(facetEntries(facet, 4)).toHaveLength(4)
  })
})
