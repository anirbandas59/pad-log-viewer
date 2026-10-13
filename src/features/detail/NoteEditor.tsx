import { Bookmark } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useStore } from '../../app/store.ts'
import type { RowMark } from '../../core/derive/annotations.ts'

/** Typing pauses this long before the note is saved; blur and leaving the row save at once. */
const SAVE_DELAY_MS = 400

type Status = '' | 'Saving…' | 'Saved' | 'Not saved'

/**
 * Bookmark toggle and note for one row, saved to history. Mount it with `key={logIndex}`:
 * a note still waiting to be saved is saved when the row changes or the drawer closes.
 */
export function NoteEditor({ logIndex, mark }: { logIndex: number; mark: RowMark }) {
  const setRowMark = useStore((s) => s.setRowMark)
  const [note, setNote] = useState(mark.note)
  const [status, setStatus] = useState<Status>('')
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const mounted = useRef(true)
  const id = useId()

  const save = (change: Partial<RowMark>) => {
    if (mounted.current) setStatus('Saving…')
    setRowMark(logIndex, change).then(
      () => mounted.current && setStatus('Saved'),
      () => mounted.current && setStatus('Not saved'),
    )
  }

  const flush = () => {
    window.clearTimeout(timer.current)
    if (pending.current === null) return
    const text = pending.current
    pending.current = null
    save({ note: text })
  }
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      flushRef.current()
    }
  }, [])

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={mark.bookmarked}
          onClick={() => save({ bookmarked: !mark.bookmarked })}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
            mark.bookmarked
              ? 'border-accent bg-accent/15'
              : 'border-border bg-surface hover:bg-raised'
          }`}
        >
          <Bookmark aria-hidden size={14} fill={mark.bookmarked ? 'currentColor' : 'none'} />
          Bookmark
        </button>
        <span
          data-testid="note-status"
          aria-live="polite"
          className={`text-xs ${status === 'Not saved' ? 'text-failure' : 'text-muted'}`}
        >
          {status}
        </span>
      </div>
      <label htmlFor={id} className="block text-sm font-semibold">
        Note
      </label>
      <textarea
        id={id}
        value={note}
        rows={3}
        placeholder="Why this row matters, what to check…"
        onChange={(e) => {
          setNote(e.target.value)
          pending.current = e.target.value
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(flush, SAVE_DELAY_MS)
        }}
        onBlur={flush}
        className="w-full resize-y rounded-md border border-border bg-bg p-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-accent"
      />
    </section>
  )
}
