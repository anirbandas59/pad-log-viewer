// If/Loop block nesting depth.
import type { LogRow } from '../model/types.ts'

export type ActionKind =
  'loop' | 'conditional' | 'block' | 'middle' | 'end' | 'loopExit' | 'goto' | null

/** `Module.Action` patterns (case-insensitive, `*` = any run of characters) per kind. */
export interface DepthRules {
  loops: string[]
  conditionals: string[]
  blocks: string[]
  middles: string[]
  ends: string[]
  loopExits: string[]
  gotos: string[]
}

export const DEFAULT_DEPTH_RULES: DepthRules = {
  loops: [],
  conditionals: [],
  blocks: [],
  middles: [],
  ends: [],
  loopExits: [],
  gotos: [],
}

export function classifyAction(module: string, action: string, rules?: DepthRules): ActionKind {
  void module
  void action
  void rules
  throw new Error('not implemented')
}

export function computeDepths(
  rows: readonly Pick<LogRow, 'subflow' | 'actionIndex' | 'module' | 'action'>[],
  rules?: DepthRules,
): number[] {
  void rows
  void rules
  throw new Error('not implemented')
}
