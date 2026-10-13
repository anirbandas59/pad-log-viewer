import { Trash2 } from 'lucide-react'
import { useStore } from '../../app/store.ts'
import { StatusPill } from '../../components/index.ts'
import { formatDuration } from '../../core/model/format.ts'
import { queryHistory } from '../../core/model/historyView.ts'
import type { RunMeta } from '../../core/model/types.ts'

/** Local date and time of a tick count (100 ns since the Unix epoch). */
function formatTicks(ticks: bigint): string {
  return new Date(Number(ticks / 10_000n)).toLocaleString()
}

function RunCard({ run }: { run: RunMeta }) {
  const openRun = useStore((s) => s.openRun)
  const askDelete = useStore((s) => s.askDelete)
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => openRun(run.id)}
          className="min-w-0 flex-1 text-left text-base font-semibold break-words hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {run.displayName}
        </button>
        <StatusPill status={run.overallStatus} />
      </div>
      {run.flowName !== run.displayName && <p className="text-sm text-muted">{run.flowName}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-muted">Started</dt>
        <dd className="font-mono">{formatTicks(run.runStart)}</dd>
        <dt className="text-muted">Duration</dt>
        <dd className="font-mono">{formatDuration(run.durationTicks)}</dd>
        <dt className="text-muted">Actions</dt>
        <dd>
          {run.rowCount.toLocaleString()}
          {run.failureCount > 0 && (
            <span className="text-failure">
              {' '}
              · {run.failureCount} failure{run.failureCount === 1 ? '' : 's'}
            </span>
          )}
        </dd>
      </dl>
      {run.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Tags">
          {run.tags.map((t) => (
            <li key={t} className="rounded bg-raised px-1.5 py-0.5 text-xs">
              {t}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex items-end gap-2 pt-1">
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={run.fileName}>
          {run.fileName}
        </p>
        <button
          type="button"
          aria-label={`Delete ${run.displayName}`}
          onClick={() => askDelete(run)}
          className="shrink-0 rounded p-1.5 text-muted hover:bg-raised hover:text-failure focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Trash2 aria-hidden size={16} />
        </button>
      </div>
    </li>
  )
}

export function HistoryList() {
  const runs = useStore((s) => s.runs)
  const query = useStore((s) => s.query)
  const ready = useStore((s) => s.ready)
  const shown = queryHistory(runs, query)

  return (
    <section aria-labelledby="history-title" className="space-y-3">
      <h2 id="history-title" className="text-lg font-semibold">
        History <span className="text-sm font-normal text-muted">({runs.length})</span>
      </h2>
      {ready && runs.length === 0 && (
        <p className="rounded-md border border-border p-4 text-sm text-muted">
          No runs yet. Drop a run-log CSV above to start.
        </p>
      )}
      {runs.length > 0 && shown.length === 0 && (
        <p className="text-sm text-muted">No runs match the search and filters.</p>
      )}
      <ul data-testid="history" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((run) => (
          <RunCard key={run.id} run={run} />
        ))}
      </ul>
    </section>
  )
}
