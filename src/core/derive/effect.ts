// One-line effect summary per row.
import type { LogRow, Param } from '../model/types.ts'
import { DEFAULT_DEPTH_RULES, classifyAction, type DepthRules } from './blocks.ts'

/** Longest value shown in an effect before it is cut with `…`. */
export const EFFECT_VALUE_MAX = 80

function oneLine(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length > EFFECT_VALUE_MAX ? flat.slice(0, EFFECT_VALUE_MAX) + '…' : flat
}

// Numbers and booleans read better unquoted; everything else is shown as quoted text.
function literal(value: string): string {
  const v = oneLine(value)
  return /^(-?\d+(\.\d+)?|true|false)$/i.test(v) ? v : `"${v}"`
}

/**
 * `variable ← value` for an action that writes a variable, `Condition = value` for a
 * conditional, the operator and value for a Case, otherwise the first input.
 */
export function effectSummary(
  row: Pick<LogRow, 'module' | 'action' | 'inputs' | 'outputs'>,
  rules: DepthRules = DEFAULT_DEPTH_RULES,
): string {
  const written = row.outputs.find((p) => p.variable)
  if (written) return `${written.variable} ← ${literal(written.value)}`

  const first: Param | undefined = row.inputs[0]
  const kind = classifyAction(row.module, row.action, rules)
  if (kind === 'middle') return oneLine(row.inputs.map((p) => p.value).join(' '))
  if (!first) return ''
  if (kind === 'conditional' || kind === 'block') return `${first.label} = ${oneLine(first.value)}`
  return `${first.label}: ${oneLine(first.value)}`
}
