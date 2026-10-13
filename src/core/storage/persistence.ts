// Storage-persist check and warning.
/* eslint-disable @typescript-eslint/no-unused-vars -- stubs; removed when implemented */

export const STORAGE_WARNING_DISMISSED = 'storageWarningDismissed'

/** The parts of `navigator.storage` the health check uses. */
export interface StorageLike {
  persisted?(): Promise<boolean>
  persist?(): Promise<boolean>
  estimate?(): Promise<{ usage?: number; quota?: number }>
}

export interface StorageHealth {
  indexedDb: boolean
  persisted: boolean | null
  usage: number | null
  quota: number | null
  warn: boolean
}

export function checkStorageHealth(
  _storage?: StorageLike,
  _probe?: () => Promise<unknown>,
): Promise<StorageHealth> {
  throw new Error('not implemented')
}

export function shouldShowStorageBanner(_health: StorageHealth, _dismissed: boolean): boolean {
  throw new Error('not implemented')
}
