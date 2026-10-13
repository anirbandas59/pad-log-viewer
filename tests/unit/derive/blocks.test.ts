import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DEPTH_RULES,
  classifyAction,
  computeDepths,
  type DepthRules,
} from '../../../src/core/derive/blocks.ts'
import { NESTED_DEPTHS, NESTED_FIXTURE, loadRun } from '../helpers/fixtures.ts'

const r = (subflow: string, actionIndex: number, key: string) => {
  const [module, action] = key.split('.') as [string, string]
  return { subflow, actionIndex, module, action }
}

describe('classifyAction', () => {
  it.each([
    ['Conditionals', 'If', 'conditional'],
    ['System', 'IfProcessAction', 'conditional'],
    ['File', 'IfFileAction', 'conditional'],
    ['Folder', 'IfFolderExistsAction', 'conditional'],
    ['Loops', 'Loop', 'loop'],
    ['Loops', 'Foreach', 'loop'],
    ['Loops', 'LoopCondition', 'loop'],
    ['FlowControl', 'Block', 'block'],
    ['Conditionals', 'Switch', 'block'],
    ['Conditionals', 'Else', 'middle'],
    ['Conditionals', 'ElseIf', 'middle'],
    ['Conditionals', 'Case', 'middle'],
    ['Conditionals', 'DefaultCase', 'middle'],
    ['FlowControl', 'End', 'end'],
    ['Loops', 'Break', 'loopExit'],
    ['Loops', 'Continue', 'loopExit'],
    ['FlowControl', 'GoTo', 'goto'],
    ['Variables', 'Assign', null],
    ['FlowControl', 'CallFunction', null],
    ['FlowControl', 'Label', null],
  ])('%s.%s is %s', (module, action, kind) => {
    expect(classifyAction(module, action)).toBe(kind)
  })

  it('ignores case', () => {
    expect(classifyAction('flowcontrol', 'END')).toBe('end')
  })

  it('uses a configured list instead of the defaults', () => {
    const rules: DepthRules = {
      ...DEFAULT_DEPTH_RULES,
      ends: ['Custom.Close'],
      loops: ['Custom.Repeat*'],
    }
    expect(classifyAction('Custom', 'Close', rules)).toBe('end')
    expect(classifyAction('Custom', 'RepeatUntil', rules)).toBe('loop')
    expect(classifyAction('FlowControl', 'End', rules)).toBe(null)
  })
})

describe('computeDepths', () => {
  it('matches the hand-worked depths of the synthetic nested fixture', () => {
    const run = loadRun(NESTED_FIXTURE)
    expect(run.rows).toHaveLength(NESTED_DEPTHS.length)
    expect(computeDepths(run.rows)).toEqual(NESTED_DEPTHS)
  })

  it('gives every pass of a loop the same depths', () => {
    const depths = computeDepths([
      r('main', 1, 'Loops.Foreach'),
      r('main', 2, 'Conditionals.If'),
      r('main', 3, 'Variables.Assign'),
      r('main', 4, 'FlowControl.End'),
      r('main', 5, 'FlowControl.End'),
      r('main', 1, 'Loops.Foreach'),
      r('main', 2, 'Conditionals.If'),
      r('main', 5, 'FlowControl.End'),
      r('main', 1, 'Loops.Foreach'),
      r('main', 2, 'Conditionals.If'),
      r('main', 3, 'Variables.Assign'),
      r('main', 4, 'FlowControl.End'),
      r('main', 5, 'FlowControl.End'),
    ])
    expect(depths).toEqual([0, 1, 2, 1, 0, 0, 1, 0, 0, 1, 2, 1, 0])
  })

  it('closes blocks skipped by Continue at the loop End that follows it', () => {
    // Real pattern: For each { Block { If (false) ... Continue ... } }, Block End never logged.
    const depths = computeDepths([
      r('s', 1, 'Conditionals.If'),
      r('s', 3, 'Loops.Foreach'),
      r('s', 4, 'FlowControl.Block'),
      r('s', 5, 'System.IfProcessAction'),
      r('s', 9, 'Loops.Continue'),
      r('s', 13, 'FlowControl.End'),
      r('s', 3, 'Loops.Foreach'),
      r('s', 4, 'FlowControl.Block'),
      r('s', 5, 'System.IfProcessAction'),
      r('s', 9, 'Loops.Continue'),
      r('s', 13, 'FlowControl.End'),
      r('s', 14, 'FlowControl.End'),
    ])
    expect(depths).toEqual([0, 1, 2, 3, 3, 1, 1, 2, 3, 3, 1, 0])
  })

  it('works out each subflow separately, so an unclosed block cannot leak', () => {
    const depths = computeDepths([
      r('main', 1, 'Conditionals.If'),
      r('main', 2, 'FlowControl.CallFunction'),
      r('Sub', 1, 'Variables.Assign'),
      r('main', 3, 'Variables.Assign'),
    ])
    expect(depths).toEqual([0, 1, 0, 1])
  })

  it('never goes below zero on an End without an opener', () => {
    expect(
      computeDepths([
        r('main', 1, 'FlowControl.End'),
        r('main', 2, 'FlowControl.End'),
        r('main', 3, 'Variables.Assign'),
      ]),
    ).toEqual([0, 0, 0])
  })

  it('is all zeros with an empty rule list', () => {
    const none: DepthRules = {
      loops: [],
      conditionals: [],
      blocks: [],
      middles: [],
      ends: [],
      loopExits: [],
      gotos: [],
    }
    expect(computeDepths(loadRun(NESTED_FIXTURE).rows, none).every((d) => d === 0)).toBe(true)
  })

  it('returns one depth per row and handles no rows', () => {
    expect(computeDepths([])).toEqual([])
  })
})
