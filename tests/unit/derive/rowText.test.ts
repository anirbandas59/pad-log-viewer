import { describe, expect, it } from 'vitest'
import { rowAsText } from '../../../src/core/derive/rowText.ts'
import type { LogRow } from '../../../src/core/model/types.ts'
import { loadRun, NESTED_FIXTURE } from '../helpers/fixtures.ts'

describe('rowAsText', () => {
  const base = loadRun(NESTED_FIXTURE).rows[0]!
  const row: LogRow = {
    ...base,
    logIndex: 12,
    actionDisplay: 'Invoke web service',
    subflow: 'Process_Invoice',
    status: 'Failed',
    level: 'Error',
    message: 'The remote server returned an error: (504) Gateway Timeout.',
    startIso: '2026-10-01T09:00:00.2790000Z',
    offsetTicks: 2_790_000n,
    durationTicks: 30_000_311n,
    inputs: [
      {
        key: 'Url',
        label: 'URL',
        variable: null,
        value: 'https://api.example.test/invoices',
        truncated: false,
      },
      {
        key: 'Body',
        label: 'Request body',
        variable: 'txt_ApiPayload',
        value: '{ "a": 1...',
        truncated: true,
      },
    ],
    outputs: [],
  }

  it('lists the row, its timing, message and parameters as plain text', () => {
    expect(rowAsText(row)).toBe(
      [
        '#12 Invoke web service · Process_Invoice · Failed',
        'Time: 2026-10-01T09:00:00.2790000Z (+00:00.279), duration 3.0 s',
        'Log level: Error',
        'Message: The remote server returned an error: (504) Gateway Timeout.',
        'Inputs:',
        '  URL: https://api.example.test/invoices',
        '  Request body [txt_ApiPayload]: { "a": 1... (truncated by PAD)',
        'Outputs: none',
      ].join('\n'),
    )
  })

  it('leaves out empty level and message lines', () => {
    const text = rowAsText({ ...row, level: '', message: '' })
    expect(text).not.toMatch(/Log level|Message/)
  })
})
