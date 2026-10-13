// M7: bookmarks and notes on rows.
import { describe, expect, it } from 'vitest'
import { nextRowAnnotations, rowMarks } from '../../../src/core/derive/annotations.ts'
import type { Annotation } from '../../../src/core/model/types.ts'

const RUN = 'run-1'
const a = (o: Partial<Annotation>): Annotation => ({
  runId: RUN,
  kind: 'note',
  text: '',
  createdAt: '2026-10-13T09:00:00.000Z',
  ...o,
})

describe('rowMarks', () => {
  it('collects the bookmark and note of each row, ignoring run-level annotations', () => {
    const marks = rowMarks([
      a({ id: 1, logIndex: 12, kind: 'bookmark' }),
      a({ id: 2, logIndex: 12, kind: 'note', text: 'retry here' }),
      a({ id: 3, logIndex: 5, kind: 'note', text: 'odd value' }),
      a({ id: 4, kind: 'note', text: 'about the whole run' }),
    ])
    expect([...marks.keys()].sort((x, y) => x - y)).toEqual([5, 12])
    expect(marks.get(12)).toEqual({ bookmarked: true, note: 'retry here' })
    expect(marks.get(5)).toEqual({ bookmarked: false, note: 'odd value' })
  })

  it('keeps the latest note when a row has more than one', () => {
    const marks = rowMarks([
      a({ id: 1, logIndex: 3, text: 'first' }),
      a({ id: 2, logIndex: 3, text: 'second' }),
    ])
    expect(marks.get(3)!.note).toBe('second')
  })
})

describe('nextRowAnnotations', () => {
  const now = '2026-10-13T10:00:00.000Z'

  it('adds a bookmark and a note', () => {
    expect(nextRowAnnotations([], { bookmarked: true }, now)).toEqual([
      { kind: 'bookmark', text: '', createdAt: now },
    ])
    expect(nextRowAnnotations([], { note: 'check this' }, now)).toEqual([
      { kind: 'note', text: 'check this', createdAt: now },
    ])
  })

  it('keeps what the change does not touch, with its original time', () => {
    const current = [
      a({ id: 1, logIndex: 4, kind: 'bookmark' }),
      a({ id: 2, logIndex: 4, kind: 'note', text: 'keep me' }),
    ]
    expect(nextRowAnnotations(current, { note: 'edited' }, now)).toEqual([
      { kind: 'bookmark', text: '', createdAt: '2026-10-13T09:00:00.000Z' },
      { kind: 'note', text: 'edited', createdAt: now },
    ])
    expect(nextRowAnnotations(current, { bookmarked: false }, now)).toEqual([
      { kind: 'note', text: 'keep me', createdAt: '2026-10-13T09:00:00.000Z' },
    ])
  })

  it('drops a note that is cleared or only whitespace', () => {
    const current = [a({ id: 2, logIndex: 4, kind: 'note', text: 'old' })]
    expect(nextRowAnnotations(current, { note: '   \n' }, now)).toEqual([])
  })
})
