// M7: Variables tab, Errors tab, bookmarks and notes, export filtered CSV, density toggle.
// Acceptance: notes survive reload; the exported CSV re-imports cleanly.
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { param, row as csvRow, syntheticRun, toCsv } from '../unit/helpers/syntheticLog.ts'
import { FAILED, REAL, cards, drop, fixture, openApp, openRun, storedSetting } from './helpers.ts'

// 200 rows: Output "Result" writes var<i % 50> (so var7 at rows 7, 57, 107, 157) and
// "Count" writes `count` on every row.
const VARS = {
  name: 'Var_Run-5e6f7081-92a3-4b4c-8d5e-6f708192a3b4-20261013T130000Z.csv',
  text: toCsv(syntheticRun(200)),
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name })
const row = (page: Page, logIndex: number) =>
  page.getByTestId('log-table').locator(`[data-log-index="${logIndex}"]`)
const drawer = (page: Page) => page.getByRole('complementary', { name: 'Row details' })

async function openTab(
  page: Page,
  file: { name: string; text: string },
  run: string,
  name: string,
) {
  await drop(page, [file])
  await openRun(page, run)
  await tab(page, name).click()
}

test.beforeEach(async ({ page }) => {
  await openApp(page)
})

test.describe('bookmarks and notes', () => {
  test('a bookmark and a note survive a reload', async ({ page }) => {
    await openTab(page, fixture(FAILED), 'Invoice_Processing_v2', 'Execution log')
    await row(page, 12).click()
    const d = drawer(page)
    const bookmark = d.getByRole('button', { name: 'Bookmark' })
    await expect(bookmark).toHaveAttribute('aria-pressed', 'false')
    await bookmark.click()
    await expect(bookmark).toHaveAttribute('aria-pressed', 'true')
    await d
      .getByRole('textbox', { name: 'Note' })
      .fill('API timed out: ask infra about the gateway')
    await expect(d.getByTestId('note-status')).toHaveText('Saved')
    await expect(row(page, 12).locator('[data-mark="bookmark"]')).toBeVisible()
    await expect(row(page, 12).locator('[data-mark="note"]')).toBeVisible()

    await page.reload()
    await openRun(page, 'Invoice_Processing_v2')
    await tab(page, 'Execution log').click()
    await expect(row(page, 12).locator('[data-mark="bookmark"]')).toBeVisible()
    await page.getByRole('button', { name: 'Bookmarked' }).click()
    await expect(page.getByTestId('row-count')).toHaveText('1 of 17 rows')
    await row(page, 12).click()
    await expect(drawer(page).getByRole('button', { name: 'Bookmark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(drawer(page).getByRole('textbox', { name: 'Note' })).toHaveValue(
      'API timed out: ask infra about the gateway',
    )
  })

  test('a note typed just before moving to the next row is kept', async ({ page }) => {
    await openTab(page, fixture(FAILED), 'Invoice_Processing_v2', 'Execution log')
    await row(page, 5).click()
    await drawer(page).getByRole('textbox', { name: 'Note' }).fill('loop starts here')
    await drawer(page).getByRole('button', { name: 'Next row' }).click()
    await expect(drawer(page)).toContainText('#6')
    await expect(row(page, 5).locator('[data-mark="note"]')).toBeVisible()
    await drawer(page).getByRole('button', { name: 'Previous row' }).click()
    await expect(drawer(page).getByRole('textbox', { name: 'Note' })).toHaveValue(
      'loop starts here',
    )
    // Clearing the note removes it.
    await drawer(page).getByRole('textbox', { name: 'Note' }).fill('')
    await expect(drawer(page).getByTestId('note-status')).toHaveText('Saved')
    await expect(row(page, 5).locator('[data-mark="note"]')).toHaveCount(0)
  })
})

test.describe('quick changes to the same row', () => {
  // Each change is saved without waiting for the one before it to finish.
  test('a note, then a bookmark straight away: both are kept', async ({ page }) => {
    await openTab(page, fixture(FAILED), 'Invoice_Processing_v2', 'Execution log')
    await row(page, 12).click()
    const d = drawer(page)
    await d.getByRole('textbox', { name: 'Note' }).fill('note first')
    // The click blurs the note box, which saves the note; the bookmark save follows at once.
    await d.getByRole('button', { name: 'Bookmark' }).click()
    await expect(d.getByRole('button', { name: 'Bookmark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(d.getByTestId('note-status')).toHaveText('Saved')

    await page.reload()
    await openRun(page, 'Invoice_Processing_v2')
    await tab(page, 'Execution log').click()
    await row(page, 12).click()
    await expect(drawer(page).getByRole('button', { name: 'Bookmark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(drawer(page).getByRole('textbox', { name: 'Note' })).toHaveValue('note first')
  })

  test('a double click on Bookmark turns it on and off again', async ({ page }) => {
    await openTab(page, fixture(FAILED), 'Invoice_Processing_v2', 'Execution log')
    await row(page, 12).click()
    const bookmark = drawer(page).getByRole('button', { name: 'Bookmark' })
    // Start bookmarked, so "off then on" is told apart from "nothing happened".
    await bookmark.click()
    await expect(bookmark).toHaveAttribute('aria-pressed', 'true')
    await bookmark.dblclick()
    await expect(drawer(page).getByTestId('note-status')).toHaveText('Saved')
    await expect(bookmark).toHaveAttribute('aria-pressed', 'true')
    await bookmark.dblclick()
    await expect(drawer(page).getByTestId('note-status')).toHaveText('Saved')
    await page.reload()
    await openRun(page, 'Invoice_Processing_v2')
    await tab(page, 'Execution log').click()
    await expect(row(page, 12).locator('[data-mark="bookmark"]')).toBeVisible()
  })

  test('a note still waiting to be saved is kept when leaving the run', async ({ page }) => {
    await openTab(page, fixture(FAILED), 'Invoice_Processing_v2', 'Execution log')
    await row(page, 7).click()
    await drawer(page).getByRole('textbox', { name: 'Note' }).fill('typed, then left')
    await page.getByRole('button', { name: 'Back to history' }).click()
    await openRun(page, 'Invoice_Processing_v2')
    await tab(page, 'Execution log').click()
    await expect(row(page, 7).locator('[data-mark="note"]')).toBeVisible()
  })
})

test.describe('export filtered CSV', () => {
  test('exports the filtered rows, and the file re-imports as its own run', async ({ page }) => {
    await openTab(page, fixture(FAILED), 'Invoice_Processing_v2', 'Execution log')
    await page.getByRole('button', { name: 'Errors only' }).click()
    await expect(page.getByTestId('row-count')).toHaveText('2 of 17 rows')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export filtered CSV' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^Invoice_Processing_v2-filtered-\d{8}T\d{6}Z\.csv$/)
    const text = readFileSync((await file.path())!, 'utf8')
    expect(text.startsWith('﻿sep=,')).toBe(true)

    await page.getByRole('button', { name: 'Back to history' }).click()
    await drop(page, [{ name: file.suggestedFilename(), text }])
    await expect(cards(page)).toHaveCount(2)
    const name = file.suggestedFilename().replace(/\.csv$/, '')
    await openRun(page, name)
    await expect(page.getByTestId('stat-actions')).toContainText('2')
    await expect(page.getByTestId('stat-failures')).toContainText('2')
    await tab(page, 'Execution log').click()
    await expect(page.getByTestId('row-count')).toHaveText('2 of 2 rows')
    await expect(row(page, 12)).toBeVisible()
    await expect(row(page, 17)).toBeVisible()

    // The same export dropped again is recognised.
    await page.getByRole('button', { name: 'Back to history' }).click()
    await drop(page, [{ name: file.suggestedFilename(), text }])
    await expect(page.getByTestId('notice')).toContainText('already in history')
    await expect(cards(page)).toHaveCount(2)
  })
})

// One variable written in subflows with short, long and very long names.
const LONG_SUBFLOW = 'Create or Empty Folder For Screenshots'
const HUGE_SUBFLOW = 'Very long subflow name '.repeat(6).trim()
const SUBFLOW_VARS = {
  name: 'Subflow_Vars-708192a3-b4c5-4d6e-8f70-8192a3b4c5d6-20261013T200000Z.csv',
  text: toCsv(
    [
      ['1', 'main'],
      ['2', LONG_SUBFLOW],
      ['3', HUGE_SUBFLOW],
    ].map(([i, subflow]) =>
      csvRow({
        'Log index': i!,
        Subflow: subflow!,
        Outputs: JSON.stringify({ V: param('Value', `C:\\Data\\Screens\\run${i}`, 'txt_Folder') }),
      }),
    ),
  ),
}

test.describe('variables history columns', () => {
  test.use({ viewport: { width: 1366, height: 900 } })

  test('show subflow names in full while the row has room, and cut only the longest', async ({
    page,
  }) => {
    await drop(page, [SUBFLOW_VARS])
    await openRun(page, 'Subflow_Vars')
    await tab(page, 'Variables').click()
    await page
      .getByTestId('variable-list')
      .getByRole('button', { name: /^txt_Folder\b/ })
      .click()
    const items = page.getByTestId('variable-history').getByTestId('assignment')
    await expect(items).toHaveCount(3)
    const cut = (title: string) =>
      items
        .locator(`[title="${title}"]`)
        .first()
        .evaluate((el) => el.scrollWidth > el.clientWidth)
    expect(await cut('main')).toBe(false)
    expect(await cut(LONG_SUBFLOW)).toBe(false)
    // A name wider than its cap still ends in "…", with the full name on hover.
    expect(await cut(HUGE_SUBFLOW)).toBe(true)
    // Values are short, so they are not cut either.
    expect(await cut('C:\\Data\\Screens\\run2')).toBe(false)
  })
})

test.describe('variables tab', () => {
  test('lists variables with counts, filters them, and links each assignment to its row', async ({
    page,
  }) => {
    await openTab(page, VARS, 'Var_Run', 'Variables')
    const list = page.getByTestId('variable-list')
    await expect(list.getByRole('button', { name: /^count\b/ })).toContainText('200')
    await page.getByRole('searchbox', { name: 'Search variables' }).fill('var7')
    await expect(list.getByRole('button')).toHaveCount(1)
    await list.getByRole('button', { name: /^var7\b/ }).click()
    const history = page.getByTestId('variable-history')
    await expect(history.getByRole('heading', { name: 'var7' })).toBeVisible()
    const items = history.getByTestId('assignment')
    await expect(items).toHaveCount(4)
    await expect(items.nth(0)).toContainText('#7')
    await expect(items.nth(1)).toContainText('ok 57')
    await items.nth(2).getByRole('button', { name: 'Go to row #107' }).click()
    await expect(tab(page, 'Execution log')).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 107)).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 107)).toBeInViewport()
  })

  test('shows the truncation badge on a value PAD cut short', async ({ page }) => {
    await openTab(page, VARS, 'Var_Run', 'Variables')
    // Row 13 writes var13 with a value PAD cut short.
    await page.getByRole('searchbox', { name: 'Search variables' }).fill('var13')
    await page
      .getByTestId('variable-list')
      .getByRole('button', { name: /^var13\b/ })
      .click()
    const first = page.getByTestId('variable-history').getByTestId('assignment').first()
    await expect(first).toContainText('#13')
    await expect(first.getByText('truncated by PAD')).toBeVisible()
  })

  test('scrolls a long history without rendering every assignment', async ({ page }) => {
    await openTab(
      page,
      { ...VARS, name: VARS.name.replace('Var_Run', 'Big_Vars'), text: toCsv(syntheticRun(5_000)) },
      'Big_Vars',
      'Variables',
    )
    await page
      .getByTestId('variable-list')
      .getByRole('button', { name: /^count\b/ })
      .click()
    const history = page.getByTestId('variable-history')
    await expect(history).toContainText('5,000 assignments')
    expect(await history.getByTestId('assignment').count()).toBeLessThan(200)
  })
})

test.describe('errors tab', () => {
  test('shows each failure with the 3 rows before it and its full message', async ({ page }) => {
    await openTab(page, fixture(FAILED), 'Invoice_Processing_v2', 'Errors')
    const failures = page.getByTestId('failure')
    await expect(failures).toHaveCount(2)
    const last = failures.nth(1)
    await expect(last).toContainText('#17')
    await expect(last).toContainText('Flow stopped with error: "Invoice API unavailable"')
    await expect(last.getByTestId('context-row')).toHaveCount(3)
    await expect(last.getByTestId('context-row').first()).toContainText('#14')
    await failures.first().getByRole('button', { name: 'Jump to row' }).click()
    await expect(tab(page, 'Execution log')).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 12)).toHaveAttribute('aria-selected', 'true')
  })

  test('says so when the run has no failures', async ({ page }) => {
    await openTab(page, fixture(REAL), 'Invoice_Extraction_Main', 'Errors')
    await expect(page.getByTestId('no-failures')).toContainText('No failures in this run')
  })
})

test.describe('density', () => {
  test('switches between comfortable and compact rows, and remembers it', async ({ page }) => {
    await openTab(page, fixture(FAILED), 'Invoice_Processing_v2', 'Execution log')
    const height = () => row(page, 1).evaluate((el) => el.getBoundingClientRect().height)
    expect(await height()).toBe(40)
    const compact = page.getByRole('button', { name: 'Compact rows' })
    await compact.click()
    await expect(compact).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(height).toBe(28)
    // The choice is written to IndexedDB just after; reloading before that write commits
    // would come back comfortable (failed once in CI on the v1 release candidate).
    await expect.poll(() => storedSetting(page, 'logDensity')).toBe('compact')
    await page.reload()
    await openRun(page, 'Invoice_Processing_v2')
    await tab(page, 'Execution log').click()
    await expect.poll(height).toBe(28)
  })
})

for (const width of [375, 768, 1366]) {
  test.describe(`variables and errors at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 812 : 900 } })

    test('fit the width without horizontal page scroll', async ({ page }) => {
      await drop(page, [fixture(FAILED), VARS])
      for (const [run, tabName, file] of [
        ['Var_Run', 'Variables', 'variables'],
        ['Invoice_Processing_v2', 'Errors', 'errors'],
      ] as const) {
        await openRun(page, run)
        await tab(page, tabName).click()
        if (tabName === 'Variables') {
          await page
            .getByTestId('variable-list')
            .getByRole('button', { name: /^var7\b/ })
            .click()
          await expect(page.getByTestId('variable-history')).toBeVisible()
        } else {
          await expect(page.getByTestId('failure')).toHaveCount(2)
        }
        for (const theme of ['dark', 'light'] as const) {
          const toggle = page.getByRole('button', {
            name: `Switch to ${theme} theme`,
          })
          if ((await page.locator('html').getAttribute('data-theme')) !== theme)
            await toggle.click()
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          )
          expect(overflow, `${tabName} ${theme}`).toBe(0)
          if (process.env.SCREENSHOTS) {
            await page.screenshot({ path: `docs/screenshots/m7/${file}-${width}-${theme}.png` })
          }
        }
        await page.getByRole('button', { name: 'Back to history' }).click()
      }
    })
  })
}
