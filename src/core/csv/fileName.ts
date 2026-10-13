// Parses <flow>-<guid>-<timestamp>.csv (portal export) and <flow>_<guid>_<timestamp>.csv file names.

export interface FileNameInfo {
  fileName: string
  flowName: string
  /** Run GUID, lower-cased; null when the name does not match the default format. */
  runId: string | null
  /** Export timestamp segment, verbatim; null when the name does not match. */
  exportedAt: string | null
  matched: boolean
}

// Greedy flow name, so the split anchors on the last strict 8-4-4-4-12 GUID; the flow name may
// itself contain hyphens and underscores. Portal exports separate the parts with `-`.
const PATTERN =
  /^(.+)[-_]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[-_]([^\\/]+)$/i

export function parseFileName(fileName: string): FileNameInfo {
  const base = fileName.split(/[\\/]/).pop() ?? fileName
  const stem = base.replace(/\.csv$/i, '')
  const m = PATTERN.exec(stem)
  if (!m) return { fileName: base, flowName: stem, runId: null, exportedAt: null, matched: false }
  return {
    fileName: base,
    flowName: m[1]!,
    runId: m[2]!.toLowerCase(),
    exportedAt: m[3]!,
    matched: true,
  }
}

/** Same export: same run GUID and same export timestamp (the same file dropped again). */
export function isSameExport(a: FileNameInfo, b: FileNameInfo): boolean {
  return isSameRun(a, b) && a.exportedAt === b.exportedAt
}

/** Same run: same run GUID, any export timestamp (a re-export of the run). */
export function isSameRun(a: FileNameInfo, b: FileNameInfo): boolean {
  return a.runId !== null && a.runId === b.runId
}
