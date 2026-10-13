// Bookmarks and notes on log rows.
/* eslint-disable @typescript-eslint/no-unused-vars -- M7 stubs until the implementation lands */
import type { Annotation } from '../model/types.ts'

export interface RowMark {
  bookmarked: boolean
  note: string
}

export type RowAnnotation = Pick<Annotation, 'kind' | 'text' | 'createdAt'>

export function rowMarks(_list: readonly Annotation[]): Map<number, RowMark> {
  throw new Error('not implemented')
}

export function nextRowAnnotations(
  _current: readonly Annotation[],
  _change: Partial<RowMark>,
  _now: string,
): RowAnnotation[] {
  throw new Error('not implemented')
}
