// "Copy row as text": one row as plain text for tickets and chat.
import { formatDuration, formatOffset } from '../model/format.ts'
import type { LogRow, Param } from '../model/types.ts'

function params(title: string, list: readonly Param[]): string[] {
  if (list.length === 0) return [`${title}: none`]
  return [
    `${title}:`,
    ...list.map(
      (p) =>
        `  ${p.label}${p.variable ? ` [${p.variable}]` : ''}: ${p.value}${p.truncated ? ' (truncated by PAD)' : ''}`,
    ),
  ]
}

/** The row, its timing, level, message and parameters, one item per line. */
export function rowAsText(row: LogRow): string {
  const lines = [
    `#${row.logIndex} ${row.actionDisplay} · ${row.subflow} · ${row.status || 'no status'}`,
    `Time: ${row.startIso || '?'} (${formatOffset(row.offsetTicks)}), duration ${formatDuration(row.durationTicks)}`,
  ]
  if (row.level) lines.push(`Log level: ${row.level}`)
  if (row.message) lines.push(`Message: ${row.message}`)
  return [...lines, ...params('Inputs', row.inputs), ...params('Outputs', row.outputs)].join('\n')
}
