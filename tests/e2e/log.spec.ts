// M6: Execution log. Acceptance: 10k rows scroll without blank rows; filter update < 100 ms;
// the drawer shows the truncation badge.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { param, row as csvRow, syntheticRun, toCsv } from '../unit/helpers/syntheticLog.ts'
import { FAILED, drop, fixture, openApp, openRun, storedSetting } from './helpers.ts'

// 10,000 rows: failures at Log index 997, 1994, …; row 13 (every 13th) has a value PAD cut short.
const BIG = {
  name: 'Big_Run-3c4d5e6f-7081-4a9b-8c0d-2e3f4a5b6c7d-20261013T110000Z.csv',
  text: toCsv(syntheticRun(10_000)),
}

// PAD itself cuts logged values at about 150 characters, so no fixture has a value long
// enough for "Show more"; this run has one, as HTML that must show as text.
const LONG_HTML = `<p>Dear Supplier,</p><script>window.__xss = 1</script>${'<p>Line of the email body.</p>'.repeat(20)}`
const LONG = {
  name: 'Long_Values-4d5e6f70-8192-4a3b-9c4d-5e6f708192a3-20261013T120000Z.csv',
  text: toCsv([
    csvRow({ 'Log index': '1' }),
    csvRow({
      'Log index': '2',
      'Module name': 'Text',
      'Action name': 'CreateHTMLContentAction',
      'Module display name': 'Text',
      'Action display name': 'Create HTML content',
      Inputs: JSON.stringify({ HtmlEditor: param('Html editor', LONG_HTML) }),
      Outputs: JSON.stringify({ HtmlContent: param('Html Content', LONG_HTML, 'txt_Body') }),
    }),
    csvRow({ 'Log index': '3' }),
  ]),
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name })
const scroller = (page: Page) => page.getByTestId('log-scroller')
const row = (page: Page, logIndex: number) =>
  page.getByTestId('log-table').locator(`[data-log-index="${logIndex}"]`)
const drawer = (page: Page) => page.getByRole('complementary', { name: 'Row details' })

async function openLog(page: Page, file: { name: string; text: string }, name: string) {
  await drop(page, [file])
  await openRun(page, name)
  await tab(page, 'Execution log').click()
  await expect(page.getByTestId('log-table')).toBeVisible()
}

/** Every pixel of the scroller's visible body is covered by a rendered row. */
async function coverage(list: Locator) {
  return list.evaluate(async (el) => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const view = el.getBoundingClientRect()
    const head = el.querySelector('[data-log-header]')?.getBoundingClientRect().bottom ?? view.top
    const top = Math.max(view.top, head)
    const bottom = Math.min(view.bottom, top + el.scrollHeight - el.scrollTop)
    const rects = [...el.querySelectorAll('[data-log-index]')]
      .map((r) => r.getBoundingClientRect())
      .filter((r) => r.bottom > top && r.top < bottom)
      .sort((a, b) => a.top - b.top)
    if (rects.length === 0) return { ok: false, why: 'no rows in view' }
    if (rects[0]!.top > top + 1) return { ok: false, why: `gap at top ${rects[0]!.top - top}px` }
    for (let i = 1; i < rects.length; i++) {
      if (rects[i]!.top > rects[i - 1]!.bottom + 1) return { ok: false, why: `gap after row ${i}` }
    }
    if (rects.at(-1)!.bottom < bottom - 1) return { ok: false, why: 'gap at bottom' }
    return { ok: true, why: '' }
  })
}

test.beforeEach(async ({ page }) => {
  await openApp(page)
})

