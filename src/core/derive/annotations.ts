// Bookmarks and notes on log rows.
import type { Annotation } from '../model/types.ts'

export interface RowMark {
  bookmarked: boolean
  note: string
}

/** One row's annotation as stored, without its id, run and row. */
export type RowAnnotation = Pick<Annotation, 'kind' | 'text' | 'createdAt'>

/** Log index → bookmark and note. Run-level annotations are skipped; the latest note wins. */
export function rowMarks(list: readonly Annotation[]): Map<number, RowMark> {
  const marks = new Map<number, RowMark>()
  for (const a of list) {
    if (a.logIndex === undefined) continue
    const mark = marks.get(a.logIndex) ?? { bookmarked: false, note: '' }
    if (a.kind === 'bookmark') mark.bookmarked = true
    else mark.note = a.text
    marks.set(a.logIndex, mark)
  }
  return marks
}

/**
 * A row's annotations after a change: a bookmark if it is bookmarked, a note if the note
 * has any text. What the change leaves alone keeps its original time.
 */
export function nextRowAnnotations(
  current: readonly Annotation[],
  change: Partial<RowMark>,
  now: string,
): RowAnnotation[] {
  const bookmark = current.find((a) => a.kind === 'bookmark')
  const note = current.findLast((a) => a.kind === 'note')
  const bookmarked = change.bookmarked ?? bookmark !== undefined
  const text = change.note ?? note?.text ?? ''
  const next: RowAnnotation[] = []
  if (bookmarked) next.push({ kind: 'bookmark', text: '', createdAt: bookmark?.createdAt ?? now })
  if (text.trim()) {
    next.push({
      kind: 'note',
      text,
      createdAt: note && note.text === text ? note.createdAt : now,
    })
  }
  return next
}
