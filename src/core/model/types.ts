// LogRow, RunMeta, RunRecord, Annotation types.

/** One Inputs/Outputs parameter, parsed from PAD's `{ localizedName, value, variableName }`. */
export interface Param {
  /** Parameter key as it appears in the JSON (object key, or name/index for arrays). */
  key: string
  /** Display label (`localizedName`), falling back to the key. */
  label: string
  /** Variable the parameter reads or writes, if any. */
  variable: string | null
  /** Value rendered as text: strings as-is, other JSON values stringified. */
  value: string
  /** The value ends with `...`, PAD's marker for a value it shortened in the log. */
  truncated: boolean
}

/** Result of parsing one Inputs or Outputs cell. */
export interface Payload {
  params: Param[]
  /** The cell text exactly as it was in the CSV. */
  raw: string
  /** The cell was not empty and was not valid JSON; `params` is empty and `raw` is kept. */
  malformed: boolean
  /** Any parameter value, or the raw cell itself, ends with PAD's `...` truncation marker. */
  truncated: boolean
}

export interface LogRow {
  logIndex: number
  actionIndex: number
  subflow: string
  module: string
  moduleDisplay: string
  action: string
  actionDisplay: string
  level: string
  message: string
  status: string
  /** Ticks (100 ns) since the Unix epoch, UTC. */
  startTicks: bigint
  endTicks: bigint
  /** ISO 8601 with 7 fractional digits, as parsed; empty when the cell was not a timestamp. */
  startIso: string
  endIso: string
  /** end − start. */
  durationTicks: bigint
  /** start − run start. */
  offsetTicks: bigint
  inputs: Param[]
  outputs: Param[]
  /** Raw Inputs/Outputs cells, kept for the Raw JSON view and for malformed payloads. */
  inputsRaw: string
  outputsRaw: string
  /** Inputs or Outputs was not valid JSON. */
  payloadMalformed: boolean
  /** Some Inputs/Outputs value was shortened by PAD. */
  truncated: boolean
  /** Unknown extra columns, by original header. */
  extra: Record<string, string>
  /** Derived in M2; empty until then. */
  effect: string
  /** Derived in M2; 0 until then. */
  depth: number
  isFailure: boolean
  /** Derived in M2; empty until then. */
  searchText: string
}

export type OverallStatus = 'Succeeded' | 'Failed' | 'Unknown'

export interface RunMeta {
  id: string
  flowName: string
  fileName: string
  /** Export timestamp segment of the file name, verbatim; null when the name did not match. */
  exportedAt: string | null
  runStart: bigint
  runEnd: bigint
  durationTicks: bigint
  rowCount: number
  subflowCount: number
  failureCount: number
  overallStatus: OverallStatus
  importedAt: string
  tags: string[]
  displayName: string
}

export interface RunRecord {
  meta: RunMeta
  rows: LogRow[]
}

export interface Annotation {
  id?: number
  runId: string
  logIndex?: number
  kind: 'bookmark' | 'note'
  text: string
  createdAt: string
}
