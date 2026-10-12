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

export function parseFileName(fileName: string): FileNameInfo {
  void fileName
  throw new Error('not implemented')
}
