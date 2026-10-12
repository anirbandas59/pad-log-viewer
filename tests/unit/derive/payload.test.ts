import { describe, expect, it } from 'vitest'
import { isTruncated, parsePayload } from '../../../src/core/derive/payload.ts'

describe('isTruncated', () => {
  it('flags values ending with PAD three-dot marker only', () => {
    expect(isTruncated('C:\\Very\\Long\\Path\\to\\som...')).toBe(true)
    expect(isTruncated('...')).toBe(true)
    expect(isTruncated('complete value')).toBe(false)
    expect(isTruncated('ellipsis char…')).toBe(false)
    expect(isTruncated('')).toBe(false)
  })
})

describe('parsePayload', () => {
  it('parses an object of PAD parameters', () => {
    const raw = JSON.stringify({
      Text: { localizedName: 'Text to display', value: 'hello', variableName: null },
      Result: { localizedName: 'Result', value: 'ok', variableName: 'txt_Result' },
    })
    expect(parsePayload(raw)).toEqual({
      raw,
      malformed: false,
      truncated: false,
      params: [
        { key: 'Text', label: 'Text to display', variable: null, value: 'hello', truncated: false },
        { key: 'Result', label: 'Result', variable: 'txt_Result', value: 'ok', truncated: false },
      ],
    })
  })

  it('parses an array of parameters', () => {
    const raw = JSON.stringify([
      { name: 'Path', localizedName: 'File path', value: 'C:\\a.txt', variableName: '' },
      { localizedName: 'Encoding', value: 'UTF-8' },
      { value: 1 },
    ])
    expect(parsePayload(raw).params).toEqual([
      { key: 'Path', label: 'File path', variable: null, value: 'C:\\a.txt', truncated: false },
      { key: 'Encoding', label: 'Encoding', variable: null, value: 'UTF-8', truncated: false },
      { key: '2', label: '2', variable: null, value: '1', truncated: false },
    ])
  })

  it('renders non-string values as text', () => {
    const raw = JSON.stringify({
      N: { value: 42 },
      B: { value: false },
      Z: { value: null },
      O: { value: { a: [1, 'x'] } },
    })
    expect(parsePayload(raw).params.map((p) => p.value)).toEqual([
      '42',
      'false',
      '',
      '{"a":[1,"x"]}',
    ])
  })

  it('falls back to the key as label and accepts bare values', () => {
    const p = parsePayload(JSON.stringify({ Text: 'hello', Count: 3 }))
    expect(p.params).toEqual([
      { key: 'Text', label: 'Text', variable: null, value: 'hello', truncated: false },
      { key: 'Count', label: 'Count', variable: null, value: '3', truncated: false },
    ])
  })

  it('flags truncated values on the parameter and the payload', () => {
    const p = parsePayload(
      JSON.stringify({ Body: { localizedName: 'Body', value: '{ "FilePath": "C:\\\\x...' } }),
    )
    expect(p.params[0]!.truncated).toBe(true)
    expect(p.truncated).toBe(true)
    expect(p.malformed).toBe(false)
  })

  it('keeps the raw string and flags malformed JSON', () => {
    const raw = '{"Text": {"localizedName": "Text", "value": "abc'
    expect(parsePayload(raw)).toEqual({ raw, params: [], malformed: true, truncated: false })
  })

  it('flags a malformed cell that PAD truncated as truncated too', () => {
    const raw = '{"Text": {"localizedName": "Text", "value": "abc...'
    const p = parsePayload(raw)
    expect(p.malformed).toBe(true)
    expect(p.truncated).toBe(true)
    expect(p.raw).toBe(raw)
  })

  it('treats valid JSON that is not an object or array as malformed', () => {
    expect(parsePayload('"just a string"').malformed).toBe(true)
    expect(parsePayload('42').malformed).toBe(true)
  })

  it('treats empty and whitespace cells as no parameters', () => {
    expect(parsePayload('')).toEqual({ raw: '', params: [], malformed: false, truncated: false })
    expect(parsePayload('  ').malformed).toBe(false)
    expect(parsePayload('{}').params).toEqual([])
  })
})
