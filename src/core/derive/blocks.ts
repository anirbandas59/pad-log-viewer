// If/Loop block nesting depth.
//
// PAD logs only executed actions, so a running +1/−1 count drifts: a false If jumps past
// its body and its End, Exit loop / Next loop skip the End of every block they leave, and
// Go to leaves blocks without an End. Action index is the source line inside the subflow,
// so depth is worked out from the subflow's source structure instead:
//   1. From the log order, collect evidence per subflow: which End closes which loop
//      (the loop opener follows its End on the next pass), which End follows an Exit
//      loop / Next loop (it is the loop's End), and the last line a false If can span
//      (the next executed line, minus one, when it skips ahead and is not Else/Case).
//      A Conditionals.If logs its evaluated Condition (True/False); when present it
//      decides, so a true If whose first body line is a comment is not taken as false.
//   2. Sweep the subflow's executed lines in source order with a stack of open blocks,
//      closing blocks at their End, at that bound, or at a forward Go to.
// A row's depth is the number of blocks open around its line, so every pass of a loop
// gets the same depth and an unclosed block cannot leak into another subflow.
import type { LogRow, Param } from '../model/types.ts'

export type ActionKind =
  'loop' | 'conditional' | 'block' | 'middle' | 'end' | 'loopExit' | 'goto' | null

/** `Module.Action` patterns (case-insensitive, `*` = any run of characters) per kind. */
export interface DepthRules {
  /** Openers that repeat: their End is logged on every pass. */
  loops: string[]
  /** Openers that may skip their body and End entirely. */
  conditionals: string[]
  /** Other openers (Block, Switch). */
  blocks: string[]
  /** Branches inside a block (Else, Case); shown at the opener's depth. */
  middles: string[]
  ends: string[]
  /** Exit loop / Next loop: jump to the loop's End, skipping inner Ends. */
  loopExits: string[]
  /** Go to: leaves every open block. */
  gotos: string[]
}

/** Action names seen in real PAD exports; to be confirmed on more logs before v1. */
export const DEFAULT_DEPTH_RULES: DepthRules = {
  loops: ['Loops.Loop', 'Loops.Foreach', 'Loops.LoopCondition'],
  conditionals: ['*.If*'],
  blocks: ['FlowControl.Block', 'Conditionals.Switch'],
  middles: [
    'Conditionals.Else',
    'Conditionals.ElseIf',
    'Conditionals.Case',
    'Conditionals.DefaultCase',
  ],
  ends: ['FlowControl.End'],
  loopExits: ['Loops.Break', 'Loops.Continue'],
  gotos: ['FlowControl.GoTo'],
}

// Checked in this order, so an exact rule wins over the broad `*.If*`.
const ORDER: [keyof DepthRules, Exclude<ActionKind, null>][] = [
  ['ends', 'end'],
  ['middles', 'middle'],
  ['loopExits', 'loopExit'],
  ['gotos', 'goto'],
  ['loops', 'loop'],
  ['blocks', 'block'],
  ['conditionals', 'conditional'],
]

type Compiled = { matchers: [RegExp, Exclude<ActionKind, null>][]; cache: Map<string, ActionKind> }
const compiled = new WeakMap<DepthRules, Compiled>()

function compile(rules: DepthRules): Compiled {
  let c = compiled.get(rules)
  if (!c) {
    const toRe = (p: string) =>
      new RegExp(
        '^' +
          p
            .split('*')
            .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*') +
          '$',
        'i',
      )
    c = {
      matchers: ORDER.flatMap(([list, kind]) => rules[list].map((p) => [toRe(p), kind] as const)),
      cache: new Map(),
    } as Compiled
    compiled.set(rules, c)
  }
  return c
}

export function classifyAction(
  module: string,
  action: string,
  rules: DepthRules = DEFAULT_DEPTH_RULES,
): ActionKind {
  const c = compile(rules)
  const key = `${module}.${action}`
  let kind = c.cache.get(key)
  if (kind === undefined) {
    kind = c.matchers.find(([re]) => re.test(key))?.[1] ?? null
    c.cache.set(key, kind)
  }
  return kind
}

type Row = Pick<LogRow, 'subflow' | 'actionIndex' | 'module' | 'action'> & {
  inputs?: readonly Param[]
}

/**
 * The evaluated condition a Conditionals.If logs as its input, if any. PAD logs it under
 * the JSON key `expression`; "Condition" is only its localizedName label, so match the key.
 */