test.describe('virtualized table', () => {
  test('scrolls 10,000 rows without blank rows', async ({ page }) => {
    await openLog(page, BIG, 'Big_Run')
    // 10,000 data rows plus the header row.
    await expect(page.getByTestId('log-table')).toHaveAttribute('aria-rowcount', '10001')
    await expect(page.locator('[data-log-header]')).toHaveAttribute('aria-rowindex', '1')
    await expect(row(page, 1)).toHaveAttribute('aria-rowindex', '2')
    const list = scroller(page)
    // Fewer DOM rows than data rows: the table is virtualized.
    expect(await list.locator('[data-log-index]').count()).toBeLessThan(200)
    const max = await list.evaluate((el) => el.scrollHeight - el.clientHeight)
    expect(max).toBeGreaterThan(100_000)
    const stops = [0, 0.01, 0.1, 0.25, 0.333, 0.5, 0.75, 0.9, 0.999, 1, 0.5, 0.02]
    for (const at of stops) {
      await list.evaluate((el, y) => (el.scrollTop = y), Math.round(max * at))
      expect(await coverage(list), `at ${at}`).toEqual({ ok: true, why: '' })
    }
    // Small steps, like a wheel, across a stretch of the list.
    for (let i = 0; i < 20; i++) {
      await list.evaluate((el) => (el.scrollTop += 137))
      expect(await coverage(list), `step ${i}`).toEqual({ ok: true, why: '' })
    }
    await list.evaluate((el) => (el.scrollTop = el.scrollHeight))
    await expect(row(page, 10_000)).toBeVisible()
  })
})

