// M4: Home screen. Acceptance: multi-file drop; dark/light; works at 375, 768 and 1366 px.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const APP = '/pad-log-viewer.html'
const REAL =
  'tests/fixtures/real/Invoice_Extraction_Main-00000000-0000-4000-8000-000000000007-20261012T113808Z.csv'
const FAILED =
  'tests/fixtures/synthetic/Invoice_Processing_v2_6f1c2a9e-3b4d-4c5e-9f60-7a8b9c0d1e2f_20261001T091500Z.csv'
const NESTED =
  'tests/fixtures/synthetic/Nested_Blocks-1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d-20261013T090000Z.csv'

type DropFile = { name: string; text: string }
const fixture = (path: string, name = basename(path)): DropFile => ({
  name,
  text: readFileSync(path, 'utf8'),
})
const MISSING_COLUMNS: DropFile = {
  name: 'missing-columns.csv',
  text: 'Start time,End time\r\n1,2\r\n',
}
const NOT_CSV: DropFile = { name: 'notes.txt', text: 'hello' }

/** Drops files on the drop zone the way a browser does: dragenter, dragover, drop. */
async function drop(page: Page, files: DropFile[]) {
  await page.getByTestId('drop-zone').evaluate((zone, list) => {
    const dt = new DataTransfer()
    for (const f of list) dt.items.add(new File([f.text], f.name, { type: 'text/csv' }))
    for (const type of ['dragenter', 'dragover', 'drop']) {
      zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
    }
  }, files)
}

const cards = (page: Page) => page.getByTestId('history').getByRole('listitem')

/** Reads one value from the app's IndexedDB settings store. */
function storedSetting(page: Page, key: string) {
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

test.beforeEach(async ({ page }) => {
  // Headless Chromium may grant persistence; make the storage warning deterministic.
  await page.addInitScript(() => {
    if (navigator.storage) {
      navigator.storage.persisted = async () => false
      navigator.storage.persist = async () => false
    }
  })
  await page.goto(APP)
  await expect(page.getByRole('heading', { name: 'PAD Log Viewer' })).toBeVisible()
})

test.describe('multi-file drop', () => {
  test('adds every valid run and shows one error card per invalid file', async ({ page }) => {
    await drop(page, [fixture(REAL), fixture(FAILED), MISSING_COLUMNS, NOT_CSV])
    await expect(cards(page)).toHaveCount(2)
    await expect(cards(page).filter({ hasText: 'Invoice_Extraction_Main' })).toContainText(
      'Succeeded',
    )
    await expect(cards(page).filter({ hasText: 'Invoice_Processing_v2' })).toContainText('Failed')
    const errors = page.getByTestId('error-card')
    await expect(errors).toHaveCount(2)
    await expect(errors.filter({ hasText: 'missing-columns.csv' })).toContainText(
      'Missing required columns',
    )
    await expect(errors.filter({ hasText: 'notes.txt' })).toContainText(/csv/i)
    await errors.first().getByRole('button', { name: 'Dismiss' }).click()
    await expect(errors).toHaveCount(1)
  })

  test('Browse files accepts several files at once', async ({ page }) => {
    await page.getByTestId('file-input').setInputFiles(
      [REAL, NESTED].map((p) => ({
        name: basename(p),
        mimeType: 'text/csv',
        buffer: readFileSync(p),
      })),
    )
    await expect(cards(page)).toHaveCount(2)
  })

  test('keeps history across a reload', async ({ page }) => {
    await drop(page, [fixture(REAL), fixture(NESTED)])
    await expect(cards(page)).toHaveCount(2)
    await page.reload()
    await expect(cards(page)).toHaveCount(2)
  })

  test('does not duplicate the same export, and offers Replace for a re-export', async ({
    page,
  }) => {
    await drop(page, [fixture(FAILED)])
    await expect(cards(page)).toHaveCount(1)
    await drop(page, [fixture(FAILED)])
    await expect(page.getByTestId('notice')).toContainText('already in history')
    await expect(cards(page)).toHaveCount(1)

    const reExport = fixture(
      FAILED,
      basename(FAILED).replace('20261001T091500Z', '20261013T100000Z'),
    )
    await drop(page, [reExport])
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('already in history')
    await expect(dialog.getByRole('button', { name: /keep both/i })).toHaveCount(0)
    // The same re-export again while its question is open: not "already in history".
    await drop(page, [reExport])
    await expect(page.getByTestId('notice').last()).toContainText('waiting for your answer')
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Replace' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first()).toContainText('20261013T100000Z')
  })

  test('deletes a run after confirmation', async ({ page }) => {
    await drop(page, [fixture(REAL), fixture(NESTED)])
    await expect(cards(page)).toHaveCount(2)
    await cards(page)
      .filter({ hasText: 'Nested_Blocks' })
      .getByRole('button', { name: /delete/i })
      .click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(cards(page)).toHaveCount(1)
    await page.reload()
    await expect(cards(page)).toHaveCount(1)
  })
})

test.describe('history controls', () => {
  test('searches and filters by status', async ({ page }) => {
    await drop(page, [fixture(REAL), fixture(FAILED), fixture(NESTED)])
    await expect(cards(page)).toHaveCount(3)
    await page.getByRole('searchbox', { name: /search/i }).fill('nested')
    await expect(cards(page)).toHaveCount(1)
    await page.getByRole('searchbox', { name: /search/i }).fill('')
    await page.getByRole('combobox', { name: /status/i }).selectOption('Failed')
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first()).toContainText('Invoice_Processing_v2')
  })
})

