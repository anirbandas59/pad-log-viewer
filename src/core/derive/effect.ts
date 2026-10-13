// One-line effect summary per row.
import type { LogRow } from '../model/types.ts'
import type { DepthRules } from './blocks.ts'

/** Longest value shown in an effect before it is cut with `…`. */
export const EFFECT_VALUE_MAX = 80

export function effectSummary(
  row: Pick<LogRow, 'module' | 'action' | 'inputs' | 'outputs'>,
  rules?: DepthRules,
): string {
  void row
  void rules
  throw new Error('not implemented')
}
