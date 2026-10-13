import { FileWarning, Info, X } from 'lucide-react'
import { useStore } from '../../app/store.ts'

/** Error cards for files that could not be added, and info notes such as duplicates. */
export function Notices() {
  const notices = useStore((s) => s.notices)
  const dismiss = useStore((s) => s.dismissNotice)
  if (notices.length === 0) return null
  return (
    <ul className="space-y-2" aria-live="polite">
      {notices.map((n) => {
        const error = n.kind === 'error'
        const Icon = error ? FileWarning : Info
        return (
          <li
            key={n.id}
            data-testid={error ? 'error-card' : 'notice'}
            className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
              error ? 'border-failure/50 bg-failure/10' : 'border-border bg-surface'
            }`}
          >
            <Icon
              aria-hidden
              size={18}
              className={`mt-0.5 shrink-0 ${error ? 'text-failure' : 'text-muted'}`}
            />
            <div className="min-w-0 flex-1">
              {n.fileName && <p className="font-medium break-all">{n.fileName}</p>}
              <p className="break-words text-muted">{n.message}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(n.id)}
              className="shrink-0 rounded p-1 text-muted hover:bg-raised hover:text-fg"
            >
              <X aria-hidden size={16} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
