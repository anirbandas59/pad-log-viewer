import { Download, HardDrive, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useStore } from '../../app/store.ts'
import { Button } from '../../components/index.ts'
import { formatBytes } from '../../core/model/format.ts'

/** Storage indicator, workspace export/import and Clear all history. */
export function HomeFooter() {
  const health = useStore((s) => s.health)
  const db = useStore((s) => s.db)
  const runs = useStore((s) => s.runs)
  const exportAll = useStore((s) => s.exportAll)
  const importFile = useStore((s) => s.importFile)
  const askClear = useStore((s) => s.askClear)
  const input = useRef<HTMLInputElement>(null)

  const persistence = !health
    ? ''
    : !health.indexedDb
      ? 'Session only'
      : health.persisted
        ? 'Persistent storage'
        : 'May be cleared by the browser'
  const usage =
    health?.usage != null
      ? `${formatBytes(health.usage)}${health.quota != null ? ` of ${formatBytes(health.quota)}` : ''} used`
      : null

  return (
    <footer className="flex flex-col gap-3 border-t border-border pt-4 text-sm sm:flex-row sm:items-center">
      <p className="flex flex-1 items-center gap-2 text-muted">
        <HardDrive aria-hidden size={16} className="shrink-0" />
        <span>{[usage, persistence].filter(Boolean).join(' · ')}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!db || runs.length === 0} onClick={() => void exportAll()}>
          <Download aria-hidden size={16} /> Export workspace
        </Button>
        <Button disabled={!db} onClick={() => input.current?.click()}>
          <Upload aria-hidden size={16} /> Import workspace
        </Button>
        <Button variant="ghost" disabled={runs.length === 0} onClick={askClear}>
          Clear all history
        </Button>
      </div>
      <input
        ref={input}
        data-testid="workspace-input"
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importFile(file)
        }}
      />
    </footer>
  )
}
