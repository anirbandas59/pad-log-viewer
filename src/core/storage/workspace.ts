// Workspace bundle export/import.
import type { Annotation, OverallStatus, RunMeta } from '../model/types.ts'
import type { PadDb } from './db.ts'
import { listRuns } from './history.ts'

export const WORKSPACE_FORMAT = 'pad-log-viewer-workspace'
/** Bundle layout version; bump it, and keep reading older versions, when the layout changes. */
export const WORKSPACE_SCHEMA_VERSION = 1

export type WorkspaceAnnotation = Omit<Annotation, 'id' | 'runId'>

export interface WorkspaceRun {
  meta: RunMeta
  csv: string
  /** Without `id` and `runId`: ids are regenerated on import and the run id is the parent's. */
  annotations: WorkspaceAnnotation[]
}

export interface WorkspaceBundle {
  format: typeof WORKSPACE_FORMAT
  schemaVersion: number
  exportedAt: string
  runs: WorkspaceRun[]
}

export type ParseWorkspaceResult =
  { ok: true; bundle: WorkspaceBundle } | { ok: false; error: string }

export interface ImportPlan {
  /** Bundle runs not yet in history. */
  added: string[]
  /** Bundle runs whose id is already in history; the user decides whether to overwrite. */
  conflicts: string[]
}

export interface ImportResult {
  added: string[]
  replaced: string[]
  skipped: string[]
}

/** RunMeta fields held as BigInt in memory and as decimal strings in the JSON bundle. */
const TICK_FIELDS = ['runStart', 'runEnd', 'durationTicks'] as const
const OVERALL_STATUSES: readonly OverallStatus[] = ['Succeeded', 'Failed', 'Unknown']

function toWorkspaceAnnotation({ logIndex, kind, text, createdAt }: Annotation) {
  const annotation: WorkspaceAnnotation = { kind, text, createdAt }
  if (logIndex !== undefined) annotation.logIndex = logIndex
  return annotation
}

/** Every run in history with its raw CSV and annotations, newest import first. */
export async function exportWorkspace(db: PadDb, now: Date = new Date()): Promise<WorkspaceBundle> {
  const metas = await listRuns(db)
  const tx = db.transaction(['files', 'annotations'])
  const files = tx.objectStore('files')
  const byRun = tx.objectStore('annotations').index('runId')
  const runs = await Promise.all(
    metas.map(async (meta): Promise<WorkspaceRun> => {
      const [csv, annotations] = await Promise.all([files.get(meta.id), byRun.getAll(meta.id)])
      return {
        meta,
        csv: csv ?? '',
        annotations: annotations.sort((a, b) => a.id! - b.id!).map(toWorkspaceAnnotation),
      }
    }),
  )
  await tx.done
  return {
    format: WORKSPACE_FORMAT,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    runs,
  }
}

/** JSON text of a bundle; BigInt ticks become decimal strings so no precision is lost. */
export function serializeWorkspace(bundle: WorkspaceBundle): string {
  return JSON.stringify(bundle, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  )
}

/** `pad-log-viewer-<yyyy-mm-dd>.padworkspace.json`, by the user's local date. */
export function workspaceFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `pad-log-viewer-${date}.padworkspace.json`
}

class BundleError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(obj: Record<string, unknown>, key: string, where: string, nonEmpty = false): string {
  const value = obj[key]
  if (typeof value !== 'string' || (nonEmpty && value === ''))
    throw new BundleError(`${where}: "${key}" must be ${nonEmpty ? 'a non-empty' : 'a'} string.`)
  return value
}

function int(obj: Record<string, unknown>, key: string, where: string): number {
  const value = obj[key]
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new BundleError(`${where}: "${key}" must be a whole number.`)
  return value as number
}

function ticks(obj: Record<string, unknown>, key: string, where: string): bigint {
  const value = obj[key]
  if (typeof value !== 'string' || !/^-?\d+$/.test(value))
    throw new BundleError(`${where}: "${key}" must be a whole number of ticks.`)
  return BigInt(value)
}

function readMeta(value: unknown, where: string): RunMeta {
  if (!isRecord(value)) throw new BundleError(`${where}: "meta" is missing.`)
  const exportedAt = value.exportedAt
  if (exportedAt !== null && typeof exportedAt !== 'string')
    throw new BundleError(`${where}: "exportedAt" must be a string or null.`)
  const overallStatus = value.overallStatus
  if (!OVERALL_STATUSES.includes(overallStatus as OverallStatus))
    throw new BundleError(`${where}: unknown overall status.`)
  const tags = value.tags
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string'))
    throw new BundleError(`${where}: "tags" must be a list of strings.`)
  const [runStart, runEnd, durationTicks] = TICK_FIELDS.map((k) => ticks(value, k, where)) as [
    bigint,
    bigint,
    bigint,
  ]
  // Copied field by field, so nothing outside RunMeta reaches the database.
  return {
    id: str(value, 'id', where, true),
    flowName: str(value, 'flowName', where),
    fileName: str(value, 'fileName', where),
    exportedAt,
    runStart,
    runEnd,
    durationTicks,
    rowCount: int(value, 'rowCount', where),
    subflowCount: int(value, 'subflowCount', where),
    failureCount: int(value, 'failureCount', where),
    overallStatus: overallStatus as OverallStatus,
    importedAt: str(value, 'importedAt', where),
    tags: [...(tags as string[])],
    displayName: str(value, 'displayName', where),
  }
}