function loggedCondition(row: Row): boolean | null {
  const value = row.inputs?.find((p) => p.key.toLowerCase() === 'expression')?.value.trim()
  if (value === undefined) return null
  if (/^true$/i.test(value)) return true
  if (/^false$/i.test(value)) return false
  return null
}

interface SubflowEvidence {
  /** Kind of each executed source line (first seen). */
  lines: Map<number, ActionKind>
  /** Loop End line → its loop opener line. */
  loopOfEnd: Map<number, number>
  /** Loop opener line → its End line. */
  endOfLoop: Map<number, number>
  /** End lines reached from Exit loop / Next loop. */
  exitEnds: Set<number>
  /** Conditional opener line → last line it can span. */
  bound: Map<number, number>
  /** Go to lines that jumped forward. */
  forwardGotos: Set<number>
}

function collectEvidence(rows: readonly Row[], kinds: ActionKind[]): Map<string, SubflowEvidence> {
  const bySubflow = new Map<string, SubflowEvidence>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    let ev = bySubflow.get(row.subflow)
    if (!ev) {
      ev = {
        lines: new Map(),
        loopOfEnd: new Map(),
        endOfLoop: new Map(),
        exitEnds: new Set(),
        bound: new Map(),
        forwardGotos: new Set(),
      }
      bySubflow.set(row.subflow, ev)
    }
    const line = row.actionIndex
    const kind = kinds[i]!
    if (!ev.lines.has(line)) ev.lines.set(line, kind)

    const next = rows[i + 1]
    if (!next || next.subflow !== row.subflow) continue
    const nextLine = next.actionIndex
    const nextKind = kinds[i + 1]!
    if (kind === 'end' && nextKind === 'loop' && nextLine < line) {
      ev.loopOfEnd.set(line, nextLine)
      ev.endOfLoop.set(nextLine, line)
    } else if (kind === 'loopExit' && nextKind === 'end') {
      ev.exitEnds.add(nextLine)
    } else if (
      kind === 'conditional' &&
      nextLine > line + 1 &&
      nextKind !== 'middle' &&
      loggedCondition(row) !== true
    ) {
      ev.bound.set(line, Math.max(ev.bound.get(line) ?? 0, nextLine - 1))
    } else if (kind === 'goto' && nextLine > line) {
      ev.forwardGotos.add(line)
    }
  }
  return bySubflow
}

interface Open {
  line: number
  kind: ActionKind
}

function depthByLine(ev: SubflowEvidence): Map<number, number> {
  const depth = new Map<number, number>()
  const stack: Open[] = []
  for (const line of [...ev.lines.keys()].sort((a, b) => a - b)) {
    // Close every block whose bound lies before this line (and the blocks inside it).
    const past = stack.findIndex((o) => (ev.bound.get(o.line) ?? Infinity) < line)
    if (past >= 0) stack.length = past

    const kind = ev.lines.get(line)!
    switch (kind) {
      case 'loop':
      case 'conditional':
      case 'block':
        depth.set(line, stack.length)
        stack.push({ line, kind })
        break
      case 'middle':
        depth.set(line, Math.max(0, stack.length - 1))
        break
      case 'end': {
        const loop = ev.loopOfEnd.get(line)
        const owner =
          loop !== undefined
            ? stack.findIndex((o) => o.line === loop)
            : ev.exitEnds.has(line)
              ? stack.findLastIndex((o) => o.kind === 'loop')
              : -1
        if (owner >= 0) stack.length = owner
        else if (stack.length > 0) {
          // A loop whose End is known elsewhere is not closed by an unrelated End.
          const top = stack.at(-1)!
          const known = ev.endOfLoop.get(top.line)
          if (known === undefined || known === line) stack.pop()
        }
        depth.set(line, stack.length)
        break
      }
      case 'goto':
        depth.set(line, stack.length)
        if (ev.forwardGotos.has(line)) stack.length = 0
        break
      default:
        depth.set(line, stack.length)
    }
  }
  return depth
}

/** Block nesting depth of each row (rows in Log index order); 0 is top level. */
export function computeDepths(
  rows: readonly Row[],
  rules: DepthRules = DEFAULT_DEPTH_RULES,
): number[] {
  const kinds = rows.map((r) => classifyAction(r.module, r.action, rules))
  const evidence = collectEvidence(rows, kinds)
  const depths = new Map<string, Map<number, number>>()
  for (const [subflow, ev] of evidence) depths.set(subflow, depthByLine(ev))
  return rows.map((r) => depths.get(r.subflow)?.get(r.actionIndex) ?? 0)
}
