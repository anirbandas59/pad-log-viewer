// Lower-cased search text per row.
import type { LogRow } from '../model/types.ts'

/**
 * Everything a reviewer may search for in one lower-cased string. Fields are joined
 * with a newline so a query cannot match across two neighbouring fields.
 */
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
  const parts = [
    row.subflow,
    row.moduleDisplay,
    row.module,
    row.actionDisplay,
    row.action,
    row.level,
    row.status,
    row.message,
    row.effect,
  ]
  for (const p of [...row.inputs, ...row.outputs]) parts.push(p.label, p.variable ?? '', p.value)
  if (row.payloadMalformed) parts.push(row.inputsRaw, row.outputsRaw)
  return parts.filter(Boolean).join('\n').toLowerCase()
}
