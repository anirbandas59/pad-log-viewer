import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

const isBranch = (value: Json): value is Json[] | { [key: string]: Json } =>
  value !== null && typeof value === 'object'

function Leaf({ value }: { value: Json }) {
  if (typeof value === 'string') {
    return <span className="break-all whitespace-pre-wrap text-success">"{value}"</span>
  }
  return <span className="text-accent">{String(value)}</span>
}

/** One node; branches open to depth 2 by default. Values are rendered as text only. */
function Node({ name, value, depth }: { name: string; value: Json; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  if (!isBranch(value)) {
    return (
      <li role="treeitem" aria-selected={false} className="pl-5 font-mono text-xs">
        <span className="text-muted">{name}: </span>
        <Leaf value={value} />
      </li>
    )
  }
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value)
  const summary = Array.isArray(value) ? `[${value.length}]` : `{${entries.length}}`
  return (
    <li role="treeitem" aria-expanded={open} aria-selected={false} className="font-mono text-xs">
      <button
        type="button"
        aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
      >
        {open ? <ChevronDown aria-hidden size={14} /> : <ChevronRight aria-hidden size={14} />}
        <span className="text-muted">{name}</span>
        <span className="text-muted">{summary}</span>
      </button>
      {open && (
        <ul role="group" className="ml-2 border-l border-border pl-2">
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** A collapsible tree of a JSON cell; cells that are not JSON are shown as raw text. */
export function JsonTree({ label, raw }: { label: string; raw: string }) {
  if (!raw.trim()) return <p className="text-sm text-muted">Empty.</p>
  let value: Json
  try {
    value = JSON.parse(raw) as Json
  } catch {
    return (
      <pre className="overflow-auto rounded bg-bg p-2 font-mono text-xs break-all whitespace-pre-wrap">
        {raw}
      </pre>
    )
  }
  return (
    <ul role="tree" aria-label={label} className="overflow-auto rounded bg-bg p-2">
      <Node name={label} value={value} depth={0} />
    </ul>
  )
}
