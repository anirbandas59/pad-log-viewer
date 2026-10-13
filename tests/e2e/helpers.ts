// Shared helpers for the browser tests.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { expect, type Page } from '@playwright/test'

export const APP = '/pad-log-viewer.html'
export const REAL =
  'tests/fixtures/real/Invoice_Extraction_Main-00000000-0000-4000-8000-000000000007-20261012T113808Z.csv'
export const FAILED =
  'tests/fixtures/synthetic/Invoice_Processing_v2_6f1c2a9e-3b4d-4c5e-9f60-7a8b9c0d1e2f_20261001T091500Z.csv'
export const NESTED =
  'tests/fixtures/synthetic/Nested_Blocks-1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d-20261013T090000Z.csv'

export type DropFile = { name: string; text: string }
export const fixture = (path: string, name = basename(path)): DropFile => ({
  name,
  text: readFileSync(path, 'utf8'),
})
export const MISSING_COLUMNS: DropFile = {
  name: 'missing-columns.csv',
  text: 'Start time,End time\r\n1,2\r\n',
}
export const NOT_CSV: DropFile = { name: 'notes.txt', text: 'hello' }

/** Drops files on the drop zone the way a browser does: dragenter, dragover, drop. */
export async function drop(page: Page, files: DropFile[]) {
  await page.getByTestId('drop-zone').evaluate((zone, list) => {
    const dt = new DataTransfer()
    for (const f of list) dt.items.add(new File([f.text], f.name, { type: 'text/csv' }))
    for (const type of ['dragenter', 'dragover', 'drop']) {
      zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
    }
  }, files)
}

export const cards = (page: Page) => page.getByTestId('history').getByRole('listitem')

/** Reads one value from the app's IndexedDB settings store. */
export function storedSetting(page: Page, key: string) {
  return page.evaluate(
    (k) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('pad-log-viewer')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('settings').objectStore('settings').get(k)
          get.onsuccess = () => {
            resolve(get.result)
            open.result.close()
          }
          get.onerror = () => reject(get.error)
        }
      }),
    key,
  )
}

/**
 * Opens the app with a deterministic storage warning (headless Chromium may grant
 * persistence) and waits for the shell.
 */
export async function openApp(page: Page) {
  await page.addInitScript(() => {
    if (navigator.storage) {
      navigator.storage.persisted = async () => false
      navigator.storage.persist = async () => false
    }
  })
  await page.goto(APP)
  await expect(page.getByRole('heading', { name: 'PAD Log Viewer' })).toBeVisible()
}

/** Opens a run from its history card (the card title button). */
export async function openRun(page: Page, name: string) {
  await cards(page).filter({ hasText: name }).getByRole('button', { name, exact: true }).click()
  await expect(page.getByTestId('run-header')).toContainText(name)
}
