// Errors tab: each failed row with the rows before it.
/* eslint-disable @typescript-eslint/no-unused-vars -- M7 stubs until the implementation lands */
import type { LogRow } from '../model/types.ts'

export interface ErrorContext<T> {
  failure: T
  before: T[]
}

export function errorContexts<T extends Pick<LogRow, 'logIndex' | 'isFailure'>>(
  _rows: readonly T[],
  _before = 3,
): ErrorContext<T>[] {
  throw new Error('not implemented')
}
