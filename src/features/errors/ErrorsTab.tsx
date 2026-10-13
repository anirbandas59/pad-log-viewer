import { CircleCheck } from 'lucide-react'
import { useMemo } from 'react'
import { useStore } from '../../app/store.ts'
import { RowStatus } from '../../components/index.ts'
import { errorContexts } from '../../core/derive/errors.ts'
import { rowStatusKind } from '../../core/derive/filter.ts'
import type { DerivedRun } from '../../core/derive/deriveRun.ts'
import { formatDuration, formatOffset } from '../../core/model/format.ts'
import type { LogRow } from '../../core/model/types.ts'

function RowLine({ row, testId }: { row: LogRow; testId?: string }) {
  return (
    <li
      data-testid={testId}
      className="flex min-w-0 items-baseline gap-2 text-sm text-muted"
      style={{ paddingLeft: `${Math.min(row.depth, 6) * 0.75}rem` }}
    >
      <span className="w-12 shrink-0 font-mono text-xs">#{row.logIndex}</span>
      <span className="min-w-0 flex-1 truncate" title={row.actionDisplay}>
        {row.actionDisplay}
        {row.effect && <span className="font-mono text-xs"> · {row.effect}</span>}
      </span>
      <span className="shrink-0 text-xs">
        <RowStatus kind={rowStatusKind(row)} label={row.status} />
      </span>
    </li>
  )
}

/** Why did it fail? Each failed row with the 3 rows before it, and its full message. */
export function ErrorsTab({ run }: { run: DerivedRun }) {
  const jump = useStore((s) => s.jumpToRow)
  const contexts = useMemo(() => errorContexts(run.rows), [run.rows])

  if (contexts.length === 0) {
    return (
      <p
        data-testid="no-failures"
        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <CircleCheck aria-hidden size={20} className="shrink-0 text-success" />
        No failures in this run.
      </p>
    )
  }
  return (
    <ol className="space-y-4">
      {contexts.map(({ failure, before }) => (
        <li key={failure.logIndex}>
          <article
            data-testid="failure"
            aria-labelledby={`failure-${failure.logIndex}`}
            className="min-w-0 space-y-3 rounded-lg border border-failure/50 bg-surface p-4"
          >
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 id={`failure-${failure.logIndex}`} className="min-w-0 font-semibold break-words">
                <span className="font-mono text-muted">#{failure.logIndex}</span>{' '}
                {failure.actionDisplay}
              </h3>
              <RowStatus kind="Failed" label={failure.status} />
              <span className="text-sm text-muted">
                {failure.subflow} · at {formatOffset(failure.offsetTicks)} ·{' '}
                {formatDuration(failure.durationTicks)}
              </span>
            </header>
            {before.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted">Rows before it</h4>
                <ol className="space-y-1 border-l border-border pl-2">
                  {before.map((row) => (
                    <RowLine key={row.logIndex} row={row} testId="context-row" />
                  ))}
                </ol>
              </div>
            )}
            {failure.message ? (
              <p className="rounded bg-bg p-3 font-mono text-sm break-words whitespace-pre-wrap">
                {failure.message}
              </p>
            ) : (
              <p className="text-sm text-muted">No log message.</p>
            )}
            <button
              type="button"
              onClick={() => jump(failure.logIndex)}
              className="inline-flex min-h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-on-accent hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Jump to row
            </button>
          </article>
        </li>
      ))}
    </ol>
  )
}
