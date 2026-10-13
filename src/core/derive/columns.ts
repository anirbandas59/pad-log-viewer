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

export const LOG_COLUMNS: readonly LogColumn[] = []

export type ColumnVisibility = Record<LogColumnId, boolean>

export function defaultColumnVisibility(): ColumnVisibility {
  throw new Error('not implemented')
}

export function readColumnVisibility(stored: unknown): ColumnVisibility {
  void stored
  throw new Error('not implemented')
}
