import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useStore } from '../../app/store.ts'
import type { RowMark } from '../../core/derive/annotations.ts'
import { LOG_COLUMNS } from '../../core/derive/columns.ts'
import { ROW_HEIGHT } from '../../core/derive/density.ts'
import { rowStatusKind } from '../../core/derive/filter.ts'
import { stepSelection } from '../../core/derive/logNav.ts'
import { formatDuration, formatOffset } from '../../core/model/format.ts'
import type { LogRow } from '../../core/model/types.ts'
import { Cell, MarkIcons, SubflowChip } from './cells.tsx'
import { COLUMN_TRACK } from './columnTracks.ts'
import { RowStatus } from '../../components/index.ts'

// Fixed row heights (table rows by density): no per-row measuring, so 10,000 rows scroll
// without gaps.
const CARD_H = 88
const HEADER_H = 36

/**
 * The virtualized execution log: a grid of `rows` (already filtered) with a sticky header,
 * or cards on narrow screens. ↑/↓ move the selection and Enter opens the drawer.
 */
export function LogTable({
  rows,
  total,
  cards,
  maxDuration,
  marks,
}: {
  rows: readonly LogRow[]
  total: number
  cards: boolean
  maxDuration: bigint
  /** Bookmarks and notes by Log index. */
  marks: ReadonlyMap<number, RowMark>
}) {
  const visibility = useStore((s) => s.logColumns)
  const selected = useStore((s) => s.selectedLogIndex)
  const jumpSeq = useStore((s) => s.jumpSeq)
  const select = useStore((s) => s.selectRow)
  const setDrawerOpen = useStore((s) => s.setDrawerOpen)
  const density = useStore((s) => s.logDensity)
  const rowId = useId()
  const scroller = useRef<HTMLDivElement>(null)

  const columns = LOG_COLUMNS.filter((c) => visibility[c.id])
  const template = columns.map((c) => COLUMN_TRACK[c.id].track).join(' ')
  const minWidth = `${columns.reduce((sum, c) => sum + COLUMN_TRACK[c.id].minRem, 0) + 1}rem`
  const header = cards ? 0 : HEADER_H
  const rowHeight = cards ? CARD_H : ROW_HEIGHT[density]
  // The header is row 1 of the grid when there is one.
  const firstRow = cards ? 1 : 2

  // The virtualizer is mutable by design; this component re-renders with it, unmemoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => rowHeight,
    scrollMargin: header,
    overscan: 12,
  })

  // Re-measure when the row height changes: cards or table rows, or the density.
  useLayoutEffect(() => {
    virtualizer.measure()
  }, [rowHeight, virtualizer])

  // The filter's apply-to-render time, from the mark set when the filter changed.
  useLayoutEffect(() => {
    if (performance.getEntriesByName('pad:filter:start', 'mark').length === 0) return
    performance.measure('pad:filter', 'pad:filter:start')
    performance.clearMarks('pad:filter:start')
  }, [rows])

  // Keep the selection in view; a jump (even to the selected row) centres it.
  const lastJump = useRef(-1)
  useEffect(() => {
    if (selected === null) return
    const index = rows.findIndex((r) => r.logIndex === selected)
    if (index < 0) return
    const jumped = lastJump.current !== jumpSeq
    lastJump.current = jumpSeq
    virtualizer.scrollToIndex(index, { align: jumped ? 'center' : 'auto' })
    // Only a new selection or jump scrolls; filtering does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, jumpSeq])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      select(stepSelection(rows, selected, e.key === 'ArrowDown' ? 1 : -1))
    } else if (e.key === 'Enter' && selected !== null) {
      e.preventDefault()
      // A selection the filters hide opens on the nearest row that is shown.
      if (rows.some((r) => r.logIndex === selected)) setDrawerOpen(true)
      else select(stepSelection(rows, selected, 1), true)
    }
  }

  const activeShown =
    selected !== null &&
    virtualizer.getVirtualItems().some((i) => rows[i.index]?.logIndex === selected)

  return (
    <>
      <div
        data-testid="log-table"
        data-layout={cards ? 'cards' : 'table'}
        role="grid"
        aria-label="Execution log"
        aria-rowcount={rows.length + firstRow - 1}
        aria-activedescendant={activeShown ? `${rowId}-${selected}` : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="min-w-0 rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-accent"
      >
        <div
          ref={scroller}
          data-testid="log-scroller"
          className="h-[calc(100dvh-16rem)] min-h-80 overflow-auto"
        >
          {!cards && (
            <div
              data-log-header
              role="row"
              aria-rowindex={1}
              className="sticky top-0 z-10 grid items-center gap-x-3 border-b border-border bg-surface px-3 text-xs font-medium text-muted"
              style={{ gridTemplateColumns: template, minWidth, height: HEADER_H }}
            >
              {columns.map((c) => (
                <span key={c.id} role="columnheader" className="truncate">
                  {c.label}
                </span>
              ))}
            </div>
          )}
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-muted">No rows match the filters.</p>
          ) : (
            <div
              role="rowgroup"
              className="relative"
              style={{ height: virtualizer.getTotalSize(), minWidth: cards ? undefined : minWidth }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                const row = rows[item.index]!
                const isSelected = row.logIndex === selected
                return (
                  <div
                    key={row.logIndex}
                    id={`${rowId}-${row.logIndex}`}
                    role="row"
                    aria-rowindex={item.index + firstRow}
                    aria-selected={isSelected}
                    data-log-index={row.logIndex}
                    onClick={() => select(row.logIndex, true)}
                    className={`absolute inset-x-0 top-0 cursor-pointer border-b border-border text-sm ${
                      isSelected
                        ? 'bg-accent/15 shadow-[inset_3px_0_0_var(--color-accent)]'
                        : row.isFailure
                          ? 'bg-failure/10 hover:bg-raised'
                          : 'hover:bg-raised'
                    } ${cards ? 'px-3 py-2' : 'grid items-center gap-x-3 px-3'}`}
                    style={{
                      height: item.size,
                      transform: `translateY(${item.start - header}px)`,
                      gridTemplateColumns: cards ? undefined : template,
                    }}
                  >
                    {cards ? (
                      <RowCard row={row} mark={marks.get(row.logIndex)} />
                    ) : (
                      columns.map((c) => (
                        <span key={c.id} role="gridcell" className="min-w-0">
                          <Cell
                            id={c.id}
                            row={row}
                            maxDuration={maxDuration}
                            mark={marks.get(row.logIndex)}
                          />
                        </span>
                      ))
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {rows.length === total ? '' : `${rows.length} of ${total} rows shown`}
      </p>
    </>
  )
}

/** Narrow-screen row: action and status, then subflow, time and duration, then effect. */
function RowCard({ row, mark }: { row: LogRow; mark?: RowMark }) {
  return (
    <div role="gridcell" className="flex h-full min-w-0 flex-col justify-between gap-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 font-mono text-xs text-muted">#{row.logIndex}</span>
        <MarkIcons mark={mark} />
        <span className="min-w-0 flex-1 truncate font-medium" title={row.actionDisplay}>
          {row.actionDisplay}
        </span>
        <span className="shrink-0 text-xs">
          <RowStatus kind={rowStatusKind(row)} label={row.status} />
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-3 text-xs text-muted">
        <span className="min-w-0 flex-1">
          <SubflowChip subflow={row.subflow} />
        </span>
        <span className="shrink-0 font-mono" title={row.startIso || undefined}>
          {formatOffset(row.offsetTicks)}
        </span>
        <span className="shrink-0 font-mono">{formatDuration(row.durationTicks)}</span>
      </div>
      <p className="truncate font-mono text-xs text-muted" title={row.effect || undefined}>
        {row.effect || row.message || ' '}
      </p>
    </div>
  )
}
