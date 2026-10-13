import type { ReactNode } from 'react'
import { formatDuration, formatOffset } from '../../core/model/format.ts'
import { rowStatusKind } from '../../core/derive/filter.ts'
import { subflowColor } from '../../core/derive/overview.ts'
import type { LogColumnId } from '../../core/derive/columns.ts'
import type { LogRow } from '../../core/model/types.ts'
import { RowStatus } from '../../components/index.ts'

export function SubflowChip({ subflow }: { subflow: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={subflow}>
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-sm"
        style={{ backgroundColor: `var(--subflow-${subflowColor(subflow)})` }}
      />
      <span className="truncate">{subflow || '(none)'}</span>
    </span>
  )
}

/** Duration with a bar scaled to the run's slowest action. */
export function DurationCell({ ticks, max }: { ticks: bigint; max: bigint }) {
  const share = max > 0n && ticks > 0n ? Number((ticks * 1000n) / max) / 10 : 0
  return (
    <span className="relative flex h-5 w-full items-center justify-end font-mono text-xs">
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0 rounded-sm bg-accent/25"
        style={{ width: `${share}%` }}
      />
      <span className="relative">{formatDuration(ticks)}</span>
    </span>
  )
}

const text = (value: string, className = '') => (
  <span className={`block truncate ${className}`} title={value || undefined}>
    {value}
  </span>
)

/** One cell's content. Log values are rendered as text only. */
export function Cell({
  id,
  row,
  maxDuration,
}: {
  id: LogColumnId
  row: LogRow
  maxDuration: bigint
}): ReactNode {
  switch (id) {
    case 'logIndex':
      return <span className="font-mono text-xs text-muted">#{row.logIndex}</span>
    case 'time':
      return (
        <span className="font-mono text-xs" title={row.startIso || undefined}>
          {formatOffset(row.offsetTicks)}
        </span>
      )
    case 'duration':
      return <DurationCell ticks={row.durationTicks} max={maxDuration} />
    case 'subflow':
      return <SubflowChip subflow={row.subflow} />
    case 'action':
      return (
        <span
          className="block truncate"
          style={{ paddingLeft: `${row.depth}rem` }}
          title={row.actionDisplay}
        >
          {row.actionDisplay}
        </span>
      )
    case 'effect':
      return text(row.effect, 'font-mono text-xs text-muted')
    case 'status':
      return <RowStatus kind={rowStatusKind(row)} label={row.status} />
    case 'message':
      return text(row.message)
    case 'actionIndex':
      return <span className="font-mono text-xs">{row.actionIndex}</span>
    case 'module':
      return text(row.module, 'font-mono text-xs')
    case 'actionName':
      return text(row.action, 'font-mono text-xs')
    case 'start':
      return text(row.startIso, 'font-mono text-xs')
    case 'end':
      return text(row.endIso, 'font-mono text-xs')
    case 'level':
      return text(row.level)
  }
}