function readAnnotation(value: unknown, where: string): WorkspaceAnnotation {
  if (!isRecord(value)) throw new BundleError(`${where}: an annotation is not an object.`)
  const kind = value.kind
  if (kind !== 'bookmark' && kind !== 'note')
    throw new BundleError(`${where}: unknown annotation kind.`)
  const annotation: WorkspaceAnnotation = {
    kind,
    text: str(value, 'text', where),
    createdAt: str(value, 'createdAt', where),
  }
  if (value.logIndex !== undefined) annotation.logIndex = int(value, 'logIndex', where)
  return annotation
}

function readRun(value: unknown, where: string): WorkspaceRun {
  if (!isRecord(value)) throw new BundleError(`${where}: not an object.`)
  const annotations = value.annotations
  if (!Array.isArray(annotations)) throw new BundleError(`${where}: "annotations" must be a list.`)
  return {
    meta: readMeta(value.meta, where),
    csv: str(value, 'csv', where),
    annotations: annotations.map((a) => readAnnotation(a, where)),
  }
}

/**
 * Reads and validates a workspace file. The file comes from outside the app, so every field is
 * checked and copied; unknown fields are dropped. Bundles from a newer app version are refused
 * rather than half-read.
 */
export function parseWorkspace(text: string): ParseWorkspaceResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This is not a workspace file: it is not valid JSON.' }
  }
  if (!isRecord(data) || data.format !== WORKSPACE_FORMAT)
    return { ok: false, error: 'This is not a workspace file exported by PAD Log Viewer.' }
  const version = data.schemaVersion
  if (!Number.isSafeInteger(version) || (version as number) < 1)
    return { ok: false, error: 'The workspace file has no valid schema version.' }
  if ((version as number) > WORKSPACE_SCHEMA_VERSION)
    return {
      ok: false,
      error: `The workspace file was made by a newer version of PAD Log Viewer (schema ${String(version)}); update the app to import it.`,
    }
  if (!Array.isArray(data.runs)) return { ok: false, error: 'The workspace file has no run list.' }
  try {
    const runs = data.runs.map((run, i) => readRun(run, `Run ${i + 1}`))
    const seen = new Set<string>()
    for (const run of runs) {
      if (seen.has(run.meta.id))
        throw new BundleError(`Run ${run.meta.id} appears more than once in the workspace file.`)
      seen.add(run.meta.id)
    }
    return {
      ok: true,
      bundle: {
        format: WORKSPACE_FORMAT,
        schemaVersion: version as number,
        exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
        runs,
      },
    }
  } catch (error) {
    if (error instanceof BundleError) return { ok: false, error: error.message }
    throw error
  }
}

/** Which bundle runs are new and which are already in history (matched by run GUID). */
export async function planImport(db: PadDb, bundle: WorkspaceBundle): Promise<ImportPlan> {
  const tx = db.transaction('runs')
  const keys = await Promise.all(bundle.runs.map((run) => tx.store.getKey(run.meta.id)))
  await tx.done
  const plan: ImportPlan = { added: [], conflicts: [] }
  bundle.runs.forEach((run, i) => {
    ;(keys[i] === undefined ? plan.added : plan.conflicts).push(run.meta.id)
  })
  return plan
}

/**
 * Merges a bundle into history by run GUID, in one transaction: new runs are added with their
 * CSV and annotations; a run already in history is replaced (meta, CSV and annotations) only
 * when its id is in `overwrite`, and otherwise left as it is. Local runs not in the bundle stay.
 */
export async function importWorkspace(
  db: PadDb,
  bundle: WorkspaceBundle,
  { overwrite = new Set<string>() }: { overwrite?: ReadonlySet<string> } = {},
): Promise<ImportResult> {
  const result: ImportResult = { added: [], replaced: [], skipped: [] }
  const tx = db.transaction(['runs', 'files', 'annotations'], 'readwrite')
  const runs = tx.objectStore('runs')
  const files = tx.objectStore('files')
  const annotations = tx.objectStore('annotations')
  for (const run of bundle.runs) {
    const id = run.meta.id
    const exists = (await runs.getKey(id)) !== undefined
    if (exists && !overwrite.has(id)) {
      result.skipped.push(id)
      continue
    }
    if (exists) {
      const keys = await annotations.index('runId').getAllKeys(id)
      await Promise.all(keys.map((key) => annotations.delete(key)))
    }
    await Promise.all([
      runs.put(run.meta),
      files.put(run.csv, id),
      ...run.annotations.map((a) => annotations.add({ ...a, runId: id } as Annotation)),
    ])
    ;(exists ? result.replaced : result.added).push(id)
  }
  await tx.done
  return result
}
