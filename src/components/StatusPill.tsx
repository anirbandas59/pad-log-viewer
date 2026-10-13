import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import type { OverallStatus } from '../core/model/types.ts'

// Status is always shown as icon + word, so colour is never the only signal.
const STYLES: Record<OverallStatus, { className: string; Icon: typeof CircleCheck }> = {
  Succeeded: { className: 'text-success border-success/40 bg-success/10', Icon: CircleCheck },
  Failed: { className: 'text-failure border-failure/40 bg-failure/10', Icon: CircleX },
  Unknown: { className: 'text-unknown border-unknown/40 bg-unknown/10', Icon: CircleHelp },
}

export function StatusPill({ status }: { status: OverallStatus }) {
  const { className, Icon } = STYLES[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon aria-hidden size={14} />
      {status}
    </span>
  )
}
