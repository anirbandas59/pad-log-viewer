// Lower-cased search text per row.
import type { LogRow } from '../model/types.ts'

export function searchText(
  row: Pick<
    LogRow,
    | 'subflow'
    | 'module'
    | 'moduleDisplay'
    | 'action'
    | 'actionDisplay'
    | 'level'
    | 'message'
    | 'status'
    | 'effect'
    | 'inputs'
    | 'outputs'
    | 'inputsRaw'
    | 'outputsRaw'
    | 'payloadMalformed'
  >,
): string {
  void row
  throw new Error('not implemented')
}