test.describe('theme', () => {
  const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

  test('starts dark, switches to light, and remembers it', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const dark = await bg(page)
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await bg(page)).not.toBe(dark)
    expect(await bg(page)).toBe('rgb(255, 255, 255)')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('restores the theme from the settings store when localStorage was cleared', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    // The settings-store copy is written in the background; wait for it before clearing.
    await expect.poll(() => storedSetting(page, 'theme')).toBe('light')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
})

test.describe('storage', () => {
  test('warns that history may be cleared, until "Don\'t show again"', async ({ page }) => {
    const banner = page.getByTestId('storage-banner')
    await expect(banner).toContainText('History is kept in this browser only and may be cleared')
    // Nothing to export yet.
    await expect(banner.getByRole('button', { name: 'Export now' })).toBeDisabled()
    await drop(page, [fixture(NESTED)])
    await expect(banner.getByRole('button', { name: 'Export now' })).toBeEnabled()
    await banner.getByRole('button', { name: "Don't show again" }).click()
    await expect(banner).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'PAD Log Viewer' })).toBeVisible()
    await expect(banner).toHaveCount(0)
  })

  test('exports the workspace and imports it into an empty browser', async ({ page, browser }) => {
    await drop(page, [fixture(REAL), fixture(FAILED)])
    await expect(cards(page)).toHaveCount(2)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export workspace' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(
      /^pad-log-viewer-\d{4}-\d{2}-\d{2}\.padworkspace\.json$/,
    )
    const path = await file.path()

    const other = await browser.newPage()
    await other.goto(APP)
    await expect(cards(other)).toHaveCount(0)
    await other.getByTestId('workspace-input').setInputFiles(path)
    await expect(cards(other)).toHaveCount(2)
    await other.close()
  })

  test('still loads history when the settings store cannot be written (e.g. storage full)', async ({
    page,
  }) => {
    await drop(page, [fixture(NESTED)])
    await expect(cards(page)).toHaveCount(1)
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await page.addInitScript(() => {
      const put = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
        if (this.name === 'settings') throw new DOMException('Quota exceeded', 'QuotaExceededError')
        return put.apply(this, args)
      }
    })
    await page.reload()
    await expect(cards(page)).toHaveCount(1)
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await drop(page, [fixture(REAL)])
    await expect(cards(page)).toHaveCount(2)
  })

  test('works as a session-only viewer when IndexedDB is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true })
    })
    await page.reload()
    await expect(page.getByTestId('storage-banner')).toContainText(/session/i)
    await drop(page, [fixture(NESTED)])
    await expect(cards(page)).toHaveCount(1)
  })
})

for (const width of [375, 768, 1366]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 812 : 900 } })

    test('fits the width without horizontal scrolling', async ({ page }) => {
      await drop(page, [fixture(REAL), fixture(FAILED), MISSING_COLUMNS])
      await expect(cards(page)).toHaveCount(2)
      for (const theme of ['dark', 'light'] as const) {
        if (theme === 'light')
          await page.getByRole('button', { name: 'Switch to light theme' }).click()
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBe(0)
        await expect(page.getByTestId('drop-zone')).toBeInViewport()
        await expect(page.getByRole('button', { name: 'Browse files' })).toBeVisible()
        await expect(cards(page).first()).toBeVisible()
        if (process.env.SCREENSHOTS) {
          await page.screenshot({
            path: `docs/screenshots/m4/home-${width}-${theme}.png`,
            fullPage: true,
          })
        }
      }
    })
  })
}
