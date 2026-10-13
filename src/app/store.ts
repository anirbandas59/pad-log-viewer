// Zustand store: history, notices, prompts, storage state and the active screen.
import { create } from 'zustand'
import { getSetting, openDb, setSetting, type PadDb } from '../core/storage/db.ts'
import {
  clearHistory,
  deleteRun,
  getRun,
  listAnnotations,
  listRuns,
  replaceRowAnnotations,
  saveRun,
  updateRun,
} from '../core/storage/history.ts'
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
import { classifyDrop, ingestCsv, mergeReplace, type IngestedRun } from '../core/model/ingest.ts'
import type { HistoryQuery } from '../core/model/historyView.ts'
import { deriveCsv, type DerivedRun } from '../core/derive/deriveRun.ts'
import type { Annotation, RunMeta } from '../core/model/types.ts'
import { nextRowAnnotations, rowMarks, type RowMark } from '../core/derive/annotations.ts'
import { readDensity, type Density } from '../core/derive/density.ts'
import { filteredFileName, rowsToCsv } from '../core/derive/exportCsv.ts'
import { filterRows } from '../core/derive/filter.ts'
import { EMPTY_FILTERS, type LogFilters } from '../core/derive/filter.ts'
import {
  defaultColumnVisibility,
  readColumnVisibility,
  type ColumnVisibility,
  type LogColumnId,
} from '../core/derive/columns.ts'
import { downloadText } from './download.ts'
import {
  THEME_SETTING,
  applyTheme,
  isTheme,
  readLocalTheme,
  readStoredTheme,
  saveLocalTheme,
  type Theme,
} from './theme.ts'

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

export type RunTab = 'overview' | 'log' | 'variables' | 'errors'

/** The open run, re-derived from its stored CSV. */
export type ActiveRun =
  | { id: string; status: 'loading' }
  | { id: string; status: 'ready'; derived: DerivedRun }
  | { id: string; status: 'error'; error: string }

export type Confirm = { kind: 'delete'; run: RunMeta } | { kind: 'clear' }

/** Settings-store key for the execution log's column visibility. */
export const LOG_COLUMNS_SETTING = 'logColumns'
/** Settings-store key for the execution log's row density. */
export const LOG_DENSITY_SETTING = 'logDensity'

export interface ImportPrompt {
  bundle: WorkspaceBundle
  conflicts: RunMeta[]
}

interface State {
  ready: boolean
  db: PadDb | null
  /** Runs held in memory only, when IndexedDB is unavailable: id → CSV. */
  memory: Map<string, string>
  /** Annotations held in memory only, when IndexedDB is unavailable: run id → list. */
  memoryAnnotations: Map<string, Annotation[]>
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
  activeRun: ActiveRun | null
  runTab: RunTab
  /** Log index of the row selected in the execution log. */
  selectedLogIndex: number | null
  /** Bumped by every jumpToRow, so a jump to the already selected row still scrolls. */
  jumpSeq: number
  /** The row drawer is open on the selected row. */
  drawerOpen: boolean
  logFilters: LogFilters
  logColumns: ColumnVisibility
  logDensity: Density
  /** The open run's bookmarks and notes. */
  annotations: Annotation[]

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
  setRunTab(tab: RunTab): void
  /** Opens the execution log with this row selected. */
  jumpToRow(logIndex: number): void
  /** Selects a row; `open` also opens (true) or closes (false) the drawer. */
  selectRow(logIndex: number | null, open?: boolean): void
  setDrawerOpen(open: boolean): void
  setLogFilters(filters: Partial<LogFilters>): void
  clearLogFilters(): void
  setColumnVisible(id: LogColumnId, visible: boolean): void
  setLogDensity(density: Density): void
  /** Sets a row's bookmark and/or note in the open run, and saves them. */
  setRowMark(logIndex: number, change: Partial<RowMark>): Promise<void>
  /** Downloads the open run's rows that pass the current filters as a PAD CSV. */
  exportFilteredCsv(): void
  renameRun(id: string, displayName: string): Promise<void>
}

