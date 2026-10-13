import { Copy } from 'lucide-react'
import { useState } from 'react'
import type { Param } from '../../core/model/types.ts'

/** Values longer than this collapse behind "Show more". */
const COLLAPSE_AT = 200

function Value({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = value.length > COLLAPSE_AT
  return (
    <div className="min-w-0">
      <p className="font-mono text-xs break-all whitespace-pre-wrap">
        {long && !expanded ? `${value.slice(0, COLLAPSE_AT)}…` : value}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

/** Parameter · Variable · Value, one row per parameter. Values are rendered as text only. */
export function ParamTable({
  params,
  onCopy,
}: {
  params: readonly Param[]
  onCopy: (text: string) => void
}) {
  if (params.length === 0) return <p className="text-sm text-muted">None.</p>
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {params.map((p) => (
        <li key={p.key} data-testid="param" className="space-y-1 p-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium break-words">{p.label}</span>
            {p.variable && (
              <span className="rounded bg-raised px-1.5 font-mono text-xs break-all">
                {p.variable}
              </span>
            )}
            {p.truncated && (
              <span className="rounded border border-warning/50 bg-warning/10 px-1.5 text-xs text-warning">
                truncated by PAD
              </span>
            )}
            <button
              type="button"
              aria-label={`Copy value of ${p.label}`}
              title="Copy value"
              onClick={() => onCopy(p.value)}
              className="ml-auto rounded p-1 text-muted hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Copy aria-hidden size={14} />
            </button>
          </div>
          <Value value={p.value} />
        </li>
      ))}
    </ul>
  )
}
