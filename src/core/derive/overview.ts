// Overview tab data: subflow time bars, colours and facet breakdowns.
import type { RunSummary } from './summary.ts'

/** Number of subflow colours (`--subflow-0` … `--subflow-9` in the theme tokens). */
export const SUBFLOW_PALETTE_SIZE = 10

export interface SubflowBar {
  subflow: string
  ticks: bigint
  /** Share of the run duration, 0–1. */
  share: number
  /** Palette index, 0 … SUBFLOW_PALETTE_SIZE − 1. */
  color: number
}

/** Palette index from a hash of the name (FNV-1a), so a subflow keeps its colour across runs. */
export function subflowColor(subflow: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < subflow.length; i++) {
    h ^= subflow.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % SUBFLOW_PALETTE_SIZE
}

/**
 * One bar per subflow, largest first. Ticks come from the run summary, which splits wall-clock
 * time so the bars add up to the run duration exactly.
 */
export function subflowBars(
  summary: Pick<RunSummary, 'timePerSubflow' | 'durationTicks'>,
): SubflowBar[] {
  const total = Number(summary.durationTicks)
  return summary.timePerSubflow.map(({ subflow, ticks }) => ({
    subflow,
    ticks,
    share: total > 0 ? Number(ticks) / total : 0,
    color: subflowColor(subflow),
  }))
}

export interface FacetEntry {
  value: string
  count: number
}

/**
 * Facet counts, largest first (ties keep their first-appearance order). With a limit, the
 * entries past it are folded into one "Other" entry.
 */
export function facetEntries(facet: ReadonlyMap<string, number>, limit?: number): FacetEntry[] {
  const sorted = [...facet]
    .map(([value, count], i) => ({ value, count, i }))
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .map(({ value, count }) => ({ value, count }))
  if (limit === undefined || sorted.length <= limit) return sorted
  const rest = sorted.slice(limit).reduce((sum, e) => sum + e.count, 0)
  return [...sorted.slice(0, limit), { value: 'Other', count: rest }]
}
