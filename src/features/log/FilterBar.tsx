import { Columns3, ListFilter, Search } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useStore } from '../../app/store.ts'
import { CheckRow, Popover } from '../../components/index.ts'
import { LOG_COLUMNS } from '../../core/derive/columns.ts'
import { activeFilterCount, type RowStatusKind } from '../../core/derive/filter.ts'
import type { RunSummary } from '../../core/derive/summary.ts'

const SEARCH_DEBOUNCE_MS = 150
const STATUSES: RowStatusKind[] = ['Succeeded', 'Failed', 'Warning', 'Unknown']

const toggle =
  'inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent'
const pressed = (on: boolean) =>
  on ? 'border-accent bg-accent/15 text-fg' : 'border-border bg-surface text-muted hover:bg-raised'

function toggled<T>(list: readonly T[], value: T, on: boolean): T[] {
  return on ? [...list, value] : list.filter((v) => v !== value)
}

/** Facet values with their row counts, from the run summary. */
function FacetPicker({
  label,
  facet,
  chosen,
  onChange,
}: {
  label: string
  facet: ReadonlyMap<string, number>
  chosen: readonly string[]
  onChange: (values: string[]) => void
}) {
  return (
    <Popover
      label={chosen.length ? `${label} (${chosen.length})` : label}
      icon={<ListFilter aria-hidden size={16} />}
    >
      <fieldset>
        <legend className="sr-only">{label}</legend>
        {[...facet].map(([value, count]) => (
          <CheckRow
            key={value}
            label={value || '(none)'}
            hint={count.toLocaleString()}
            checked={chosen.includes(value)}
            onChange={(on) => onChange(toggled(chosen, value, on))}
          />
        ))}
      </fieldset>
    </Popover>
  )
}

/** Search, facets, toggles, the row count and the column picker. */
export function FilterBar({
  summary,
  shown,
  total,
  searchRef,
}: {
  summary: RunSummary
  shown: number
  total: number
  searchRef: RefObject<HTMLInputElement | null>
}) {
  const filters = useStore((s) => s.logFilters)
  const setFilters = useStore((s) => s.setLogFilters)
  const clear = useStore((s) => s.clearLogFilters)
  const columns = useStore((s) => s.logColumns)
  const setColumn = useStore((s) => s.setColumnVisible)
  const [text, setText] = useState(filters.text)
  const timer = useRef<number | undefined>(undefined)
  const active = activeFilterCount(filters)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onSearch = (value: string) => {
    setText(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFilters({ text: value }), SEARCH_DEBOUNCE_MS)
  }

  const onClear = () => {
    window.clearTimeout(timer.current)
    setText('')
    clear()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <Search
            aria-hidden
            size={16}
            className="pointer-events-none absolute top-2.5 left-2.5 text-muted"
          />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search the log"
            placeholder="Search actions, values, messages  ( / )"
            value={text}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && text) {
                e.stopPropagation()
                onSearch('')
              }
            }}
            className="min-h-9 w-full rounded-md border border-border bg-surface pr-2 pl-8 text-sm text-fg focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-1">
          {STATUSES.map((status) => {
            const on = filters.statuses.includes(status)
            return (
              <button
                key={status}
                type="button"
                aria-pressed={on}
                onClick={() => setFilters({ statuses: toggled(filters.statuses, status, !on) })}
                className={`${toggle} ${pressed(on)}`}
              >
                {status}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FacetPicker
          label="Subflows"
          facet={summary.facets.subflow}
          chosen={filters.subflows}
          onChange={(subflows) => setFilters({ subflows })}
        />
        <FacetPicker
          label="Modules"
          facet={summary.facets.module}
          chosen={filters.modules}
          onChange={(modules) => setFilters({ modules })}
        />
        <button
          type="button"
          aria-pressed={filters.errorsOnly}
          onClick={() => setFilters({ errorsOnly: !filters.errorsOnly })}
          className={`${toggle} ${pressed(filters.errorsOnly)}`}
        >
          Errors only
        </button>
        <button
          type="button"
          aria-pressed={filters.hideNoise}
          title="Hide Set variable and If/Else rows"
          onClick={() => setFilters({ hideNoise: !filters.hideNoise })}
          className={`${toggle} ${pressed(filters.hideNoise)}`}
        >
          Hide noise
        </button>
        <Popover label="Columns" icon={<Columns3 aria-hidden size={16} />} align="right">
          <fieldset>
            <legend className="sr-only">Visible columns</legend>
            {LOG_COLUMNS.map((c) => (
              <CheckRow
                key={c.id}
                label={c.id === 'logIndex' ? '# (Log index)' : c.label}
                checked={columns[c.id]}
                disabled={c.id === 'action'}
                onChange={(on) => setColumn(c.id, on)}
              />
            ))}
          </fieldset>
        </Popover>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span data-testid="row-count" className="text-muted" aria-live="polite">
            {shown.toLocaleString()} of {total.toLocaleString()} rows
          </span>
          {active > 0 && (
            <>
              <span
                data-testid="active-filters"
                className="rounded-full bg-accent/15 px-2 py-0.5 text-xs"
              >
                {active === 1 ? '1 filter' : `${active} filters`}
              </span>
              <button
                type="button"
                onClick={onClear}
                className="text-sm underline hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
