// Zustand store: history, notices, prompts, storage state and the active screen.
import { create } from 'zustand'
import { getSetting, openDb, setSetting, type PadDb } from '../core/storage/db.ts'
import { clearHistory, deleteRun, listRuns, saveRun } from '../core/storage/history.ts'
import {
  STORAGE_WARNING_DISMISSED,
  checkStorageHealth,
  type StorageHealth,
} from '../core/storage/persistence.ts'
import {
  exportWorkspace,
  importWorkspace,
  parseWorkspace,
  planImport,
  serializeWorkspace,
  workspaceFileName,
  type WorkspaceBundle,
} from '../core/storage/workspace.ts'
import { classifyDrop, ingestCsv, type IngestedRun } from '../core/model/ingest.ts'
import type { HistoryQuery } from '../core/model/historyView.ts'
import type { RunMeta } from '../core/model/types.ts'
import { downloadText } from './download.ts'
import { THEME_SETTING, applyTheme, isTheme, readStoredTheme, type Theme } from './theme.ts'

export interface Notice {
  id: number
  kind: 'error' | 'info'
  /** The file the notice is about, if any. */
  fileName?: string
  message: string
}

/** A dropped export of a run already in history: the user may replace the stored copy. */
export interface ReplacePrompt {
  run: IngestedRun
  existing: RunMeta
}

export type Confirm = { kind: 'delete'; run: RunMeta } | { kind: 'clear' }

export interface ImportPrompt {
  bundle: WorkspaceBundle
  conflicts: RunMeta[]
}

interface State {
  ready: boolean
  db: PadDb | null
  /** Runs held in memory only, when IndexedDB is unavailable: id → CSV. */
  memory: Map<string, string>
  runs: RunMeta[]
  health: StorageHealth | null
  bannerDismissed: boolean
  notices: Notice[]
  replacePrompts: ReplacePrompt[]
  importPrompt: ImportPrompt | null
  confirm: Confirm | null
  query: HistoryQuery
  theme: Theme
  activeRunId: string | null

  init(): Promise<void>
  addFiles(files: readonly File[]): Promise<void>
  resolveReplace(replace: boolean): Promise<void>
  dismissNotice(id: number): void
  askDelete(run: RunMeta): void
  askClear(): void
  resolveConfirm(confirmed: boolean): Promise<void>
  exportAll(): Promise<void>
  importFile(file: File): Promise<void>
  resolveImport(overwrite: boolean): Promise<void>
  dismissBanner(): Promise<void>
  setQuery(query: Partial<HistoryQuery>): void
  toggleTheme(): void
  openRun(id: string | null): void
}

let nextNoticeId = 1

