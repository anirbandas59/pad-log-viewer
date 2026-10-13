// M2 depth rules against the real export (sanitized, 2026-10-13). Expected depths are worked
// out from Action index (the source line) in each subflow, read as PAD logs it: a false If
// jumps past its End, loops log opener and End on every pass, Exit loop / Next loop jump to
// the loop's End (which is logged) and skip the End of the blocks they leave.
import { describe, expect, it } from 'vitest'
import { computeDepths } from '../../../src/core/derive/blocks.ts'
import { REAL_FIXTURE, loadRun } from '../helpers/fixtures.ts'

const run = loadRun(REAL_FIXTURE)
const depths = computeDepths(run.rows)

function firstVisit(subflow: string) {
  const start = run.rows.findIndex((r) => r.subflow === subflow)
  let end = start
  while (end < run.rows.length && run.rows[end]!.subflow === subflow) end++
  return run.rows.slice(start, end).map((r, i) => [r.actionIndex, depths[start + i]])
}

describe('block depth on the real export', () => {
  it('never goes negative', () => {
    expect(depths).toHaveLength(run.rows.length)
    expect(Math.min(...depths)).toBe(0)
  })

  it('nests For each > Block > If, closing them at the End after Next loop', () => {
    // If 1 { Split 2; For each 3 { Block 4 { If 5 (false) ... Next loop 9 } End 13 } End 14 }
    expect(firstVisit('Close Application').slice(0, 8)).toEqual([
      [1, 0],
      [2, 1],
      [3, 1],
      [4, 2],
      [5, 3],
      [9, 3],
      [13, 1],
      [3, 1],
    ])
    expect(firstVisit('Close Application').at(-1)).toEqual([14, 0])
  })

  it('indents a loop body inside an outer block on every pass', () => {
    const v = firstVisit('Start Up')
    expect(v[0]).toEqual([1, 0]) // Block "Assign values from config"
    expect(v.filter(([line]) => line === 56).every(([, d]) => d === 1)).toBe(true) // Loop
    expect(v.filter(([line]) => line === 57).every(([, d]) => d === 2)).toBe(true) // loop body
    expect(v.filter(([line]) => line === 59).every(([, d]) => d === 1)).toBe(true) // loop End
  })

  it('closes the loop and its inner If at the End after Exit loop', () => {
    expect(firstVisit('Get Email Details')).toEqual([
      [1, 0],
      [2, 0],
      [3, 0], // If (false)
      [7, 0], // Loop
      [8, 1],
      [9, 1], // Block
      [10, 2],
      [11, 2],
      [12, 2], // If (true)
      [13, 3],
      [14, 3],
      [15, 2], // End if
      [16, 2],
      [17, 2], // Exit loop
      [20, 0], // End loop
      [21, 0], // If (false)
      [26, 0], // If (true)
      [27, 1], // For each
      [28, 2],
      [29, 2], // If (true)
      [30, 3],
      [31, 3], // Exit loop
      [33, 1], // End for each
      [34, 1], // If (true)
      [35, 2],
      [36, 2],
      [37, 2], // If (true)
      [38, 3],
      [39, 2], // End if
      [42, 1], // End if
      [43, 1],
      [44, 0], // End if
      [45, 0],
    ])
  })

  it('aligns Else with its If', () => {
    const v = firstVisit('Create or Empty Folders')
    const at = (line: number) => v.find(([l]) => l === line)![1]
    expect(at(16)).toBe(at(19)) // If folder exists / Else
    expect(at(20)).toBe(at(19)! + 1)
    expect(at(21)).toBe(at(16)) // End
  })

  it('does not leave main indented after Go to jumps out of open Ifs', () => {
    const label = run.rows.findIndex((r) => r.subflow === 'main' && r.action === 'Label')
    expect(depths[label]).toBe(0)
  })
})
