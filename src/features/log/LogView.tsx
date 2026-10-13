import { useEffect, useMemo, useRef } from 'react'
import { useMediaQuery } from '../../app/useMediaQuery.ts'
import { useStore } from '../../app/store.ts'
import { rowMarks } from '../../core/derive/annotations.ts'
import { filterRows } from '../../core/derive/filter.ts'
import { nextFailure } from '../../core/derive/logNav.ts'
import type { DerivedRun } from '../../core/derive/deriveRun.ts'
import { RowDrawer } from '../detail/index.ts'
import { FilterBar } from './FilterBar.tsx'
import { LogTable } from './LogTable.tsx'

const dialogOpen = () => document.querySelector('[role="dialog"]') !== null

/** Typing in a field, or a dialog is open: page shortcuts stay out of the way. */
function shortcutsBlocked(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return (
    e.defaultPrevented ||
    e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    !!t?.closest('input, textarea, select, [contenteditable="true"]') ||
    dialogOpen()
  )
}

/**
 * The Execution log tab: filter bar, virtualized table and row drawer. Page shortcuts:
 * `/` focuses search, `f` selects the next failure, Esc closes the drawer.
 */
export function LogView({ run }: { run: DerivedRun }) {
  const filters = useStore((s) => s.logFilters)
  const selected = useStore((s) => s.selectedLogIndex)
  const drawerOpen = useStore((s) => s.drawerOpen)
  const select = useStore((s) => s.selectRow)
  const setDrawerOpen = useStore((s) => s.setDrawerOpen)
  const annotations = useStore((s) => s.annotations)
  const search = useRef<HTMLInputElement>(null)
  const wide = useMediaQuery('(min-width: 768px)')

  const marks = useMemo(() => rowMarks(annotations), [annotations])
  const bookmarked = useMemo(
    () => new Set([...marks].filter(([, m]) => m.bookmarked).map(([i]) => i)),
    [marks],
  )
  const rows = useMemo(
    () => filterRows(run.rows, filters, bookmarked),
    [run.rows, filters, bookmarked],
  )
  const byIndex = useMemo(() => new Map(run.rows.map((r) => [r.logIndex, r])), [run.rows])
  const maxDuration = run.summary.slowest[0]?.durationTicks ?? 0n
  const drawerRow = drawerOpen && selected !== null ? byIndex.get(selected) : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Esc belongs to an open dialog first.
        if (!e.defaultPrevented && !dialogOpen() && useStore.getState().drawerOpen) {
          setDrawerOpen(false)
        }
        return
      }
      if (shortcutsBlocked(e)) return
      if (e.key === '/') {
        e.preventDefault()
        search.current?.focus()
      } else if (e.key === 'f') {
        const next = nextFailure(rows, useStore.getState().selectedLogIndex)
        if (next !== null) {
          e.preventDefault()
          select(next)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [rows, select, setDrawerOpen])

  return (
    <div className="space-y-3">
      <FilterBar
        summary={run.summary}
        shown={rows.length}
        total={run.rows.length}
        searchRef={search}
      />
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <LogTable
            rows={rows}
            total={run.rows.length}
            cards={!wide}
            maxDuration={maxDuration}
            marks={marks}
          />
        </div>
        {drawerRow && (
          <RowDrawer row={drawerRow} rows={rows} mark={marks.get(drawerRow.logIndex)} />
        )}
      </div>
    </div>
  )
}
