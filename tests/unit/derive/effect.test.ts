import { describe, expect, it } from 'vitest'
import { EFFECT_VALUE_MAX, effectSummary } from '../../../src/core/derive/effect.ts'
import type { Param } from '../../../src/core/model/types.ts'

const p = (key: string, label: string, value: string, variable: string | null = null): Param => ({
  key,
  label,
  value,
  variable,
  truncated: value.endsWith('...'),
})
const row = (module: string, action: string, inputs: Param[] = [], outputs: Param[] = []) => ({
  module,
  action,
  inputs,
  outputs,
})

describe('effectSummary', () => {
  it('shows variable ← value for actions that write a variable', () => {
    const r = row(
      'Variables',
      'Assign',
      [p('expression', 'Value', 'hello')],
      [p('variable', 'Variable name', 'hello', 'txt_Greeting')],
    )
    expect(effectSummary(r)).toBe('txt_Greeting ← "hello"')
  })

  it('leaves numbers and booleans unquoted and shows empty text as ""', () => {
    const out = (value: string) =>
      effectSummary(row('Variables', 'Assign', [], [p('v', 'Variable name', value, 'x')]))
    expect(out('42')).toBe('x ← 42')
    expect(out('-1.5')).toBe('x ← -1.5')
    expect(out('True')).toBe('x ← True')
    expect(out('')).toBe('x ← ""')
  })

  it('cuts long values to 80 characters and keeps PAD truncation visible', () => {
    const long = 'x'.repeat(200)
    const e = effectSummary(row('Variables', 'Assign', [], [p('v', 'V', long, 'txt_Long')]))
    expect(e).toBe(`txt_Long ← "${'x'.repeat(EFFECT_VALUE_MAX)}…"`)
    const cut = effectSummary(
      row('Variables', 'Assign', [], [p('v', 'V', 'C:\\Robot\\In...', 'p')]),
    )
    expect(cut).toBe('p ← "C:\\Robot\\In..."')
  })

  it('keeps the summary on one line', () => {
    const e = effectSummary(row('Text', 'AppendLine', [], [p('v', 'V', 'a\r\n  b\tc', 'txt')]))
    expect(e).toBe('txt ← "a b c"')
  })

  it('shows the written variable for loops too', () => {
    const e = effectSummary(
      row(
        'Loops',
        'Foreach',
        [p('iterator', 'Value to iterate', '[a, b]', 'lst')],
        [p('variable', 'Store into', 'a', 'txt_Item')],
      ),
    )
    expect(e).toBe('txt_Item ← "a"')
  })

  it('shows Condition = value for conditionals', () => {
    expect(effectSummary(row('Conditionals', 'If', [p('expression', 'Condition', 'False')]))).toBe(
      'Condition = False',
    )
    expect(
      effectSummary(
        row('Conditionals', 'Switch', [p('expression', 'Expression', 'BUSINESS', 'k')]),
      ),
    ).toBe('Expression = BUSINESS')
    expect(effectSummary(row('File', 'IfFileAction', [p('file', 'File path', 'C:\\a.txt')]))).toBe(
      'File path = C:\\a.txt',
    )
  })

  it('shows a Block by its name, not as a condition', () => {
    expect(effectSummary(row('FlowControl', 'Block', [p('name', 'Name', 'Get Email block')]))).toBe(
      'Name: Get Email block',
    )
  })

  it('shows a Case as its operator and value', () => {
    const e = effectSummary(
      row('Conditionals', 'Case', [
        p('operator', 'Operator', '='),
        p('rightOperand', 'Value to compare', 'BUSINESS'),
      ]),
    )
    expect(e).toBe('= BUSINESS')
  })

  it('otherwise shows the first input', () => {
    expect(
      effectSummary(
        row('FlowControl', 'CallFunction', [
          p('function', 'Subflow name', 'Start Up'),
          p('x', 'X', '1'),
        ]),
      ),
    ).toBe('Subflow name: Start Up')
  })

  it('is empty when there is nothing to show', () => {
    expect(effectSummary(row('FlowControl', 'End'))).toBe('')
    expect(effectSummary(row('Conditionals', 'Else'))).toBe('')
  })
})
