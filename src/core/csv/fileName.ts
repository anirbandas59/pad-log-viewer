// Parses <flow>_<guid>_<timestamp>.csv file names.

export interface FileNameInfo {
  fileName: string
  flowName: string
  /** Run GUID, lower-cased; null when the name does not match the default format. */
  runId: string | null
  /** Export timestamp segment, verbatim; null when the name does not match. */
  exportedAt: string | null
  matched: boolean
}

// Greedy flow name, so the split anchors on the last strict 8-4-4-4-12 GUID.
const PATTERN = /^(.+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([^\\/]+)$/i

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
