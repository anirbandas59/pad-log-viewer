import { ArrowLeft, Download, Pencil } from 'lucide-react'
import { useState } from 'react'
import { formatTicks } from '../../app/format.ts'
import { useStore } from '../../app/store.ts'
import { Button, StatusPill } from '../../components/index.ts'
import { formatDuration } from '../../core/model/format.ts'
import type { RunMeta } from '../../core/model/types.ts'
import type { RunSummary } from '../../core/derive/summary.ts'

function Stat({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div data-testid={`stat-${id}`} className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-sm break-words">{value}</dd>
    </div>
  )
}

function DisplayName({ run }: { run: RunMeta }) {
  const rename = useStore((s) => s.renameRun)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(run.displayName)

  if (editing) {
    const save = () => {
      setEditing(false)
      void rename(run.id, draft)
    }
    return (
      <input
        aria-label="Display name"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') {
            setDraft(run.displayName)
            setEditing(false)
          }
        }}
        className="min-h-9 w-full max-w-md rounded-md border border-border bg-bg px-2 text-lg font-semibold text-fg focus-visible:outline-2 focus-visible:outline-accent"
      />
    )
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      <h2 className="min-w-0 text-xl font-semibold break-words">{run.displayName}</h2>
      <button
        type="button"
        aria-label="Rename"
        title="Rename"
        onClick={() => {
          setDraft(run.displayName)
          setEditing(true)
        }}
        className="shrink-0 rounded p-1.5 text-muted hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Pencil aria-hidden size={16} />
      </button>
    </div>
  )
}

/** Sticky strip: back, editable name, status and the run's key numbers. */
export function RunHeader({ run, summary }: { run: RunMeta; summary?: RunSummary }) {
  const openRun = useStore((s) => s.openRun)
  const exportCsv = useStore((s) => s.exportFilteredCsv)
  return (
    <header
      data-testid="run-header"
      // Sticky below the app header from 768 px; on phones it is too tall to keep on screen.
      className="z-10 -mx-4 space-y-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur md:sticky md:top-14"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="-ml-2" onClick={() => openRun(null)}>
          <ArrowLeft aria-hidden size={16} /> Back to history
        </Button>
        <Button
          disabled={!summary}
          title="Download the rows that pass the execution log's filters, as a PAD CSV"
          onClick={exportCsv}
        >
          <Download aria-hidden size={16} /> Export filtered CSV
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <DisplayName key={run.displayName} run={run} />
        <StatusPill status={run.overallStatus} />
      </div>
      {run.flowName !== run.displayName && <p className="text-sm text-muted">{run.flowName}</p>}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat id="duration" label="Duration" value={formatDuration(run.durationTicks)} />
        <Stat id="start" label="Started" value={formatTicks(run.runStart)} />
        <Stat id="end" label="Ended" value={formatTicks(run.runEnd)} />
        <Stat id="actions" label="Actions" value={run.rowCount.toLocaleString()} />
        <Stat id="subflows" label="Subflows" value={String(run.subflowCount)} />
        <Stat id="failures" label="Failures" value={String(run.failureCount)} />
        <Stat id="warnings" label="Warnings" value={summary ? String(summary.warningCount) : '…'} />
      </dl>
    </header>
  )
}
