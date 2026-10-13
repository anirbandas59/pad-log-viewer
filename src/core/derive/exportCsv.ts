// "Export filtered CSV": rows back to PAD run-log CSV that re-imports cleanly.
/* eslint-disable @typescript-eslint/no-unused-vars -- M7 stubs until the implementation lands */
import type { LogRow } from '../model/types.ts'

export const EXPORT_HEADERS: readonly string[] = []

export function rowsToCsv(_rows: readonly LogRow[]): string {
  throw new Error('not implemented')
}

export function filteredFileName(_flowName: string, _now: Date): string {
  throw new Error('not implemented')
}
