// Save, list and delete runs.
/* eslint-disable @typescript-eslint/no-unused-vars -- M7 stubs until the implementation lands */
import type { Annotation, RunMeta } from '../model/types.ts'
import type { PadDb } from './db.ts'

export interface StoredRun {
  meta: RunMeta
  csv: string
}

/** The user-editable parts of a run. */
export type RunPatch = Partial<Pick<RunMeta, 'displayName' | 'tags'>>

/** Stores a run's meta and raw CSV together, replacing any run with the same id. */
export async function saveRun(db: PadDb, meta: RunMeta, csv: string): Promise<void> {
  const tx = db.transaction(['runs', 'files'], 'readwrite')
  await Promise.all([
    tx.objectStore('runs').put(meta),
    tx.objectStore('files').put(csv, meta.id),
    tx.done,
  ])
}

export async function getRun(db: PadDb, id: string): Promise<StoredRun | undefined> {
  const tx = db.transaction(['runs', 'files'])
  const [meta, csv] = await Promise.all([
    tx.objectStore('runs').get(id),
    tx.objectStore('files').get(id),
  ])
  await tx.done
  return meta && csv !== undefined ? { meta, csv } : undefined
}

/** Every stored run, newest import first. */
export async function listRuns(db: PadDb): Promise<RunMeta[]> {
  return (await db.getAllFromIndex('runs', 'importedAt')).reverse()
}

/** Applies a user edit; returns the updated meta, or undefined when the run is not stored. */
export async function updateRun(
  db: PadDb,
  id: string,
  patch: RunPatch,
): Promise<RunMeta | undefined> {
  const tx = db.transaction('runs', 'readwrite')
  const meta = await tx.store.get(id)
  if (!meta) {
    await tx.done
    return undefined
  }
  const updated: RunMeta = { ...meta, ...patch, id }
  await tx.store.put(updated)
  await tx.done
  return updated
}

/** Removes a run with its raw CSV and annotations. */
export async function deleteRun(db: PadDb, id: string): Promise<void> {
  const tx = db.transaction(['runs', 'files', 'annotations'], 'readwrite')
  const annotations = tx.objectStore('annotations')
  const keys = await annotations.index('runId').getAllKeys(id)
  await Promise.all([
    tx.objectStore('runs').delete(id),
    tx.objectStore('files').delete(id),
    ...keys.map((key) => annotations.delete(key)),
    tx.done,
  ])
}

/** Removes every run, file and annotation; settings are kept. */
export async function clearHistory(db: PadDb): Promise<void> {
  const tx = db.transaction(['runs', 'files', 'annotations'], 'readwrite')
  await Promise.all([
    tx.objectStore('runs').clear(),
    tx.objectStore('files').clear(),
    tx.objectStore('annotations').clear(),
    tx.done,
  ])
}

/** Stores an annotation and returns its generated id. */
export async function addAnnotation(
  db: PadDb,
  annotation: Omit<Annotation, 'id'>,
): Promise<number> {
  return db.add('annotations', annotation as Annotation)
}

/** A run's annotations, in the order they were added. */
export async function listAnnotations(db: PadDb, runId: string): Promise<Annotation[]> {
  const list = await db.getAllFromIndex('annotations', 'runId', runId)
  return list.sort((a, b) => a.id! - b.id!)
}

export async function replaceRowAnnotations(
  _db: PadDb,
  _runId: string,
  _logIndex: number,
  _next: readonly Pick<Annotation, 'kind' | 'text' | 'createdAt'>[],
): Promise<Annotation[]> {
  throw new Error('not implemented')
}
