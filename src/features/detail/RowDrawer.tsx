import { ChevronDown, ChevronUp, Copy, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { copyText } from '../../app/clipboard.ts'
import { useStore } from '../../app/store.ts'
import { rowStatusKind } from '../../core/derive/filter.ts'
import { stepSelection } from '../../core/derive/logNav.ts'
import { rowAsText } from '../../core/derive/rowText.ts'
import { formatDuration, formatOffset } from '../../core/model/format.ts'
import type { LogRow } from '../../core/model/types.ts'
import { RowStatus } from '../../components/index.ts'
import { JsonTree } from './JsonTree.tsx'
import { ParamTable } from './ParamTable.tsx'

const iconButton =
  'rounded-md p-2 text-muted hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent'

function isJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

function Payload({
  title,
  params,
  raw,
  showRaw,
  onCopy,
}: {
  title: string
  params: LogRow['inputs']
  raw: string
  showRaw: boolean
  onCopy: (text: string) => void
}) {
  // A cell that was not JSON has no parameters: show it as it was.
  const malformed = params.length === 0 && raw.trim() !== '' && !isJson(raw)
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {showRaw ? (
        <JsonTree label={title} raw={raw} />
      ) : malformed ? (
        <pre className="rounded bg-bg p-2 font-mono text-xs break-all whitespace-pre-wrap">
          {raw}
        </pre>
      ) : (
        <ParamTable params={params} onCopy={onCopy} />
      )}
    </section>
  )
}

/**
 * Details of the selected row: parameters, raw JSON and copy actions, with Previous / Next
 * stepping through the filtered rows. Full screen (below the app header) on phones, over the
 * table on tablets, and docked beside it from 1280 px.
 */
export function RowDrawer({ row, rows }: { row: LogRow; rows: readonly LogRow[] }) {
  const select = useStore((s) => s.selectRow)
  const setOpen = useStore((s) => s.setDrawerOpen)
  const [showRaw, setShowRaw] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => () => window.clearTimeout(timer.current), [])
  // A new row starts at the top of the panel.
  useEffect(() => {
    panel.current?.scrollTo?.({ top: 0 })
  }, [row.logIndex])

  const copy = async (text: string) => {
    const ok = await copyText(text)
    setToast(ok ? 'Copied' : 'Copy failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2000)
  }

  const prev = stepSelection(rows, row.logIndex, -1)
  const next = stepSelection(rows, row.logIndex, 1)

  return (
    <aside
      ref={panel}
      aria-label="Row details"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault()
          setOpen(false)
        }
      }}
      className="fixed inset-x-0 top-14 bottom-0 z-30 overflow-y-auto bg-surface p-4 shadow-xl md:right-0 md:left-auto md:w-[min(32rem,90vw)] md:border-l md:border-border xl:sticky xl:top-[4.5rem] xl:z-auto xl:max-h-[calc(100dvh-5.5rem)] xl:w-2/5 xl:shrink-0 xl:rounded-lg xl:border xl:shadow-none"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold break-words">
            <span className="font-mono text-muted">#{row.logIndex}</span> {row.actionDisplay}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <RowStatus kind={rowStatusKind(row)} label={row.status} />
            <span className="font-mono text-xs">{formatDuration(row.durationTicks)}</span>
            <span className="text-muted">{row.subflow}</span>
          </p>
        </div>
        <button
          type="button"
          aria-label="Previous row"
          title="Previous row"
          disabled={prev === null || prev === row.logIndex}
          onClick={() => select(prev)}
          className={iconButton}
        >
          <ChevronUp aria-hidden size={18} />
        </button>
        <button
          type="button"
          aria-label="Next row"
          title="Next row"
          disabled={next === null || next === row.logIndex}
          onClick={() => select(next)}
          className={iconButton}
        >
          <ChevronDown aria-hidden size={18} />
        </button>
        <button
          type="button"
          aria-label="Close details"
          title="Close (Esc)"
          onClick={() => setOpen(false)}
          className={iconButton}
        >
          <X aria-hidden size={18} />
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Time</dt>
        <dd className="font-mono text-xs break-all">
          {row.startIso || '?'} ({formatOffset(row.offsetTicks)})
        </dd>
        <dt className="text-muted">Action</dt>
        <dd className="font-mono text-xs break-all">
          {row.module}.{row.action} · index {row.actionIndex}
        </dd>
        {row.level && (
          <>
            <dt className="text-muted">Log level</dt>
            <dd>{row.level}</dd>
          </>
        )}
        {row.effect && (
          <>
            <dt className="text-muted">Effect</dt>
            <dd className="font-mono text-xs break-all">{row.effect}</dd>
          </>
        )}
      </dl>
      {row.message && (
        <p className="mt-3 rounded bg-bg p-2 font-mono text-sm break-words whitespace-pre-wrap">
          {row.message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={showRaw}
          onClick={() => setShowRaw(!showRaw)}
          className={`inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
            showRaw ? 'border-accent bg-accent/15' : 'border-border bg-surface hover:bg-raised'
          }`}
        >
          Raw JSON
        </button>
        <button
          type="button"
          onClick={() => void copy(rowAsText(row))}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Copy aria-hidden size={14} /> Copy row as text
        </button>
        <span role="status" className="self-center text-sm text-success">
          {toast}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <Payload
          title="Inputs"
          params={row.inputs}
          raw={row.inputsRaw}
          showRaw={showRaw}
          onCopy={(t) => void copy(t)}
        />
        <Payload
          title="Outputs"
          params={row.outputs}
          raw={row.outputsRaw}
          showRaw={showRaw}
          onCopy={(t) => void copy(t)}
        />
      </div>
    </aside>
  )
}
