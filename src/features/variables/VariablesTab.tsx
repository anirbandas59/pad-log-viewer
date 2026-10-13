import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useStore } from '../../app/store.ts'
import type { DerivedRun } from '../../core/derive/deriveRun.ts'
import { variableSummaries, type Assignment } from '../../core/derive/variables.ts'

const ITEM_H = 44
const HISTORY_MAX_H = 480

function TruncatedBadge() {
  return (
    <span className="shrink-0 rounded border border-warning/50 bg-warning/10 px-1.5 text-xs text-warning">
      truncated by PAD
    </span>
  )
}

/** One variable's assignments in Log index order, virtualized; each links to its row. */
function AssignmentHistory({ name, list }: { name: string; list: readonly Assignment[] }) {
  const jump = useStore((s) => s.jumpToRow)
  const scroller = useRef<HTMLDivElement>(null)
  // The virtualizer is mutable by design; this component re-renders with it, unmemoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ITEM_H,
    overscan: 10,
  })
  return (
    <section data-testid="variable-history" className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="font-mono text-base font-semibold break-all">{name}</h3>
        <span className="text-sm text-muted">
          {list.length.toLocaleString()} {list.length === 1 ? 'assignment' : 'assignments'}
        </span>
      </div>
      <div
        ref={scroller}
        className="overflow-auto rounded-lg border border-border"
        style={{ height: Math.min(list.length * ITEM_H, HISTORY_MAX_H) }}
      >
        <ol className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const a = list[item.index]!
            return (
              <li
                key={item.index}
                data-testid="assignment"
                className="absolute inset-x-0 top-0 flex items-center gap-3 border-b border-border px-3 text-sm"
                style={{ height: ITEM_H, transform: `translateY(${item.start}px)` }}
              >
                <button
                  type="button"
                  aria-label={`Go to row #${a.logIndex}`}
                  title="Show this row in the execution log"
                  onClick={() => jump(a.logIndex)}
                  className="w-16 shrink-0 rounded text-left font-mono text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  #{a.logIndex}
                </button>
                <span
                  className="hidden w-32 shrink-0 truncate text-muted sm:block"
                  title={a.subflow}
                >
                  {a.subflow}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={a.value}>
                  {a.value}
                </span>
                {a.truncated && <TruncatedBadge />}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

/** What value did X have, and when? Variables with counts; one variable's history. */
export function VariablesTab({ run }: { run: DerivedRun }) {
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  const list = useMemo(() => variableSummaries(run.variables, query), [run.variables, query])
  const history = chosen ? run.variables.get(chosen) : undefined

  if (run.variables.size === 0) {
    return <p className="text-sm text-muted">No action in this run writes a variable.</p>
  }
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-2">
        <label className="relative block">
          <Search
            aria-hidden
            size={16}
            className="pointer-events-none absolute top-2.5 left-2.5 text-muted"
          />
          <input
            type="search"
            aria-label="Search variables"
            placeholder="Search variables"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-9 w-full rounded-md border border-border bg-surface pr-2 pl-8 text-sm text-fg focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        <p className="text-xs text-muted">
          {list.length.toLocaleString()} of {run.variables.size.toLocaleString()} variables
        </p>
        <ul
          data-testid="variable-list"
          className="max-h-[60vh] divide-y divide-border overflow-auto rounded-lg border border-border"
        >
          {list.map((v) => (
            <li key={v.name}>
              <button
                type="button"
                aria-pressed={v.name === chosen}
                onClick={() => setChosen(v.name)}
                className={`flex w-full min-w-0 flex-col gap-0.5 px-3 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                  v.name === chosen ? 'bg-accent/15' : 'hover:bg-raised'
                }`}
              >
                <span className="flex w-full min-w-0 items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">{v.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {v.count.toLocaleString()}
                  </span>
                </span>
                <span className="w-full truncate font-mono text-xs text-muted">{v.last.value}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No variable matches.</li>
          )}
        </ul>
      </div>
      {chosen && history ? (
        <AssignmentHistory key={chosen} name={chosen} list={history} />
      ) : (
        <p className="text-sm text-muted">
          Choose a variable to see every value it was given, in order.
        </p>
      )}
    </div>
  )
}
