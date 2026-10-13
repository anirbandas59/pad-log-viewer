import { TriangleAlert } from 'lucide-react'
import { useStore } from '../../app/store.ts'
import { Button } from '../../components/index.ts'
import { shouldShowStorageBanner } from '../../core/storage/persistence.ts'

/** Warns when history may be lost: no IndexedDB, or the browser may evict it. */
export function StorageBanner() {
  const health = useStore((s) => s.health)
  const dismissed = useStore((s) => s.bannerDismissed)
  const dismiss = useStore((s) => s.dismissBanner)
  const exportAll = useStore((s) => s.exportAll)
  const empty = useStore((s) => s.runs.length === 0)
  if (!health) return null

  const sessionOnly = !health.indexedDb
  if (!sessionOnly && !shouldShowStorageBanner(health, dismissed)) return null

  return (
    <div
      data-testid="storage-banner"
      role="status"
      className="flex flex-col gap-3 rounded-md border border-warning/60 bg-warning/10 p-3 text-sm sm:flex-row sm:items-center"
    >
      <TriangleAlert aria-hidden size={18} className="shrink-0 text-warning" />
      <p className="flex-1">
        {sessionOnly
          ? 'Browser storage is unavailable, so this is a session-only viewer: runs are lost when you close this tab.'
          : 'History is kept in this browser only and may be cleared. Export your workspace regularly.'}
      </p>
      {!sessionOnly && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={empty} onClick={() => void exportAll()}>
            Export now
          </Button>
          <Button variant="ghost" onClick={() => void dismiss()}>
            Don't show again
          </Button>
        </div>
      )}
    </div>
  )
}