test.describe('filter bar', () => {
  test('applies filters in under 100 ms on 10,000 rows', async ({ page }) => {
    await openLog(page, BIG, 'Big_Run')
    const count = page.getByTestId('row-count')
    await expect(count).toHaveText('10,000 of 10,000 rows')
    const lastFilterMs = () =>
      page.evaluate(() => {
        const m = performance.getEntriesByName('pad:filter')
        return m.length ? { n: m.length, ms: m.at(-1)!.duration } : { n: 0, ms: NaN }
      })

    await page.getByRole('searchbox', { name: 'Search the log' }).fill('excel')
    await expect(count).not.toHaveText('10,000 of 10,000 rows')
    let m = await lastFilterMs()
    expect(m.n).toBeGreaterThan(0)
    expect(m.ms).toBeLessThan(100)

    await page
      .getByRole('group', { name: 'Status' })
      .getByRole('button', { name: 'Failed' })
      .click()
    await expect(count).toHaveText(/^\d+ of 10,000 rows$/)
    m = await lastFilterMs()
    expect(m.ms).toBeLessThan(100)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(count).toHaveText('10,000 of 10,000 rows')
    expect((await lastFilterMs()).ms).toBeLessThan(100)
  })

  test('combines search, facets, Errors only and Hide noise, and shows the count', async ({
    page,
  }) => {
    await openLog(page, fixture(FAILED), 'Invoice_Processing_v2')
    const count = page.getByTestId('row-count')
    await expect(count).toHaveText('17 of 17 rows')
    await page.getByRole('button', { name: 'Errors only' }).click()
    await expect(count).toHaveText('2 of 17 rows')
    await expect(page.getByRole('button', { name: 'Errors only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByTestId('active-filters')).toHaveText('1 filter')
    await page.getByRole('button', { name: 'Errors only' }).click()
    await page.getByRole('button', { name: 'Hide noise' }).click()
    await expect(count).toHaveText('14 of 17 rows')
    await page.getByRole('button', { name: 'Hide noise' }).click()
    await page.getByRole('button', { name: 'Subflows' }).click()
    await page.getByRole('checkbox', { name: 'Init' }).check()
    await expect(count).toHaveText('7 of 17 rows')
    await page.getByRole('searchbox', { name: 'Search the log' }).fill('excel')
    await expect(count).toHaveText('2 of 17 rows')
    await expect(page.getByTestId('active-filters')).toHaveText('2 filters')
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(count).toHaveText('17 of 17 rows')
    await expect(page.getByRole('searchbox', { name: 'Search the log' })).toHaveValue('')
  })
})

test.describe('row drawer', () => {
  test('shows the truncation badge on a value PAD cut short', async ({ page }) => {
    await openLog(page, BIG, 'Big_Run')
    await row(page, 13).click()
    await expect(drawer(page)).toBeVisible()
    await expect(drawer(page)).toContainText('#13')
    const result = drawer(page).getByTestId('param').filter({ hasText: 'Result' })
    await expect(result).toContainText('a long value that PAD cut short...')
    await expect(result.getByText('truncated by PAD')).toBeVisible()
    // A row without a cut value has no badge.
    await drawer(page).getByRole('button', { name: 'Next row' }).click()
    await expect(drawer(page)).toContainText('#14')
    await expect(drawer(page).getByText('truncated by PAD')).toHaveCount(0)
  })

  test('shows parameters, long values, raw JSON and copy actions', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openLog(page, LONG, 'Long_Values')
    await page.getByRole('searchbox', { name: 'Search the log' }).fill('dear supplier')
    await expect(page.getByTestId('row-count')).toHaveText('1 of 3 rows')
    await page.getByTestId('log-table').locator('[data-log-index]').first().click()
    const d = drawer(page)
    await expect(d.getByRole('heading', { name: 'Inputs' })).toBeVisible()
    await expect(d.getByRole('heading', { name: 'Outputs' })).toBeVisible()
    const more = d.getByRole('button', { name: 'Show more' }).first()
    await more.click()
    await expect(d.getByRole('button', { name: 'Show less' }).first()).toBeVisible()
    // Log values are text, never HTML.
    await expect(d.getByTestId('param').first()).toContainText('<script>window.__xss = 1</script>')
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined()

    await d.getByRole('button', { name: 'Raw JSON' }).click()
    const tree = d.getByRole('tree').first()
    await expect(tree).toBeVisible()
    const item = tree.getByRole('treeitem').first()
    await expect(item).toHaveAttribute('aria-expanded', 'true')
    await item.getByRole('button').first().click()
    await expect(item).toHaveAttribute('aria-expanded', 'false')

    await d.getByRole('button', { name: 'Copy row as text' }).click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/^#\d+ Create HTML content/)
    await expect(page.getByText('Copied')).toBeVisible()
  })

  test('steps with Previous and Next, and closes', async ({ page }) => {
    await openLog(page, fixture(FAILED), 'Invoice_Processing_v2')
    await row(page, 5).click()
    await expect(drawer(page)).toContainText('#5')
    await drawer(page).getByRole('button', { name: 'Next row' }).click()
    await expect(drawer(page)).toContainText('#6')
    await expect(row(page, 6)).toHaveAttribute('aria-selected', 'true')
    await drawer(page).getByRole('button', { name: 'Previous row' }).click()
    await expect(drawer(page)).toContainText('#5')
    await drawer(page).getByRole('button', { name: 'Close details' }).click()
    await expect(drawer(page)).toHaveCount(0)
  })
})

test.describe('keyboard', () => {
  test('↑/↓ move, Enter opens, Esc closes, / searches, f finds the next failure', async ({
    page,
  }) => {
    await openLog(page, BIG, 'Big_Run')
    await row(page, 1).click()
    await page.getByRole('button', { name: 'Close details' }).click()
    await expect(drawer(page)).toHaveCount(0)
    await page.getByTestId('log-table').focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(row(page, 3)).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowUp')
    await expect(row(page, 2)).toHaveAttribute('aria-selected', 'true')
    // Assistive tech is told which row is active.
    const active = await page.getByTestId('log-table').getAttribute('aria-activedescendant')
    expect(await row(page, 2).getAttribute('id')).toBe(active)
    await page.keyboard.press('Enter')
    await expect(drawer(page)).toContainText('#2')
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toHaveCount(0)
    await page.keyboard.press('f')
    await expect(row(page, 997)).toHaveAttribute('aria-selected', 'true')
    await expect(row(page, 997)).toBeInViewport()
    await page.keyboard.press('f')
    await expect(row(page, 1994)).toBeInViewport()
    await page.keyboard.press('/')
    await expect(page.getByRole('searchbox', { name: 'Search the log' })).toBeFocused()
  })

  test('Jump to row scrolls back to an already selected row', async ({ page }) => {
    await openLog(page, BIG, 'Big_Run')
    await tab(page, 'Overview').click()
    await page.getByTestId('first-failure').getByRole('button', { name: 'Jump to row' }).click()
    await expect(row(page, 997)).toBeInViewport()
    await scroller(page).evaluate((el) => (el.scrollTop = 0))
    await expect(row(page, 997)).toHaveCount(0)
    await tab(page, 'Overview').click()
    await page.getByTestId('first-failure').getByRole('button', { name: 'Jump to row' }).click()
    await expect(row(page, 997)).toBeInViewport()
  })
})

test.describe('column picker', () => {
  test('shows and hides columns, and remembers the choice', async ({ page }) => {
    await openLog(page, fixture(FAILED), 'Invoice_Processing_v2')
    const header = page.locator('[data-log-header]')
    await expect(header.getByRole('columnheader', { name: 'Effect' })).toBeVisible()
    await expect(header.getByRole('columnheader', { name: 'Log level' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Columns' }).click()
    await page.getByRole('checkbox', { name: 'Log level' }).check()
    await page.getByRole('checkbox', { name: 'Effect' }).uncheck()
    await page.keyboard.press('Escape')
    await expect(header.getByRole('columnheader', { name: 'Log level' })).toBeVisible()
    await expect(header.getByRole('columnheader', { name: 'Effect' })).toHaveCount(0)
    await expect(row(page, 12)).toContainText('Error')
    // The choice is written to IndexedDB just after; wait for it before reloading.
    await expect
      .poll(() => storedSetting(page, 'logColumns'))
      .toMatchObject({ level: true, effect: false })
    await page.reload()
    await openRun(page, 'Invoice_Processing_v2')
    await tab(page, 'Execution log').click()
    await expect(header.getByRole('columnheader', { name: 'Log level' })).toBeVisible()
    await expect(header.getByRole('columnheader', { name: 'Effect' })).toHaveCount(0)
  })
})

for (const [width, layout] of [
  [375, 'cards, full-screen drawer'],
  [768, 'table, drawer over the table'],
  [1366, 'table, drawer docked'],
] as const) {
  test.describe(`execution log at ${width} px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 812 : 900 } })

    test(`lays out as ${layout} without horizontal page scroll`, async ({ page }) => {
      await openLog(page, fixture(FAILED), 'Invoice_Processing_v2')
      if (process.env.SCREENSHOTS) {
        await page.screenshot({ path: `docs/screenshots/m6/log-${width}-list.png` })
      }
      await row(page, 12).click()
      const d = drawer(page)
      await expect(d).toBeVisible()
      const box = (await d.boundingBox())!
      if (width < 768) {
        expect(box.width).toBeGreaterThanOrEqual(width - 1)
        await expect(page.getByTestId('log-table')).toHaveAttribute('data-layout', 'cards')
      } else if (width < 1280) {
        expect(await d.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
        await expect(page.getByTestId('log-table')).toHaveAttribute('data-layout', 'table')
      } else {
        expect(await d.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed')
        expect(box.width).toBeGreaterThan(width * 0.3)
        const table = (await page.getByTestId('log-table').boundingBox())!
        expect(table.x + table.width).toBeLessThanOrEqual(box.x + 1)
      }
      for (const theme of ['dark', 'light'] as const) {
        if (theme === 'light') {
          await page.getByRole('button', { name: 'Switch to light theme' }).click()
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBe(0)
        if (process.env.SCREENSHOTS) {
          await page.screenshot({ path: `docs/screenshots/m6/log-${width}-${theme}.png` })
        }
      }
    })
  })
}
