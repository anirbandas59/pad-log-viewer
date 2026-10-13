import { Search } from 'lucide-react'
import { useStore } from '../../app/store.ts'
import { historyTags, type HistorySort } from '../../core/model/historyView.ts'
import type { OverallStatus } from '../../core/model/types.ts'

const field =
  'min-h-9 rounded-md border border-border bg-surface px-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-accent'

export function HistoryControls() {
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const tags = historyTags(useStore((s) => s.runs))

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <label className="relative min-w-0 flex-1 sm:min-w-56">
        <Search
          aria-hidden
          size={16}
          className="pointer-events-none absolute top-2.5 left-2.5 text-muted"
        />
        <input
          type="search"
          aria-label="Search runs"
          placeholder="Search by name"
          value={query.text ?? ''}
          onChange={(e) => setQuery({ text: e.target.value })}
          className={`${field} w-full pl-8`}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Status"
          value={query.status ?? 'all'}
          onChange={(e) => setQuery({ status: e.target.value as OverallStatus | 'all' })}
          className={field}
        >
          <option value="all">All statuses</option>
          <option value="Failed">Failed</option>
          <option value="Succeeded">Succeeded</option>
          <option value="Unknown">Unknown</option>
        </select>
        {tags.length > 0 && (
          <select
            aria-label="Tag"
            value={query.tag ?? ''}
            onChange={(e) => setQuery({ tag: e.target.value || null })}
            className={field}
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Sort"
          value={query.sort ?? 'imported'}
          onChange={(e) => setQuery({ sort: e.target.value as HistorySort })}
          className={field}
        >
          <option value="imported">Newest import</option>
          <option value="runStart">Latest run start</option>
          <option value="duration">Longest duration</option>
        </select>
      </div>
    </div>
  )
}
