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

export function subflowColor(subflow: string): number {
  void subflow
  throw new Error('not implemented')
}

export function subflowBars(
  summary: Pick<RunSummary, 'timePerSubflow' | 'durationTicks'>,
): SubflowBar[] {
  void summary
  throw new Error('not implemented')
}

export interface FacetEntry {
  value: string
  count: number
}

export function facetEntries(facet: ReadonlyMap<string, number>, limit?: number): FacetEntry[] {
  void facet
  void limit
  throw new Error('not implemented')
}
