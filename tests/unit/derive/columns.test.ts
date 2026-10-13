import { describe, expect, it } from 'vitest'
import {
  LOG_COLUMNS,
  defaultColumnVisibility,
  readColumnVisibility,
} from '../../../src/core/derive/columns.ts'

describe('LOG_COLUMNS', () => {
  it('shows the main columns and hides the internal ones by default', () => {
    const visible = LOG_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id)
    const hidden = LOG_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.id)
    expect(visible).toEqual([
      'logIndex',
      'time',
      'duration',
      'subflow',
      'action',
      'effect',
      'status',
      'message',
    ])
    expect(hidden).toEqual(['actionIndex', 'module', 'actionName', 'start', 'end', 'level'])
  })
})

describe('readColumnVisibility', () => {
  it('uses the defaults for missing or junk settings', () => {
    expect(readColumnVisibility(undefined)).toEqual(defaultColumnVisibility())
    expect(readColumnVisibility('nope')).toEqual(defaultColumnVisibility())
  })

  it('applies stored booleans for known columns only', () => {
    const v = readColumnVisibility({ level: true, effect: false, bogus: true, time: 'yes' })
    expect(v.level).toBe(true)
    expect(v.effect).toBe(false)
    expect(v.time).toBe(true)
    expect('bogus' in v).toBe(false)
  })

  it('always keeps the Action column', () => {
    expect(readColumnVisibility({ action: false }).action).toBe(true)
  })
})
