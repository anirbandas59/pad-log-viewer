// Storage-persist check and warning.
import { openDb } from './db.ts'

/** Settings key for the banner's "Don't show again". */
export const STORAGE_WARNING_DISMISSED = 'storageWarningDismissed'

/** The parts of `navigator.storage` the health check uses. */
export interface StorageLike {
  persisted?(): Promise<boolean>
  persist?(): Promise<boolean>
  estimate?(): Promise<{ usage?: number; quota?: number }>
}

export interface StorageHealth {
  /** The app database could be opened. */
  indexedDb: boolean
  /** The browser promised not to evict this origin's storage; null when it could not be asked. */
  persisted: boolean | null
  /** Bytes used and available, from `navigator.storage.estimate()`; null when unknown. */
  usage: number | null
  quota: number | null
  /** History may be lost: no IndexedDB, or persistence not granted. */
  warn: boolean
}

async function attempt<T>(fn: (() => Promise<T>) | undefined): Promise<T | null> {
  if (!fn) return null
  try {
    return await fn()
  } catch {
    return null
  }
}

async function openAndClose(): Promise<void> {
  ;(await openDb()).close()
}

/**
 * Launch-time storage check: opens the database, asks for persistent storage when it is not
 * already granted, and reads the usage estimate. Never throws; anything the browser refuses
 * or lacks is reported as unknown and counts as a reason to warn.
 */
export async function checkStorageHealth(
  storage: StorageLike | undefined = globalThis.navigator?.storage,
  probe: () => Promise<unknown> = openAndClose,
): Promise<StorageHealth> {
  const indexedDb = await probe().then(
    () => true,
    () => false,
  )
  const already = await attempt(storage?.persisted?.bind(storage))
  const persisted = already === true ? true : await attempt(storage?.persist?.bind(storage))
  const estimate = await attempt(storage?.estimate?.bind(storage))
  return {
    indexedDb,
    persisted,
    usage: estimate?.usage ?? null,
    quota: estimate?.quota ?? null,
    warn: !indexedDb || persisted !== true,
  }
}

export function shouldShowStorageBanner(health: StorageHealth, dismissed: boolean): boolean {
  return health.warn && !dismissed
}
