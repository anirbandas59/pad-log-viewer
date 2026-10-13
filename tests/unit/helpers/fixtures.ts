// Loads committed fixtures through the real parse + normalize pipeline.
import { readFileSync } from 'node:fs'
import { parseCsv } from '../../../src/core/csv/parseCsv.ts'
import { normalizeRows, type NormalizedRun } from '../../../src/core/model/normalize.ts'

export const NESTED_FIXTURE =
  'tests/fixtures/synthetic/Nested_Blocks-1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d-20261013T090000Z.csv'
export const REAL_FIXTURE =
  'tests/fixtures/real/Invoice_Extraction_Main-00000000-0000-4000-8000-000000000007-20261012T113808Z.csv'
export const REAL_FAILED_FIXTURE =
  'tests/fixtures/real/Invoice_Extraction_Main-00000000-0000-4000-8000-000000000002-20261013T151558Z.csv'

export function loadRun(path: string): NormalizedRun {
  const parsed = parseCsv(readFileSync(path, 'utf8'))
  if (!parsed.ok) throw new Error(parsed.error.message)
  return normalizeRows(parsed.rows, parsed.mapping)
}

/*
 * The nested fixture is an execution trace (Action index = source line) of this program,
 * logged the way PAD logs it: only executed actions; a false If jumps past its body and
 * its End; loops log their opener and End on every pass; Exit loop and Go to skip the
 * End of the blocks they leave.
 *
 *  main                              Sub
 *   1 Set variable                    1 If (true)
 *   2 For each [a, b]                 2   Set variable
 *   3   If (a: true, b: false)        3 End
 *   4     Set variable
 *   5     Loop 1 to 2
 *   6       Set variable
 *   7     End
 *   8   Else
 *   9     Set variable
 *  10   End
 *  11   Run subflow Sub
 *  12 End
 *  13 If (false)  14 Set variable  15 End
 *  16 Set variable
 *  17 Loop  18 If (true)  19 Exit loop  20 End  21 End
 *  22 Switch  23 Case  24 Set variable  25 Case  26 Set variable  27 End
 *  28 If (true)  29 Go to L  30 End
 *  31 Label L
 *  32 Set variable
 */

/** Expected depth of each fixture row, by Log index, worked out by hand from the program above. */
export const NESTED_DEPTHS = [
  0, // 1 Set variable
  0, // 2 For each (a)
  1, // 3 If true
  2, // 4 Set variable
  2, // 5 Loop (1)
  3, // 6 Set variable
  2, // 7 End loop
  2, // 8 Loop (2)
  3, // 9 Set variable
  2, // 10 End loop
  1, // 11 End if
  1, // 12 Run subflow Sub
  0, // 13 Sub: If true
  1, // 14 Sub: Set variable
  0, // 15 Sub: End
  0, // 16 End for each
  0, // 17 For each (b)
  1, // 18 If false → Else
  1, // 19 Else
  2, // 20 Set variable
  1, // 21 End if
  1, // 22 Run subflow Sub
  0, // 23 Sub: If true
  1, // 24 Sub: Set variable
  0, // 25 Sub: End
  0, // 26 End for each
  0, // 27 If false (body and End skipped, not logged)
  0, // 28 Set variable
  0, // 29 Loop
  1, // 30 If true
  2, // 31 Exit loop
  0, // 32 End loop (If's End skipped by the exit)
  0, // 33 Switch
  0, // 34 Case
  1, // 35 Set variable
  0, // 36 End switch
  0, // 37 If true
  1, // 38 Go to L (If's End never reached)
  0, // 39 Label L
  0, // 40 Set variable
]
