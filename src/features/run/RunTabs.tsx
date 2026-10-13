import { useRef, type KeyboardEvent } from 'react'
import { useStore } from '../../app/store.ts'
import { TABS } from './tabs.ts'

/** Tab list with arrow-key navigation (WAI-ARIA tabs pattern, automatic activation). */
export function RunTabs() {
  const tab = useStore((s) => s.runTab)
  const setTab = useStore((s) => s.setRunTab)
  const list = useRef<HTMLDivElement>(null)

  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab)
    const next =
      e.key === 'ArrowRight'
        ? (i + 1) % TABS.length
        : e.key === 'ArrowLeft'
          ? (i - 1 + TABS.length) % TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? TABS.length - 1
              : -1
    if (next < 0) return
    e.preventDefault()
    setTab(TABS[next]!.id)
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div
      ref={list}
      role="tablist"
      aria-label="Run views"
      onKeyDown={onKey}
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4"
    >
      {TABS.map((t) => {
        const selected = t.id === tab
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
              selected ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
