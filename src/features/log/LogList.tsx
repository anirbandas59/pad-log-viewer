import { useEffect, useRef } from 'react'
import { useStore } from '../../app/store.ts'
import { StatusPill } from '../../components/index.ts'
import { formatDuration } from '../../core/model/format.ts'
import type { LogRow } from '../../core/model/types.ts'

function rowStatus(row: LogRow) {
  return row.isFailure ? 'Failed' : row.status === 'Succeeded' ? 'Succeeded' : 'Unknown'
}

/**
 * Plain execution-log list so rows can be selected and jumped to. M6 replaces it with the
 * virtualized table, filter bar and drawer.
 */
export function LogList({ rows }: { rows: readonly LogRow[] }) {
  const selected = useStore((s) => s.selectedLogIndex)
  const select = useStore((s) => s.selectRow)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected === null) return
    list.current
      ?.querySelector(`[data-log-index="${selected}"]`)
      ?.scrollIntoView({ block: 'center' })
  }, [selected])

  return (
    <div
      ref={list}
      data-testid="log-list"
      role="listbox"
      aria-label="Execution log"
      className="max-h-[70vh] overflow-auto rounded-lg border border-border"
    >
      {rows.map((row) => {
        const isSelected = row.logIndex === selected
        return (
          <div
            key={row.logIndex}
            role="option"
            aria-selected={isSelected}
            data-log-index={row.logIndex}
            onClick={() => select(row.logIndex)}
            className={`grid cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border px-3 py-1.5 text-sm last:border-b-0 sm:grid-cols-[3.5rem_10rem_minmax(0,1fr)_auto_5rem] ${
              isSelected ? 'bg-accent/15' : 'hover:bg-raised'
            }`}
          >
            <span className="font-mono text-xs text-muted">#{row.logIndex}</span>
            <span className="hidden truncate text-muted sm:block" title={row.subflow}>
              {row.subflow}
            </span>
            <span className="min-w-0 truncate" style={{ paddingLeft: `${row.depth}rem` }}>
              {row.actionDisplay}
              {row.effect && <span className="text-muted"> · {row.effect}</span>}
            </span>
            <StatusPill status={rowStatus(row)} />
            <span className="hidden text-right font-mono text-xs sm:block">
              {formatDuration(row.durationTicks)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
