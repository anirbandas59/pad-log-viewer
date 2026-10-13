// M5: Run view. Acceptance: the first-failure card jumps to its row; subflow time bars sum to
// the run duration.
import { expect, test, type Page } from '@playwright/test'
import { syntheticRun, toCsv } from '../unit/helpers/syntheticLog.ts'
import { FAILED, REAL, cards, drop, fixture, openApp } from './helpers.ts'

// 3,000 rows; failures at Log index 997, 1994 and 2991 (every 997th row).
const LONG = {
  name: 'Long_Run-2b3c4d5e-6f70-4a8b-9c0d-1e2f3a4b5c6d-20261013T100000Z.csv',
  text: toCsv(syntheticRun(3000)),
}

async function openRun(page: Page, name: string) {
  await cards(page).filter({ hasText: name }).getByRole('button', { name, exact: true }).click()
  await expect(page.getByTestId('run-header')).toContainText(name)
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name })

test.beforeEach(async ({ page }) => {
  await openApp(page)
})

test.describe('run header and tabs', () => {
  test('opens a run from history on the Overview tab with its key numbers', async ({ page }) => {
    await drop(page, [fixture(FAILED)])
    await openRun(page, 'Invoice_Processing_v2')
    const header = page.getByTestId('run-header')
    await expect(header).toContainText('Failed')
    await expect(header.getByTestId('stat-actions')).toHaveText(/17/)
    await expect(header.getByTestId('stat-subflows')).toHaveText(/4/)
    await expect(header.getByTestId('stat-failures')).toHaveText(/2/)
    await expect(header.getByTestId('stat-warnings')).toHaveText(/1/)
    await expect(tab(page, 'Overview')).toHaveAttribute('aria-selected', 'true')
    for (const name of ['Execution log', 'Variables', 'Errors']) {
      await expect(tab(page, name)).toHaveAttribute('aria-selected', 'false')
    }
    await page.getByRole('button', { name: 'Back to history' }).click()
    await expect(cards(page)).toHaveCount(1)
  })

  test('renames the run, and the name is kept in history', async ({ page }) => {
    await drop(page, [fixture(FAILED)])
    await openRun(page, 'Invoice_Processing_v2')
    await page.getByRole('button', { name: 'Rename' }).click()
    const input = page.getByRole('textbox', { name: 'Display name' })
    await input.fill('Month-end invoices')
    await input.press('Enter')
    await expect(page.getByTestId('run-header')).toContainText('Month-end invoices')
    await page.getByRole('button', { name: 'Back to history' }).click()
    await expect(cards(page).first()).toContainText('Month-end invoices')
    await page.reload()
    await expect(cards(page).first()).toContainText('Month-end invoices')
  })
})

test.describe('overview', () => {
  test('first-failure card jumps to its row in the execution log', async ({ page }) => {
    await drop(page, [LONG])
    await openRun(page, 'Long_Run')
    const card = page.getByTestId('first-failure')
    await expect(card).toContainText('#997')
    await expect(card).toContainText('Action failed at step 997')
    await card.getByRole('button', { name: 'Jump to row' }).click()
    await expect(tab(page, 'Execution log')).toHaveAttribute('aria-selected', 'true')
    const row = page.getByTestId('log-list').locator('[data-log-index="997"]')
    await expect(row).toHaveAttribute('aria-selected', 'true')
    await expect(row).toBeInViewport()
    await expect(page.getByTestId('log-list').locator('[aria-selected="true"]')).toHaveCount(1)
  })

  test('says so when the run has no failures', async ({ page }) => {
    await drop(page, [fixture(REAL)])
    await openRun(page, 'Invoice_Extraction_Main')
    await expect(page.getByTestId('first-failure')).toContainText('No failures')
    await expect(page.getByRole('button', { name: 'Jump to row' })).toHaveCount(0)
  })

  test('subflow time bars sum to the run duration', async ({ page }) => {
    await drop(page, [fixture(REAL)])
    await openRun(page, 'Invoice_Extraction_Main')
    const bars = page.getByTestId('subflow-bars')
    const total = BigInt((await bars.getAttribute('data-duration-ticks'))!)
    const ticks = await bars
      .locator('[data-ticks]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-ticks')!))
    expect(ticks.length).toBeGreaterThan(10)
    expect(ticks.reduce((a, t) => a + BigInt(t), 0n)).toBe(total)
    const widths = await bars
      .locator('[data-ticks] [data-bar]')
      .evaluateAll((els) => els.map((e) => parseFloat((e as HTMLElement).style.width)))
    // The exact check is the tick sum above; CSS keeps percentages to ~6 significant digits.
    expect(widths.reduce((a, w) => a + w, 0)).toBeCloseTo(100, 2)
  })

  test('lists the 10 slowest actions, and each jumps to its row', async ({ page }) => {
    await drop(page, [fixture(FAILED)])
    await openRun(page, 'Invoice_Processing_v2')
    const slowest = page.getByTestId('slowest').getByRole('listitem')
    await expect(slowest).toHaveCount(10)
    await expect(slowest.first()).toContainText('Invoke web service')
    await slowest.first().getByRole('button').click()
    await expect(tab(page, 'Execution log')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('log-list').locator('[data-log-index="12"]')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('shows the status breakdown and module usage', async ({ page }) => {
    await drop(page, [fixture(FAILED)])
    await openRun(page, 'Invoice_Processing_v2')
    await expect(page.getByTestId('status-breakdown')).toContainText(/Succeeded\s*15/)
    await expect(page.getByTestId('status-breakdown')).toContainText(/Failed\s*2/)
    await expect(page.getByTestId('module-usage')).toContainText(/Flow control\s*5/)
    await expect(page.getByTestId('module-usage')).toContainText(/Excel\s*3/)
  })
})

for (const width of [375, 768, 1366]) {
  test.describe(`run view at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 812 : 900 } })

    test('fits the width without horizontal scrolling', async ({ page }) => {
      await drop(page, [fixture(FAILED)])
      await openRun(page, 'Invoice_Processing_v2')
      for (const theme of ['dark', 'light'] as const) {
        if (theme === 'light') {
          await page.getByRole('button', { name: 'Switch to light theme' }).click()
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBe(0)
        await expect(page.getByTestId('run-header')).toBeVisible()
        await expect(page.getByTestId('first-failure')).toBeVisible()
        if (process.env.SCREENSHOTS) {
          await page.screenshot({
            path: `docs/screenshots/m5/run-${width}-${theme}.png`,
            fullPage: true,
          })
        }
      }
    })
  })
}
