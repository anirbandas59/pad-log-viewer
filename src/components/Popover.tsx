import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * A button that opens a small panel below it. The panel closes on Escape (focus returns to
 * the button) and on a click outside.
 */
export function Popover({
  label,
  icon,
  align = 'left',
  children,
}: {
  label: ReactNode
  icon?: ReactNode
  align?: 'left' | 'right'
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault()
          e.stopPropagation()
          setOpen(false)
          button.current?.focus()
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
          open ? 'border-accent bg-raised' : 'border-border bg-surface hover:bg-raised'
        }`}
      >
        {icon}
        {label}
      </button>
      {open && (
        <div
          id={id}
          className={`absolute top-full z-20 mt-1 max-h-80 w-64 max-w-[calc(100vw-2rem)] overflow-auto rounded-md border border-border bg-surface p-2 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** One labelled checkbox row for a Popover list. */
export function CheckRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-1 text-sm hover:bg-raised has-disabled:cursor-default has-disabled:opacity-60">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      {hint && (
        <span aria-hidden className="shrink-0 font-mono text-xs text-muted">
          {hint}
        </span>
      )}
    </label>
  )
}
