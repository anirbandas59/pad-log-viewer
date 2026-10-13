// Execution-log grid tracks.
import type { LogColumnId } from '../../core/derive/columns.ts'

/** Grid track per column; the flexible columns share what is left. */
export const COLUMN_TRACK: Record<LogColumnId, { track: string; minRem: number }> = {
  logIndex: { track: '4.5rem', minRem: 4.5 },
  time: { track: '6.5rem', minRem: 6.5 },
  duration: { track: '7.5rem', minRem: 7.5 },
  subflow: { track: '12rem', minRem: 12 },
  action: { track: 'minmax(10rem,2fr)', minRem: 10 },
  effect: { track: 'minmax(10rem,2fr)', minRem: 10 },
  status: { track: '7.5rem', minRem: 7.5 },
  message: { track: 'minmax(10rem,2fr)', minRem: 10 },
  actionIndex: { track: '5.5rem', minRem: 5.5 },
  module: { track: '8rem', minRem: 8 },
  actionName: { track: '9rem', minRem: 9 },
  start: { track: '15rem', minRem: 15 },
  end: { track: '15rem', minRem: 15 },
  level: { track: '6rem', minRem: 6 },
}
