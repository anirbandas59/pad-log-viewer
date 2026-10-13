// Facts of the real failed-run export (same flow as the first real fixture, sanitized
// 2026-10-13). It is the failure path's real-log check: a parser or derive change that
// disagrees with how PAD logs a failure breaks these tests.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseFileName } from '../../../src/core/csv/fileName.ts'
import { parseCsv } from '../../../src/core/csv/parseCsv.ts'
import { deriveRun } from '../../../src/core/derive/deriveRun.ts'
import { errorContexts } from '../../../src/core/derive/errors.ts'
import { parsePayload } from '../../../src/core/derive/payload.ts'
import { REAL_FAILED_FIXTURE, loadRun } from '../helpers/fixtures.ts'

const NAME = REAL_FAILED_FIXTURE.split('/').pop()!
const text = readFileSync(REAL_FAILED_FIXTURE, 'utf8')

describe('real failed-run fixture', () => {
  it('has the portal file-name format, BOM and sep= line, and parses cleanly', () => {
    expect(parseFileName(NAME)).toMatchObject({
      matched: true,
      flowName: 'Invoice_Extraction_Main',
      exportedAt: '20261013T151558Z',
    })
    expect(text.startsWith('﻿sep=,\r\n')).toBe(true)
    const r = parseCsv(text)
    if (!r.ok) throw new Error(r.error.message)
    expect(r.headers).toHaveLength(14)
    expect(r.rows).toHaveLength(194)
    expect(r.warnings).toEqual([])
    const payloads = r.rows.flatMap((row) => [row.Inputs!, row.Outputs!]).filter((c) => c.trim())
    expect(payloads.filter((c) => parsePayload(c).malformed)).toHaveLength(0)
    expect(payloads.filter((c) => parsePayload(c).truncated)).toHaveLength(29)
  })

  it('has exactly one failure: the custom error thrown at the end of the run', () => {
    const run = loadRun(REAL_FAILED_FIXTURE)
    expect(run.issues).toEqual([])
    const failures = run.rows.filter((r) => r.isFailure)
    expect(failures.map((r) => [r.logIndex, r.subflow, r.actionDisplay, r.status])).toEqual([
      [194, 'Download File from SharePoint', 'Throw custom error', 'Failed'],
    ])
    // PAD leaves Log level and Log message empty here; the error text is in the payload.
    expect(failures[0]!.level).toBe('')
    expect(failures[0]!.message).toBe('')
    const params = Object.fromEntries(failures[0]!.inputs.map((p) => [p.label, p.value]))
    expect(params['Error name']).toBe('System Unavailable Exception')
    expect(params['Error message']).toContain("status code 'NotFound'")
  })

  it('points the Overview first-failure card at that row', () => {
    const derived = deriveRun(loadRun(REAL_FAILED_FIXTURE))
    expect(derived.summary.firstFailure?.logIndex).toBe(194)
  })

  it('gives the Errors tab the failure with the error handling that led to it', () => {
    const [context, ...rest] = errorContexts(loadRun(REAL_FAILED_FIXTURE).rows)
    expect(rest).toEqual([])
    expect(context!.failure.logIndex).toBe(194)
    expect(context!.before.map((r) => [r.logIndex, r.actionDisplay])).toEqual([
      [191, 'Set variable'],
      [192, 'Set variable'],
      [193, 'If'],
    ])
  })

  // Hand-worked from the Close Application subflow (Action index = source line):
  //  1 If (true)                       depth 0
  //  2   Split text                    depth 1
  //  3   For each app (5 passes)       depth 1
  //  4     On block error              depth 2
  //  5       If process (false: skips its body and End)  depth 3
  //  9       Next loop                 depth 3 (inside the block body, after If process ends)
  // 13   End (of For each, logged on every pass)        depth 1
  // 14 End (of If)                     depth 0
  it('matches the hand-worked depths of the Close Application subflow', () => {
    const rows = deriveRun(loadRun(REAL_FAILED_FIXTURE)).rows.filter(
      (r) => r.subflow === 'Close Application',
    )
    const byLine = new Map<number, Set<number>>()
    for (const r of rows) {
      if (!byLine.has(r.actionIndex)) byLine.set(r.actionIndex, new Set())
      byLine.get(r.actionIndex)!.add(r.depth)
    }
    const depthOf = (line: number) => [...(byLine.get(line) ?? [])]
    expect(depthOf(1)).toEqual([0])
    expect(depthOf(2)).toEqual([1])
    expect(depthOf(3)).toEqual([1])
    expect(depthOf(4)).toEqual([2])
    expect(depthOf(5)).toEqual([3])
    expect(depthOf(9)).toEqual([3])
    expect(depthOf(13)).toEqual([1])
    expect(depthOf(14)).toEqual([0])
    expect(rows.filter((r) => r.actionDisplay === 'For each')).toHaveLength(5)
  })

  it('derives block depth that never goes negative', () => {
    const derived = deriveRun(loadRun(REAL_FAILED_FIXTURE))
    expect(Math.min(...derived.rows.map((r) => r.depth))).toBeGreaterThanOrEqual(0)
  })
})
