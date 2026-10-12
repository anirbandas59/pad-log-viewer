// Expected CSV columns and header aliases.

export type ColumnKey =
  | 'startTime'
  | 'endTime'
  | 'subflow'
  | 'logIndex'
  | 'actionIndex'
  | 'moduleName'
  | 'actionName'
  | 'moduleDisplayName'
  | 'actionDisplayName'
  | 'logLevel'
  | 'logMessage'
  | 'status'
  | 'inputs'
  | 'outputs'

export interface ColumnSpec {
  key: ColumnKey
  header: string
  required: boolean
  aliases: string[]
}

const col = (key: ColumnKey, header: string, required: boolean, aliases: string[] = []) => ({
  key,
  header,
  required,
  aliases,
})

/**
 * The PAD run-log columns, in export order. Optional columns default to empty
 * strings when absent; a file missing any required column is rejected.
 */
export const COLUMNS: readonly ColumnSpec[] = [
  col('startTime', 'Start time', true),
  col('endTime', 'End time', true),
  col('subflow', 'Subflow', true, ['Subflow name']),
  col('logIndex', 'Log index', true),
  col('actionIndex', 'Action index', true),
  col('moduleName', 'Module name', false),
  col('actionName', 'Action name', false),
  col('moduleDisplayName', 'Module display name', false),
  col('actionDisplayName', 'Action display name', true),
  col('logLevel', 'Log level', false),
  col('logMessage', 'Log message', false),
  col('status', 'Status', true),
  col('inputs', 'Inputs', true),
  col('outputs', 'Outputs', true),
]

export interface HeaderResolution {
  /** Column key → original header text in the file. */
  mapping: Partial<Record<ColumnKey, string>>
  /** Canonical names of required columns that are absent. */
  missing: string[]
  /** Headers that match no known column, in file order. */
  extra: string[]
}

/** Comparison form of a header: no BOM, case, spaces or underscores. */
export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '')
}

const LOOKUP = new Map<string, ColumnKey>(
  COLUMNS.flatMap((c) => [c.header, ...c.aliases].map((h) => [normalizeHeader(h), c.key] as const)),
)

export function resolveHeaders(headers: readonly string[]): HeaderResolution {
  const mapping: Partial<Record<ColumnKey, string>> = {}
  const extra: string[] = []
  for (const header of headers) {
    const key = LOOKUP.get(normalizeHeader(header))
    if (key && mapping[key] === undefined) mapping[key] = header
    else extra.push(header)
  }
  const missing = COLUMNS.filter((c) => c.required && mapping[c.key] === undefined).map(
    (c) => c.header,
  )
  return { mapping, missing, extra }
}
