import { describe, expect, it } from 'vitest'
import { searchText } from '../../../src/core/derive/search.ts'

const base = {
  subflow: 'Process_Invoice',
  module: 'Excel',
  moduleDisplay: 'Excel',
  action: 'ReadFromExcel',
  actionDisplay: 'Read from Excel worksheet',
  level: 'Error',
  message: 'Sheet NOT found',
  status: 'Failed',
  effect: 'ExcelData ← "Row 1"',
  inputs: [
    {
      key: 'Instance',
      label: 'Excel instance',
      variable: 'ExcelInstance',
      value: '%ExcelInstance%',
      truncated: false,
    },
  ],
  outputs: [
    {
      key: 'Data',
      label: 'Retrieved values',
      variable: 'ExcelData',
      value: 'INV-0001',
      truncated: false,
    },
  ],
  inputsRaw: '{}',
  outputsRaw: '{}',
  payloadMalformed: false,
}

describe('searchText', () => {
  it('is lower case and covers names, message, status, effect and parameters', () => {
    const t = searchText(base)
    expect(t).toBe(t.toLowerCase())
    for (const s of [
      'process_invoice',
      'read from excel worksheet',
      'readfromexcel',
      'sheet not found',
      'failed',
      'error',
      'exceldata ← "row 1"',
      'excel instance',
      'excelinstance',
      'retrieved values',
      'inv-0001',
    ]) {
      expect(t, s).toContain(s)
    }
  })

  it('does not join neighbouring fields into false matches', () => {
    expect(searchText(base)).not.toContain('worksheetsheet')
  })

  it('includes the raw text of a malformed payload', () => {
    const t = searchText({
      ...base,
      inputs: [],
      inputsRaw: '{"Path": "C:\\\\Broken',
      payloadMalformed: true,
    })
    expect(t).toContain('c:\\\\broken')
  })
})
