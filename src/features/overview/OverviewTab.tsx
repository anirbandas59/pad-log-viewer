import { CircleCheck, CircleX } from 'lucide-react'
import { useStore } from '../../app/store.ts'
import { formatDuration } from '../../core/model/format.ts'
import { facetEntries, subflowBars } from '../../core/derive/overview.ts'
import type { DerivedRun } from '../../core/derive/deriveRun.ts'

const card = 'min-w-0 rounded-lg border border-border bg-surface p-4'
const title = 'mb-3 text-base font-semibold'

function FirstFailureCard({ run }: { run: DerivedRun }) {
  const jump = useStore((s) => s.jumpToRow)
  const row = run.summary.firstFailure
  if (!row) {
    return (
      <section data-testid="first-failure" className={`${card} flex items-center gap-3`}>
        <CircleCheck aria-hidden size={20} className="shrink-0 text-success" />
        <p>No failures in this run.</p>
      </section>
    )
  }
  return (
    <section data-testid="first-failure" className={`${card} border-failure/50`}>
      <h3 className={`${title} flex items-center gap-2`}>
        <CircleX aria-hidden size={18} className="text-failure" /> First failure
      </h3>
      <p className="font-medium break-words">
        <span className="font-mono text-muted">#{row.logIndex}</span> {row.actionDisplay}
      </p>
      <p className="text-sm text-muted">
        {row.subflow} · at +{formatDuration(row.offsetTicks)} · {row.status || row.level}
      </p>
      {row.message && (
        <p className="mt-2 rounded bg-bg p-2 font-mono text-sm break-words whitespace-pre-wrap">
          {row.message}
        </p>
      )}
      <button
        type="button"
        onClick={() => jump(row.logIndex)}
        className="mt-3 inline-flex min-h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-on-accent hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Jump to row
      </button>
    </section>
  )
}

function SubflowTime({ run }: { run: DerivedRun }) {
  const bars = subflowBars(run.summary)
  return (
    <section className={card}>
      <h3 className={title}>Time per subflow</h3>
      <ul
        data-testid="subflow-bars"
        data-duration-ticks={run.summary.durationTicks.toString()}
        className="space-y-2"
      >
        {bars.map((b) => (
          <li key={b.subflow} data-ticks={b.ticks.toString()} className="space-y-1">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate" title={b.subflow}>
                {b.subflow}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {formatDuration(b.ticks)} · {(b.share * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-raised">
              <div
                data-bar
                className="h-full rounded"
                style={{ width: `${b.share * 100}%`, backgroundColor: `var(--subflow-${b.color})` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SlowestActions({ run }: { run: DerivedRun }) {
  const jump = useStore((s) => s.jumpToRow)
  return (
    <section className={card}>
      <h3 className={title}>Slowest actions</h3>
      <ol data-testid="slowest" className="space-y-1">
        {run.summary.slowest.map((row) => (
          <li key={row.logIndex}>
            <button
              type="button"
              onClick={() => jump(row.logIndex)}
              className="flex w-full items-baseline gap-2 rounded px-1 py-1 text-left text-sm hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="shrink-0 font-mono text-xs text-muted">#{row.logIndex}</span>
              <span className="min-w-0 flex-1 truncate">
                {row.actionDisplay} <span className="text-muted">· {row.subflow}</span>
              </span>
              <span className="shrink-0 font-mono text-xs">
                {formatDuration(row.durationTicks)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Breakdown({
  testId,
  heading,
  facet,
  limit,
  color = () => 'var(--color-accent)',
}: {
  testId: string
  heading: string
  facet: ReadonlyMap<string, number>
  limit?: number
  /** Bar colour for a value (CSS colour). */
  color?: (value: string) => string
}) {
  const entries = facetEntries(facet, limit)
  const max = Math.max(1, ...entries.map((e) => e.count))
  return (
    <section className={card}>
      <h3 className={title}>{heading}</h3>
      <ul data-testid={testId} className="space-y-1.5">
        {entries.map((e) => (
          <li
            key={e.value}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-sm"
          >
            <span className="truncate" title={e.value || '(none)'}>
              {e.value || '(none)'}
            </span>
            <span className="font-mono text-xs">{e.count.toLocaleString()}</span>
            <div className="col-span-2 h-1.5 overflow-hidden rounded bg-raised">
              <div
                className="h-full rounded opacity-80"
                style={{ width: `${(e.count / max) * 100}%`, backgroundColor: color(e.value) }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function statusColor(status: string): string {
  if (/^succeeded$/i.test(status)) return 'var(--color-success)'
  if (/fail/i.test(status)) return 'var(--color-failure)'
  return 'var(--color-unknown)'
}

/** Where did the time go, and what broke? */
export function OverviewTab({ run }: { run: DerivedRun }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <FirstFailureCard run={run} />
      </div>
      <SubflowTime run={run} />
      <SlowestActions run={run} />
      <Breakdown
        testId="status-breakdown"
        heading="Status"
        facet={run.summary.facets.status}
        color={statusColor}
      />
      <Breakdown
        testId="module-usage"
        heading="Modules"
        facet={run.summary.facets.module}
        limit={8}
      />
    </div>
  )
}
