// Inputs/Outputs JSON parsing and truncation flag.
import type { Payload } from '../model/types.ts'

export const TRUNCATION_MARKER = '...'

export function isTruncated(value: string): boolean {
  void value
  throw new Error('not implemented')
}

export function parsePayload(raw: string): Payload {
  void raw
  throw new Error('not implemented')
}
