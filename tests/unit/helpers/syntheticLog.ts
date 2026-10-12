// Deterministic synthetic PAD run logs for tests. No real data.
import Papa from 'papaparse'

export const HEADERS = [
  'Start time',
  'End time',
  'Subflow',
  'Log index',
  'Action index',
  'Module name',
  'Action name',
  'Module display name',
  'Action display name',
  'Log level',
  'Log message',
  'Status',
  'Inputs',
  'Outputs',
] as const

export type SyntheticRow = Record<(typeof HEADERS)[number], string> & Record<string, string>

/** Base epoch for synthetic runs: 2026-10-01T09:00:00Z. */
export const BASE_MS = Date.UTC(2026, 9, 1, 9, 0, 0)

/** ISO timestamp with 7 fractional digits, `ticks` 100 ns units after BASE_MS. */
export function isoAt(ticks: number): string {
  const ms = BASE_MS + Math.floor(ticks / 10_000)
  const frac = String(ticks % 10_000_000).padStart(7, '0')
  return new Date(ms).toISOString().slice(0, 19) + '.' + frac + 'Z'
}

export function param(localizedName: string, value: unknown, variableName: string | null = null) {
  return { localizedName, value, variableName }
}

export function row(overrides: Partial<SyntheticRow> & { 'Log index': string }): SyntheticRow {
  const i = Number(overrides['Log index'])
  return {
    'Start time': isoAt(i * 1_000_000),
    'End time': isoAt(i * 1_000_000 + 5_000),
    Subflow: 'main',
    'Action index': String(i),
    'Module name': 'Variables',
    'Action name': 'SetVariable',
    'Module display name': 'Variables',
    'Action display name': 'Set variable',
    'Log level': '',
    'Log message': '',
    Status: 'Succeeded',
    Inputs: JSON.stringify({ Value: param('Value', `value ${i}`) }),
    Outputs: JSON.stringify({ Variable: param('Variable', `value ${i}`, `var${i % 50}`) }),
    ...overrides,
  }
}

export function toCsv(
  rows: readonly Record<string, string>[],
  headers?: readonly string[],
): string {
  const fields = headers ?? (rows[0] ? Object.keys(rows[0]) : [...HEADERS])
  return Papa.unparse({ fields: [...fields], data: rows.map((r) => fields.map((f) => r[f] ?? '')) })
}

const SUBFLOWS = ['main', 'Init', 'Process_Invoice', 'Send_Report', 'Cleanup']
const MODULES: [string, string, string, string][] = [
  ['Variables', 'SetVariable', 'Variables', 'Set variable'],
  ['Flowcontrol', 'If', 'Conditionals', 'If'],
  ['Flowcontrol', 'Loop', 'Loops', 'Loop'],
  ['File', 'ReadText', 'File', 'Read text from file'],
  ['Excel', 'ReadFromExcel', 'Excel', 'Read from Excel worksheet'],
  ['Web', 'InvokeWebService', 'HTTP', 'Invoke web service'],
]

/** A realistic-looking run of `count` rows with payloads of a few hundred bytes. */
export function syntheticRun(count: number): SyntheticRow[] {
  const rows: SyntheticRow[] = []
  let t = 0
  for (let i = 1; i <= count; i++) {
    const [module, action, moduleDisplay, actionDisplay] = MODULES[i % MODULES.length]!
    const duration = 1 + ((i * 7919) % 200_000)
    const failed = i % 997 === 0
    rows.push({
      'Start time': isoAt(t),
      'End time': isoAt(t + duration),
      Subflow: SUBFLOWS[Math.floor(i / 100) % SUBFLOWS.length]!,
      'Log index': String(i),
      'Action index': String(i % 120),
      'Module name': module,
      'Action name': action,
      'Module display name': moduleDisplay,
      'Action display name': actionDisplay,
      'Log level': failed ? 'Error' : '',
      'Log message': failed ? `Action failed at step ${i}: "timeout"` : '',
      Status: failed ? 'Failed' : 'Succeeded',
      Inputs: JSON.stringify({
        FilePath: param('File path', `C:\\Data\\Batch ${i % 10}\\input_${i}.txt`),
        Encoding: param('Encoding', 'UTF-8'),
        Payload: param('Payload', `{ "id": ${i}, "items": [${'"x", '.repeat(20)}"y"] }`),
      }),
      Outputs: JSON.stringify({
        Result: param(
          'Result',
          i % 13 === 0 ? 'a long value that PAD cut short...' : `ok ${i}`,
          `var${i % 50}`,
        ),
        Count: param('Count', i, 'count'),
      }),
    })
    t += duration + 1_000
  }
  return rows
}
