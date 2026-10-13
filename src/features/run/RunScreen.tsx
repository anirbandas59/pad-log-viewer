import { useStore } from '../../app/store.ts'
import { LogList } from '../log/index.ts'
import { OverviewTab } from '../overview/index.ts'
import { RunHeader } from './RunHeader.tsx'
import { RunTabs } from './RunTabs.tsx'
import { TABS } from './tabs.ts'

/** Run view: header, tabs and the selected tab's panel. */
export function RunScreen({ id }: { id: string }) {
  const run = useStore((s) => s.runs.find((r) => r.id === id))
  const active = useStore((s) => s.activeRun)
  const tab = useStore((s) => s.runTab)
  const openRun = useStore((s) => s.openRun)

  if (!run) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">This run is no longer in history.</p>
        <button type="button" className="text-sm underline" onClick={() => openRun(null)}>
          Back to history
        </button>
      </div>
    )
  }
  const derived = active?.id === id && active.status === 'ready' ? active.derived : undefined
  const label = TABS.find((t) => t.id === tab)!.label

  return (
    <div className="space-y-4">
      <RunHeader run={run} summary={derived?.summary} />
      <RunTabs />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {active?.status === 'error' ? (
          <p className="rounded-md border border-failure/50 bg-failure/10 p-3 text-sm">
            This run could not be opened: {active.error}
          </p>
        ) : !derived ? (
          <p className="text-sm text-muted">Reading the log…</p>
        ) : tab === 'overview' ? (
          <OverviewTab run={derived} />
        ) : tab === 'log' ? (
          <LogList rows={derived.rows} />
        ) : (
          <p className="text-sm text-muted">The {label} view is not built yet.</p>
        )}
      </div>
    </div>
  )
}