/** Log indexes of the bookmarked rows. */
function bookmarkedIn(annotations: readonly Annotation[]): Set<number> {
  return new Set([...rowMarks(annotations)].filter(([, m]) => m.bookmarked).map(([i]) => i))
}

let nextNoticeId = 1
// Shared by every init() call: StrictMode runs effects twice in development.
let initializing: Promise<void> | null = null

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
    memoryAnnotations: new Map(),
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
    activeRun: null,
    runTab: 'overview',
    selectedLogIndex: null,
    jumpSeq: 0,
    drawerOpen: false,
    logFilters: EMPTY_FILTERS,
    logColumns: defaultColumnVisibility(),
    logDensity: 'comfortable',
    annotations: [],

    init() {
      initializing ??= (async () => {
        const startTheme = get().theme
        applyTheme(startTheme)
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
        let logColumns = get().logColumns
        let logDensity = get().logDensity
        if (db) {
          // Settings are best effort: a failed read or write (e.g. storage full) must not
          // stop history from loading.
          try {
            bannerDismissed = (await getSetting<boolean>(db, STORAGE_WARNING_DISMISSED)) === true
            logColumns = readColumnVisibility(await getSetting(db, LOG_COLUMNS_SETTING))
            logDensity = readDensity(await getSetting(db, LOG_DENSITY_SETTING))
            // localStorage is the authority; the stored copy fills in only when it is empty
            // and the user has not toggled the theme while the database was opening.
            const saved = await getSetting(db, THEME_SETTING)
            const theme = get().theme
            if (readLocalTheme() === null && theme === startTheme && isTheme(saved)) {
              applyTheme(saved)
              saveLocalTheme(saved)
              set({ theme: saved })
            } else if (saved !== theme) {
              await setSetting(db, THEME_SETTING, theme)
            }
          } catch {
            // Keep the defaults.
          }
        }
        set({ db, health, bannerDismissed, logColumns, logDensity, ready: true })
        await refresh()
      })()
      return initializing
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
        const { id, exportedAt } = result.run.meta
        if (
          get().replacePrompts.some(
            (p) => p.run.meta.id === id && p.run.meta.exportedAt === exportedAt,
          )
        ) {
          notify({
            kind: 'info',
            fileName: file.name,
            message: `${file.name} is already waiting for your answer on whether to replace the stored run.`,
          })
          continue
        }
        const decision = classifyDrop(result.run.meta, get().runs)
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
      const meta = mergeReplace(prompt.existing, prompt.run.meta)
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
          get().memoryAnnotations.delete(confirm.run.id)
          if (get().activeRunId === confirm.run.id) set({ activeRunId: null, activeRun: null })
          if (!db) set((s) => ({ runs: s.runs.filter((r) => r.id !== confirm.run.id) }))
        } else {
          if (db) await clearHistory(db)
          memory.clear()
          get().memoryAnnotations.clear()
          set({ activeRunId: null, activeRun: null })
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
      // Best effort: the banner stays hidden for this session even if this is not saved.
      if (db) await setSetting(db, STORAGE_WARNING_DISMISSED, true).catch(() => {})
    },

    setQuery(query) {
      set((s) => ({ query: { ...s.query, ...query } }))
    },

    toggleTheme() {
      const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(theme)
      saveLocalTheme(theme)
      set({ theme })
      const { db } = get()
      if (db) setSetting(db, THEME_SETTING, theme).catch(() => {})
    },

    openRun(id) {
      set({
        activeRunId: id,
        activeRun: id ? { id, status: 'loading' } : null,
        runTab: 'overview',
        selectedLogIndex: null,
        drawerOpen: false,
        logFilters: EMPTY_FILTERS,
        annotations: [],
      })
      if (!id) return
      void (async () => {
        let csv: string | undefined
        let annotations: Annotation[]
        const { db, memory, memoryAnnotations } = get()
        try {
          csv = db ? (await getRun(db, id))?.csv : memory.get(id)
        } catch {
          csv = undefined
        }
        try {
          annotations = db ? await listAnnotations(db, id) : (memoryAnnotations.get(id) ?? [])
        } catch {
          // The log still opens; its bookmarks and notes could not be read.
          annotations = []
        }
        if (get().activeRunId === id) set({ annotations })
        // Let the loading state paint before the synchronous parse and derive.
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (get().activeRunId !== id) return
        if (csv === undefined) {
          set({
            activeRun: { id, status: 'error', error: 'The stored log of this run is missing.' },
          })
          return
        }
        const result = deriveCsv(csv)
        if (get().activeRunId !== id) return
        set({
          activeRun: result.ok
            ? { id, status: 'ready', derived: result.run }
            : { id, status: 'error', error: result.error },
        })
      })()
    },

    setRunTab(tab) {
      set({ runTab: tab })
    },

    jumpToRow(logIndex) {
      // A row the current filters hide could not be shown: clear the filters first.
      const { activeRun, logFilters, annotations } = get()
      let filters = logFilters
      if (activeRun?.status === 'ready') {
        const row = activeRun.derived.rows.find((r) => r.logIndex === logIndex)
        const bookmarked = bookmarkedIn(annotations)
        if (row && filterRows([row], logFilters, bookmarked).length === 0) filters = EMPTY_FILTERS
      }
      set((s) => ({
        runTab: 'log',
        selectedLogIndex: logIndex,
        jumpSeq: s.jumpSeq + 1,
        logFilters: filters,
      }))
    },

    selectRow(logIndex, open) {
      set((s) => ({
        selectedLogIndex: logIndex,
        drawerOpen: logIndex !== null && (open ?? s.drawerOpen),
      }))
    },

    setDrawerOpen(open) {
      set((s) => ({ drawerOpen: open && s.selectedLogIndex !== null }))
    },

    setLogFilters(filters) {
      // Start of the filter's apply-to-render time; the log table ends the measure.
      performance.mark('pad:filter:start')
      set((s) => ({ logFilters: { ...s.logFilters, ...filters } }))
    },

    clearLogFilters() {
      performance.mark('pad:filter:start')
      set({ logFilters: EMPTY_FILTERS })
    },

    setLogDensity(logDensity) {
      set({ logDensity })
      const { db } = get()
      if (db) setSetting(db, LOG_DENSITY_SETTING, logDensity).catch(() => {})
    },

    async setRowMark(logIndex, change) {
      const runId = get().activeRunId
      if (!runId) return
      const current = get().annotations.filter((a) => a.logIndex === logIndex)
      const next = nextRowAnnotations(current, change, new Date().toISOString())
      const { db, memoryAnnotations } = get()
      try {
        let annotations: Annotation[]
        if (db) {
          annotations = await replaceRowAnnotations(db, runId, logIndex, next)
        } else {
          annotations = [
            ...get().annotations.filter((a) => a.logIndex !== logIndex),
            ...next.map((a) => ({ ...a, runId, logIndex })),
          ]
          memoryAnnotations.set(runId, annotations)
        }
        if (get().activeRunId === runId) set({ annotations })
      } catch (err) {
        failed('Could not save the bookmark or note', err)
        throw err
      }
    },

    exportFilteredCsv() {
      const { activeRun, logFilters, annotations, runs } = get()
      if (activeRun?.status !== 'ready') return
      const meta = runs.find((r) => r.id === activeRun.id)
      const bookmarked = bookmarkedIn(annotations)
      const rows = filterRows(activeRun.derived.rows, logFilters, bookmarked)
      downloadText(
        filteredFileName(meta?.flowName ?? 'run', new Date()),
        rowsToCsv(rows),
        'text/csv;charset=utf-8',
      )
    },

    setColumnVisible(id, visible) {
      const logColumns = readColumnVisibility({ ...get().logColumns, [id]: visible })
      set({ logColumns })
      const { db } = get()
      // Best effort: the choice holds for this session even if it is not saved.
      if (db) setSetting(db, LOG_COLUMNS_SETTING, logColumns).catch(() => {})
    },

    async renameRun(id, displayName) {
      const name = displayName.trim()
      const current = get().runs.find((r) => r.id === id)
      if (!name || !current || name === current.displayName) return
      const { db } = get()
      try {
        if (db) await updateRun(db, id, { displayName: name })
        set((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, displayName: name } : r)) }))
      } catch (err) {
        failed('Could not rename the run', err)
      }
    },
  }
})
