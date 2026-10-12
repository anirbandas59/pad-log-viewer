// Pure sanitizer logic for scripts/sanitize-log.ts; no Node APIs so tests can import it.

export interface SanitizeOptions {
  /** Original file name; its run GUID is replaced consistently with the log body. */
  fileName: string
  /** Extra words to remove everywhere (client names, machine names), matched case-insensitively. */
  terms?: string[]
  /** Replacement flow name for the output file name. */
  flowName?: string
}

export interface SanitizeResult {
  csv: string
  fileName: string
  /** Number of replacements per kind (guid, path, email, url, account, term). */
  counts: Record<string, number>
  /** Sensitive originals still present in the output; must be empty. */
  residual: string[]
}

export function sanitizeLog(csv: string, options: SanitizeOptions): SanitizeResult {
  void csv
  void options
  throw new Error('not implemented')
}
