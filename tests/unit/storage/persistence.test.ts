import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkStorageHealth,
  shouldShowStorageBanner,
  type StorageHealth,
  type StorageLike,
} from '../../../src/core/storage/persistence.ts'
import { freshIndexedDb } from '../helpers/storage.ts'

beforeEach(freshIndexedDb)

const ok = () => Promise.resolve()
const estimate = () => Promise.resolve({ usage: 2048, quota: 1_000_000 })

describe('checkStorageHealth', () => {
  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    const storage: StorageLike = { persisted: () => Promise.resolve(true), persist, estimate }
    expect(await checkStorageHealth(storage, ok)).toEqual({
      indexedDb: true,
      persisted: true,
      usage: 2048,
      quota: 1_000_000,
      warn: false,
    })
    expect(persist).not.toHaveBeenCalled()
  })

  it('requests persistence and does not warn when it is granted', async () => {
    const storage: StorageLike = {
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(true),
      estimate,
    }
    const health = await checkStorageHealth(storage, ok)
    expect(health.persisted).toBe(true)
    expect(health.warn).toBe(false)
  })

  it('warns when persistence is denied', async () => {
    const storage: StorageLike = {
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(false),
      estimate,
    }
    const health = await checkStorageHealth(storage, ok)
    expect(health).toMatchObject({ indexedDb: true, persisted: false, warn: true })
  })

  it('warns, with unknown persistence and usage, when the Storage API is missing', async () => {
    expect(await checkStorageHealth(undefined, ok)).toEqual({
      indexedDb: true,
      persisted: null,
      usage: null,
      quota: null,
      warn: true,
    })
  })

  it('treats a throwing persist() or estimate() as unknown instead of failing', async () => {
    const storage: StorageLike = {
      persisted: () => Promise.reject(new Error('SecurityError')),
      persist: () => Promise.reject(new Error('SecurityError')),
      estimate: () => Promise.reject(new Error('SecurityError')),
    }
    const health = await checkStorageHealth(storage, ok)
    expect(health).toEqual({
      indexedDb: true,
      persisted: null,
      usage: null,
      quota: null,
      warn: true,
    })
  })

  it('reports IndexedDB unavailable and warns when the probe fails', async () => {
    const storage: StorageLike = { persisted: () => Promise.resolve(true), estimate }
    const health = await checkStorageHealth(storage, () =>
      Promise.reject(new Error('InvalidStateError')),
    )
    expect(health.indexedDb).toBe(false)
    expect(health.warn).toBe(true)
  })

  it('probes the real database by default', async () => {
    const storage: StorageLike = { persisted: () => Promise.resolve(true), estimate }
    expect((await checkStorageHealth(storage)).indexedDb).toBe(true)
  })
})

describe('shouldShowStorageBanner', () => {
  const healthy: StorageHealth = {
    indexedDb: true,
    persisted: true,
    usage: 0,
    quota: 1,
    warn: false,
  }
  const risky: StorageHealth = { ...healthy, persisted: false, warn: true }

  it('shows the banner for a warning the user has not dismissed', () => {
    expect(shouldShowStorageBanner(risky, false)).toBe(true)
  })

  it('hides it after "Don\'t show again"', () => {
    expect(shouldShowStorageBanner(risky, true)).toBe(false)
  })

  it('hides it when storage is healthy', () => {
    expect(shouldShowStorageBanner(healthy, false)).toBe(false)
  })
})
