import { ArrowLeft } from 'lucide-react'
import { useStore } from '../../app/store.ts'
import { Button, StatusPill } from '../../components/index.ts'
import { formatDuration } from '../../core/model/format.ts'

/** Run view shell; its header and tabs arrive in M5. */
export function RunScreen({ id }: { id: string }) {
  const run = useStore((s) => s.runs.find((r) => r.id === id))
  const openRun = useStore((s) => s.openRun)
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => openRun(null)}>
        <ArrowLeft aria-hidden size={16} /> Back to history
      </Button>
      {run ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold break-words">{run.displayName}</h2>
            <StatusPill status={run.overallStatus} />
          </div>
          <p className="text-sm text-muted">
            {run.rowCount.toLocaleString()} actions · {formatDuration(run.durationTicks)} ·{' '}
            {run.subflowCount} subflows
          </p>
          <p className="text-sm text-muted">
            The run view (Overview, Execution log, Variables, Errors) is not built yet.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">This run is no longer in history.</p>
      )}
    </div>
  )
}
