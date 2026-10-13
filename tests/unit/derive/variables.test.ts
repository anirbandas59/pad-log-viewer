import { describe, expect, it } from 'vitest'
import { buildVariableIndex } from '../../../src/core/derive/variables.ts'
import type { Param } from '../../../src/core/model/types.ts'
import { NESTED_FIXTURE, loadRun } from '../helpers/fixtures.ts'

const out = (variable: string | null, value: string): Param => ({
  key: 'v',
  label: 'Variable',
  variable,
  value,
  truncated: value.endsWith('...'),
})

describe('buildVariableIndex', () => {
  it('orders each history by Log index even when rows arrive out of order', () => {
    const index = buildVariableIndex([
      { logIndex: 30, subflow: 'main', outputs: [out('x', 'third')] },
      { logIndex: 10, subflow: 'main', outputs: [out('x', 'first')] },
      { logIndex: 20, subflow: 'Sub', outputs: [out('y', 'only'), out('x', 'second')] },
    ])
    expect(index.get('x')!.map((a) => [a.logIndex, a.value])).toEqual([
      [10, 'first'],
      [20, 'second'],
      [30, 'third'],
    ])
    expect(index.get('y')).toEqual([
      { logIndex: 20, subflow: 'Sub', value: 'only', truncated: false },
    ])
  })

  it('lists names in order of first assignment', () => {
    const index = buildVariableIndex([
      { logIndex: 2, subflow: 'main', outputs: [out('b', '1')] },
      { logIndex: 1, subflow: 'main', outputs: [out('a', '1')] },
      { logIndex: 3, subflow: 'main', outputs: [out('b', '2')] },
    ])
    expect([...index.keys()]).toEqual(['a', 'b'])
  })

  it('ignores outputs that write no variable and keeps the truncation flag', () => {
    const index = buildVariableIndex([
      { logIndex: 1, subflow: 'main', outputs: [out(null, 'x'), out('', 'y'), out('t', 'cut...')] },
    ])
    expect([...index.keys()]).toEqual(['t'])
    expect(index.get('t')![0]!.truncated).toBe(true)
  })

  it('indexes the nested fixture by Log index', () => {
    const index = buildVariableIndex(loadRun(NESTED_FIXTURE).rows)
    expect(index.get('num_Count')!.map((a) => a.value)).toEqual(['0', '1', '2'])
    expect(index.get('txt_Status')!.map((a) => a.value)).toEqual([
      'start',
      'else branch',
      'after if',
      'business',
      'done',
    ])
    expect(index.get('txt_Item')!.map((a) => a.logIndex)).toEqual([2, 17])
  })
})
