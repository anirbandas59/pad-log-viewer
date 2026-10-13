// Execution-log columns and their default visibility.

export type LogColumnId =
  | 'logIndex'
  | 'time'
  | 'duration'
  | 'subflow'
  | 'action'
  | 'effect'
  | 'status'
  | 'message'
  | 'actionIndex'
  | 'module'
  | 'actionName'
  | 'start'
  | 'end'
  | 'level'

export interface LogColumn {
  id: LogColumnId
  label: string
  defaultVisible: boolean
}

/** In display order; visibility defaults from the architecture's Execution log table. */
export const LOG_COLUMNS: readonly LogColumn[] = [
  { id: 'logIndex', label: '#', defaultVisible: true },
  { id: 'time', label: 'Time', defaultVisible: true },
  { id: 'duration', label: 'Duration', defaultVisible: true },
  { id: 'subflow', label: 'Subflow', defaultVisible: true },
  { id: 'action', label: 'Action', defaultVisible: true },
  { id: 'effect', label: 'Effect', defaultVisible: true },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'message', label: 'Message', defaultVisible: true },
  { id: 'actionIndex', label: 'Action index', defaultVisible: false },
  { id: 'module', label: 'Module name', defaultVisible: false },
  { id: 'actionName', label: 'Action name', defaultVisible: false },
  { id: 'start', label: 'Start time', defaultVisible: false },
  { id: 'end', label: 'End time', defaultVisible: false },
  { id: 'level', label: 'Log level', defaultVisible: false },
]

export type ColumnVisibility = Record<LogColumnId, boolean>

export function defaultColumnVisibility(): ColumnVisibility {
  return Object.fromEntries(LOG_COLUMNS.map((c) => [c.id, c.defaultVisible])) as ColumnVisibility
}

/** Column visibility from the settings store; unknown keys and non-booleans are ignored. */
export function readColumnVisibility(stored: unknown): ColumnVisibility {
  const visibility = defaultColumnVisibility()
  if (stored && typeof stored === 'object') {
    for (const c of LOG_COLUMNS) {
      const value = (stored as Record<string, unknown>)[c.id]
      if (typeof value === 'boolean') visibility[c.id] = value
    }
  }
  // The Action column identifies the row; it cannot be hidden.
  visibility.action = true
  return visibility
}