export const useStore = create<State>()((set, get) => {
  const notify = (notice: Omit<Notice, 'id'>) =>
    set((s) => ({ notices: [...s.notices, { ...notice, id: nextNoticeId++ }] }))

  const refresh = async () => {
    const { db, memory, runs } = get()
    if (db) set({ runs: await listRuns(db) })
    else set({ runs: runs.filter((r) => memory.has(r.id)) })
  }

  const store = async (run: IngestedRun) => {
    const { db, memory } = get()
    if (db) {
      await saveRun(db, run.meta, run.csv)
    } else {
      memory.set(run.meta.id, run.csv)
      set((s) => ({
        runs: [run.meta, ...s.runs.filter((r) => r.id !== run.meta.id)],
      }))
    }
  }

  const failed = (what: string, err: unknown) =>
    notify({
      kind: 'error',
      message: `${what}: ${err instanceof Error ? err.message : String(err)}`,
    })

  return {
    ready: false,
    db: null,
    memory: new Map(),
    runs: [],
    health: null,
    bannerDismissed: false,
    notices: [],
    replacePrompts: [],
    importPrompt: null,
    confirm: null,
    query: { text: '', status: 'all', tag: null, sort: 'imported' },
    theme: readStoredTheme(),
    activeRunId: null,

    async init() {
      if (get().ready) return
      applyTheme(get().theme)
      let db: PadDb | null = null
      try {
        db = await openDb()
      } catch {
        db = null
      }
      const health = await checkStorageHealth(undefined, async () => {
        if (!db) throw new Error('IndexedDB unavailable')
      })
      let bannerDismissed = false
      if (db) {
        bannerDismissed = (await getSetting<boolean>(db, STORAGE_WARNING_DISMISSED)) === true
        const saved = await getSetting(db, THEME_SETTING)
        if (isTheme(saved) && saved !== get().theme) {
          applyTheme(saved)
          set({ theme: saved })
        }
      }
      set({ db, health, bannerDismissed, ready: true })
      await refresh()
    },

    async addFiles(files) {
      for (const file of files) {
        let text: string
        try {
          text = await file.text()
        } catch (err) {
          failed(`Could not read ${file.name}`, err)
          continue
        }
        const result = ingestCsv(file.name, text, new Date())
        if (!result.ok) {
          notify({ kind: 'error', fileName: result.fileName, message: result.error })
          continue
        }
        const pending = get().replacePrompts.map((p) => p.run.meta)
        const decision = classifyDrop(result.run.meta, [...get().runs, ...pending])
        if (decision.kind === 'sameExport') {
          notify({
            kind: 'info',
            fileName: file.name,
            message: `${file.name} is already in history as “${decision.existing!.displayName}”.`,
          })
        } else if (decision.kind === 'reExport') {
          set((s) => ({
            replacePrompts: [
              ...s.replacePrompts,
              { run: result.run, existing: decision.existing! },
            ],
          }))
        } else {
          try {
            await store(result.run)
          } catch (err) {
            failed(`Could not save ${file.name}`, err)
          }
        }
      }
      await refresh()
    },

    async resolveReplace(replace) {
      const [prompt, ...rest] = get().replacePrompts
      set({ replacePrompts: rest })
      if (!prompt || !replace) return
      // The user's own edits to the stored run survive a replace.
      const meta: RunMeta = {
        ...prompt.run.meta,
        displayName: prompt.existing.displayName,
        tags: prompt.existing.tags,
      }
      try {
        await store({ ...prompt.run, meta })
      } catch (err) {
        failed(`Could not replace ${meta.fileName}`, err)
      }
      await refresh()
    },

    dismissNotice(id) {
      set((s) => ({ notices: s.notices.filter((n) => n.id !== id) }))
    },

    askDelete(run) {
      set({ confirm: { kind: 'delete', run } })
    },

    askClear() {
      set({ confirm: { kind: 'clear' } })
    },

    async resolveConfirm(confirmed) {
      const { confirm, db, memory } = get()
      set({ confirm: null })
      if (!confirm || !confirmed) return
      try {
        if (confirm.kind === 'delete') {
          if (db) await deleteRun(db, confirm.run.id)
          memory.delete(confirm.run.id)
          if (get().activeRunId === confirm.run.id) set({ activeRunId: null })
          if (!db) set((s) => ({ runs: s.runs.filter((r) => r.id !== confirm.run.id) }))
        } else {
          if (db) await clearHistory(db)
          memory.clear()
          set({ activeRunId: null })
          if (!db) set({ runs: [] })
        }
      } catch (err) {
        failed('Could not delete', err)
      }
      await refresh()
    },

    async exportAll() {
      const { db } = get()
      if (!db) return
      try {
        const now = new Date()
        const { bundle, missing } = await exportWorkspace(db, now)
        downloadText(workspaceFileName(now), serializeWorkspace(bundle))
        if (missing.length > 0) {
          notify({
            kind: 'error',
            message: `${missing.length} run(s) were left out of the export because their CSV is missing from this browser.`,
          })
        }
      } catch (err) {
        failed('Export failed', err)
      }
    },

    async importFile(file) {
      const { db, runs } = get()
      if (!db) return
      try {
        const parsed = parseWorkspace(await file.text())
        if (!parsed.ok) {
          notify({ kind: 'error', fileName: file.name, message: parsed.error })
          return
        }
        const plan = await planImport(db, parsed.bundle)
        if (plan.conflicts.length > 0) {
          set({
            importPrompt: {
              bundle: parsed.bundle,
              conflicts: runs.filter((r) => plan.conflicts.includes(r.id)),
            },
          })
          return
        }
        const result = await importWorkspace(db, parsed.bundle)
        notify({
          kind: 'info',
          fileName: file.name,
          message: `Imported ${result.added.length} run(s).`,
        })
      } catch (err) {
        failed(`Could not import ${file.name}`, err)
      }
      await refresh()
    },

    async resolveImport(overwrite) {
      const { importPrompt, db } = get()
      set({ importPrompt: null })
      if (!importPrompt || !db) return
      try {
        const result = await importWorkspace(db, importPrompt.bundle, {
          overwrite: new Set(overwrite ? importPrompt.conflicts.map((r) => r.id) : []),
        })
        notify({
          kind: 'info',
          message: `Imported ${result.added.length} run(s), replaced ${result.replaced.length}, kept ${result.skipped.length} unchanged.`,
        })
      } catch (err) {
        failed('Import failed', err)
      }
      await refresh()
    },

    async dismissBanner() {
      set({ bannerDismissed: true })
      const { db } = get()
      if (db) await setSetting(db, STORAGE_WARNING_DISMISSED, true)
    },

    setQuery(query) {
      set((s) => ({ query: { ...s.query, ...query } }))
    },

    toggleTheme() {
      const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(theme)
      set({ theme })
      const { db } = get()
      if (db) void setSetting(db, THEME_SETTING, theme)
    },

    openRun(id) {
      set({ activeRunId: id })
    },
  }
})
