import { describe, expect, it } from 'vitest'
import { historyTags, queryHistory } from '../../../src/core/model/historyView.ts'
import { makeMeta } from '../helpers/storage.ts'

const runs = [
  makeMeta({
    id: 'a',
    displayName: 'Invoice main',
    flowName: 'Invoice_Main',
    fileName: 'a.csv',
    importedAt: '2026-10-01T00:00:00Z',
    runStart: 300n,
    durationTicks: 50n,
    overallStatus: 'Succeeded',
    tags: ['prod'],
  }),
  makeMeta({
    id: 'b',
    displayName: 'Nightly batch',
    flowName: 'Batch',
    fileName: 'b.csv',
    importedAt: '2026-10-03T00:00:00Z',
    runStart: 100n,
    durationTicks: 900n,
    overallStatus: 'Failed',
    tags: ['prod', 'ticket-42'],
  }),
  makeMeta({
    id: 'c',
    displayName: 'Retry',
    flowName: 'Invoice_Retry',
    fileName: 'invoice-retry.csv',
    importedAt: '2026-10-02T00:00:00Z',
    runStart: 200n,
    durationTicks: 10n,
    overallStatus: 'Failed',
    tags: [],
  }),
]
const ids = (list: { id: string }[]) => list.map((r) => r.id)

describe('queryHistory', () => {
  it('lists newest import first by default', () => {
    expect(ids(queryHistory(runs))).toEqual(['b', 'c', 'a'])
  })

  it('sorts by run start (latest first) and by duration (longest first)', () => {
    expect(ids(queryHistory(runs, { sort: 'runStart' }))).toEqual(['a', 'c', 'b'])
    expect(ids(queryHistory(runs, { sort: 'duration' }))).toEqual(['b', 'a', 'c'])
  })

  it('searches display name, flow name and file name, ignoring case', () => {
    expect(ids(queryHistory(runs, { text: 'INVOICE' }))).toEqual(['c', 'a'])
    expect(ids(queryHistory(runs, { text: 'nightly' }))).toEqual(['b'])
    expect(ids(queryHistory(runs, { text: '  ' }))).toEqual(['b', 'c', 'a'])
  })

  it('filters by status and tag, combined with search', () => {
    expect(ids(queryHistory(runs, { status: 'Failed' }))).toEqual(['b', 'c'])
    expect(ids(queryHistory(runs, { status: 'all', tag: 'prod' }))).toEqual(['b', 'a'])
    expect(ids(queryHistory(runs, { status: 'Failed', tag: 'prod', text: 'batch' }))).toEqual(['b'])
    expect(queryHistory(runs, { tag: 'none-such' })).toEqual([])
  })

  it('does not reorder the input list', () => {
    queryHistory(runs, { sort: 'duration' })
    expect(ids(runs)).toEqual(['a', 'b', 'c'])
  })
})

describe('historyTags', () => {
  it('lists every tag once, sorted', () => {
    expect(historyTags(runs)).toEqual(['prod', 'ticket-42'])
    expect(historyTags([])).toEqual([])
  })
})
