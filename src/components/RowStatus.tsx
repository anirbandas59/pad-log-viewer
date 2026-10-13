import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from 'lucide-react'
import type { RowStatusKind } from '../core/derive/filter.ts'

// Icon + word, so colour is never the only signal.
const ROW_STATUS: Record<RowStatusKind, { className: string; Icon: typeof CircleCheck }> = {
  Succeeded: { className: 'text-success', Icon: CircleCheck },
  Failed: { className: 'text-failure', Icon: CircleX },
  Warning: { className: 'text-warning', Icon: TriangleAlert },
  Unknown: { className: 'text-unknown', Icon: CircleHelp },
}

export function RowStatus({ kind, label }: { kind: RowStatusKind; label?: string }) {
  const { className, Icon } = ROW_STATUS[kind]
  return (
    <span className={`inline-flex max-w-full min-w-0 items-center gap-1 ${className}`}>
      <Icon aria-hidden size={14} className="shrink-0" />
      <span className="truncate">{label || kind}</span>
    </span>
  )
}
