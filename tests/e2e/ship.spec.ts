// M8: the shipped single-file HTML. Acceptance: it opens from disk in Chromium and works end
// to end; it makes zero network requests; it is at most 1.5 MB.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { FAILED, cards, drop, fixture } from './helpers.ts'

const DIST = resolve('dist')
const HTML = resolve(DIST, 'pad-log-viewer.html')
const FILE_URL = pathToFileURL(HTML).href
const VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version

/**
 * Every request the page starts, except those its CSP stopped before they were sent
 * (Chromium reports those as failed with "csp"), and every CSP violation and console error.
 */
async function watch(page: Page) {
  const started: string[] = []
  const blocked: string[] = []
  const errors: string[] = []
  page.on('request', (r) => started.push(r.url()))
  page.on('requestfailed', (r) => {
    if (r.failure()?.errorText === 'csp') blocked.push(r.url())
  })
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    const seen: string[] = ((window as unknown as { __csp: string[] }).__csp = [])
    document.addEventListener('securitypolicyviolation', (e) =>
      seen.push(`${e.effectiveDirective} ${e.blockedURI}`),
    )
    if (navigator.storage) {
      navigator.storage.persisted = async () => false
      navigator.storage.persist = async () => false
    }
  })
  const violations = () =>
    page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? [])
  const requests = () => {
    const left = [...blocked]
    return started.filter((url) => {
      const i = left.indexOf(url)
      if (i < 0) return true
      left.splice(i, 1)
      return false
    })
  }
  return { requests, blocked, errors, violations }
}

/** Only the page itself, and data:/blob: URLs it made in memory. */
const offline = (url: string) =>
  url === FILE_URL || url.startsWith('data:') || url.startsWith('blob:')

test.describe('the built file', () => {
  test('is one self-contained HTML file within the 1.5 MB budget', () => {
    expect(readdirSync(DIST)).toEqual(['pad-log-viewer.html'])
    expect(statSync(HTML).size).toBeLessThanOrEqual(1.5 * 1024 * 1024)
    const html = readFileSync(HTML, 'utf8')
    expect(html).toMatch(
      /<meta http-equiv="Content-Security-Policy" content="[^"]*connect-src 'none'/,
    )
  })

  test('opens from disk and works end to end with zero network requests', async ({ page }) => {
    const seen = await watch(page)
    await page.goto(FILE_URL)
    await expect(page.getByRole('heading', { name: 'PAD Log Viewer' })).toBeVisible()
    await expect(page.getByTestId('app-version')).toHaveText(`v${VERSION}`)

    // Drop → overview → first failure → log → filter → drawer → note → export.
    await drop(page, [fixture(FAILED)])
    await expect(cards(page)).toHaveCount(1)
    await cards(page).getByRole('button', { name: 'Invoice_Processing_v2', exact: true }).click()
    await expect(page.getByTestId('first-failure')).toContainText('#12')
    await page.getByTestId('first-failure').getByRole('button', { name: 'Jump to row' }).click()
    const log = page.getByTestId('log-table')
    await expect(log.locator('[data-log-index="12"]')).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'Errors only' }).click()
    await expect(page.getByTestId('row-count')).toHaveText('2 of 17 rows')
    await log.locator('[data-log-index="17"]').click()
    const drawer = page.getByRole('complementary', { name: 'Row details' })
    await expect(drawer).toContainText('#17')
    await drawer.getByRole('textbox', { name: 'Note' }).fill('checked from file://')
    await expect(drawer.getByTestId('note-status')).toHaveText('Saved')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export filtered CSV' }).click()
    expect((await download).suggestedFilename()).toMatch(/-filtered-\d{8}T\d{6}Z\.csv$/)
    await page.getByRole('tab', { name: 'Variables' }).click()
    await expect(page.getByTestId('variable-list')).toBeVisible()
    await page.getByRole('tab', { name: 'Errors' }).click()
    await expect(page.getByTestId('failure')).toHaveCount(2)

    // History and the note survive a reload of the file.
    await page.reload()
    await expect(cards(page)).toHaveCount(1)
    await cards(page).getByRole('button', { name: 'Invoice_Processing_v2', exact: true }).click()
    await page.getByRole('tab', { name: 'Execution log' }).click()
    await expect(log.locator('[data-log-index="17"] [data-mark="note"]')).toBeVisible()

    expect(seen.requests().filter((u) => !offline(u))).toEqual([])
    expect(await seen.violations()).toEqual([])
    expect(seen.errors).toEqual([])
  })

  test('blocks any attempt to reach the network', async ({ page }) => {
    const seen = await watch(page)
    await page.goto(FILE_URL)
    await expect(page.getByRole('heading', { name: 'PAD Log Viewer' })).toBeVisible()
    const outcome = await page.evaluate(async () => {
      const tries: Record<string, string> = {}
      try {
        await fetch('https://example.com/')
        tries.fetch = 'sent'
      } catch {
        tries.fetch = 'blocked'
      }
      const img = new Image()
      tries.image = await new Promise<string>((done) => {
        img.onload = () => done('loaded')
        img.onerror = () => done('blocked')
        img.src = 'https://example.com/pixel.png'
      })
      return tries
    })
    expect(outcome).toEqual({ fetch: 'blocked', image: 'blocked' })
    // The image request was started, and stopped by the CSP before it was sent.
    expect(seen.blocked).toEqual(['https://example.com/pixel.png'])
    expect(seen.requests().filter((u) => !offline(u))).toEqual([])
    expect((await seen.violations()).map((v) => v.split(' ')[0])).toEqual([
      'connect-src',
      'img-src',
    ])
  })
})
