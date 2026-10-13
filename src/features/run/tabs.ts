// The run view's tabs, in display order.
import type { RunTab } from '../../app/store.ts'

export const TABS: { id: RunTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'log', label: 'Execution log' },
  { id: 'variables', label: 'Variables' },
  { id: 'errors', label: 'Errors' },
]
