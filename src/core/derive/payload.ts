// Inputs/Outputs JSON parsing and truncation flag.
import type { Param, Payload } from '../model/types.ts'

/** PAD shortens long values in the log and ends them with three ASCII dots. */
export const TRUNCATION_MARKER = '...'

export function isTruncated(value: string): boolean {
  return value.endsWith(TRUNCATION_MARKER)
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toParam(key: string, entry: unknown): Param {
  if (isRecord(entry) && 'value' in entry) {
    const label =
      typeof entry.localizedName === 'string' && entry.localizedName ? entry.localizedName : key
    const variable =
      typeof entry.variableName === 'string' && entry.variableName ? entry.variableName : null
    const value = asText(entry.value)
    return { key, label, variable, value, truncated: isTruncated(value) }
  }
  const value = asText(entry)
  return { key, label: key, variable: null, value, truncated: isTruncated(value) }
}

/**
 * Parses one Inputs or Outputs cell. PAD writes either an object keyed by
 * parameter name or an array of `{ localizedName, value, variableName }`.
 * Invalid JSON keeps the raw text and is flagged, never thrown.
 */
export function parsePayload(raw: string): Payload {
  if (raw.trim() === '') return { raw, params: [], malformed: false, truncated: false }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { raw, params: [], malformed: true, truncated: isTruncated(raw.trimEnd()) }
  }

  let params: Param[]
  if (Array.isArray(json)) {
    params = json.map((entry: unknown, i) => {
      const name =
        isRecord(entry) && typeof entry.name === 'string' && entry.name ? entry.name : null
      const label =
        isRecord(entry) && typeof entry.localizedName === 'string' ? entry.localizedName : null
      return toParam(name ?? label ?? String(i), entry)
    })
  } else if (isRecord(json)) {
    params = Object.entries(json).map(([key, entry]) => toParam(key, entry))
  } else {
    return { raw, params: [], malformed: true, truncated: false }
  }
  return { raw, params, malformed: false, truncated: params.some((p) => p.truncated) }
}
