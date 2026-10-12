import { describe, expect, it } from 'vitest'
import { sanitizeLog } from '../../../scripts/lib/sanitize.ts'
import { parseFileName } from '../../../src/core/csv/fileName.ts'
import { parseCsv } from '../../../src/core/csv/parseCsv.ts'
import { parsePayload } from '../../../src/core/derive/payload.ts'
import { param, row, toCsv } from '../helpers/syntheticLog.ts'

const RUN_GUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const PROJECT_GUID = 'F00DCAFE-1234-4321-ABCD-0123456789AB'
const FILE_NAME = `Acme_Invoice_Run_${RUN_GUID}_20261001T091500Z.csv`

// A "real-looking" log: every value below that is not generic is sensitive.
const SECRETS = [
  'jdoe',
  'acme',
  'Q3 Payables',
  RUN_GUID,
  PROJECT_GUID.toLowerCase(),
  'fs01',
  'svc_robot',
  'corp',
]

function realLikeCsv(): string {
  return (
    '\uFEFF' +
    toCsv([
      row({
        'Log index': '1',
        Subflow: 'Acme_Load',
        Inputs: JSON.stringify({
          Path: param(
            'Document path',
            'C:\\Users\\jdoe\\OneDrive - Acme\\Q3 Payables\\inv_0001.xlsx',
          ),
          Share: param('Folder', '\\\\fs01\\finance\\Q3 Payables'),
        }),
        Outputs: JSON.stringify({ Project: param('Project id', PROJECT_GUID, 'txt_ProjectId') }),
      }),
      row({
        'Log index': '2',
        'Log message':
          'Mail sent to jdoe@acme.com by CORP\\svc_robot from C:\\Users\\jdoe\\AppData\\Local\\Temp\\a.txt',
        Inputs: JSON.stringify({
          Url: param('URL', 'https://acme.sharepoint.com/sites/Finance/Shared%20Documents'),
          Same: param('Again', 'C:\\Users\\jdoe\\OneDrive - Acme\\Q3 Payables\\inv_0001.xlsx'),
          Cut: param('Body', 'C:\\Users\\jdoe\\Documents\\Acme rep...'),
        }),
        Outputs: JSON.stringify({ Run: param('Run', RUN_GUID) }),
      }),
      row({
        'Log index': '3',
        Status: 'Failed',
        Inputs:
          '{"Path": {"value": "C:\\\\Users\\\\jdoe\\\\Desktop\\\\acme.xlsx", "variableName": "trunc',
      }),
    ])
  )
}

function sanitize(extra: Partial<Parameters<typeof sanitizeLog>[1]> = {}) {
  return sanitizeLog(realLikeCsv(), {
    fileName: FILE_NAME,
    terms: ['Acme', 'Q3 Payables'],
    ...extra,
  })
}

describe('sanitizeLog', () => {
  it('removes usernames, client paths, project ids, hosts, emails and accounts', () => {
    const out = sanitize()
    const haystack = (out.csv + out.fileName).toLowerCase()
    for (const s of SECRETS) expect(haystack, s).not.toContain(s.toLowerCase())
    expect(out.residual).toEqual([])
    expect(out.counts.guid).toBeGreaterThanOrEqual(2)
    expect(out.counts.path).toBeGreaterThanOrEqual(3)
    expect(out.counts.email).toBe(1)
    expect(out.counts.url).toBe(1)
    expect(out.counts.account).toBe(1)
  })

  it('keeps the CSV parseable with the same rows, headers and timestamps', () => {
    const before = parseCsv(realLikeCsv())
    const after = parseCsv(sanitize().csv)
    if (!before.ok || !after.ok) throw new Error('parse failed')
    expect(after.headers).toEqual(before.headers)
    expect(after.rows).toHaveLength(3)
    expect(
      after.rows.map((r) => [r['Start time'], r['End time'], r['Log index'], r.Status]),
    ).toEqual(before.rows.map((r) => [r['Start time'], r['End time'], r['Log index'], r.Status]))
  })

  it('keeps valid JSON valid and malformed JSON malformed', () => {
    const after = parseCsv(sanitize().csv)
    if (!after.ok) throw new Error('parse failed')
    expect(parsePayload(after.rows[0]!.Inputs!).malformed).toBe(false)
    expect(parsePayload(after.rows[1]!.Inputs!).malformed).toBe(false)
    expect(parsePayload(after.rows[2]!.Inputs!).malformed).toBe(true)
  })

  it('keeps path shape, extensions and the truncation marker', () => {
    const after = parseCsv(sanitize().csv)
    if (!after.ok) throw new Error('parse failed')
    const p = parsePayload(after.rows[0]!.Inputs!).params
    expect(p[0]!.value).toMatch(/^C:\\Users\\[^\\]+\\[^\\]+\\[^\\]+\\[^\\]+\.xlsx$/)
    expect(p[1]!.value).toMatch(/^\\\\[^\\]+\\[^\\]+\\[^\\]+$/)
    const cut = parsePayload(after.rows[1]!.Inputs!).params[2]!
    expect(cut.truncated).toBe(true)
    expect(cut.value.startsWith('C:\\Users\\')).toBe(true)
  })

  it('replaces the same value with the same pseudonym everywhere', () => {
    const after = parseCsv(sanitize().csv)
    if (!after.ok) throw new Error('parse failed')
    const first = parsePayload(after.rows[0]!.Inputs!).params[0]!.value
    const again = parsePayload(after.rows[1]!.Inputs!).params[1]!.value
    expect(again).toBe(first)
  })

  it('maps the run GUID consistently in the file name and the body', () => {
    const out = sanitize()
    const info = parseFileName(out.fileName)
    expect(info.matched).toBe(true)
    expect(info.exportedAt).toBe('20261001T091500Z')
    expect(info.runId).not.toBe(RUN_GUID)
    const after = parseCsv(out.csv)
    if (!after.ok) throw new Error('parse failed')
    expect(parsePayload(after.rows[1]!.Outputs!).params[0]!.value).toBe(info.runId)
  })

  it('removes terms from the flow name, or uses the given flow name', () => {
    expect(parseFileName(sanitize().fileName).flowName.toLowerCase()).not.toContain('acme')
    expect(parseFileName(sanitize({ flowName: 'Invoice_Run' }).fileName).flowName).toBe(
      'Invoice_Run',
    )
  })

  it('keeps generic Windows folders and the BOM', () => {
    const out = sanitize()
    expect(out.csv.startsWith('\uFEFF')).toBe(true)
    expect(out.csv).toContain('AppData\\Local\\Temp\\')
    expect(out.csv).toContain('C:\\\\Users\\\\')
  })

  it('sanitizes a UNC path that follows a path in free text', () => {
    const csv = toCsv([
      row({
        'Log index': '1',
        'Log message': 'Copied C:\\Temp\\a.txt; see \\\\fs02\\payroll\\x.pdf',
      }),
    ])
    const out = sanitizeLog(csv, { fileName: 'x.csv' })
    expect(out.csv.toLowerCase()).not.toContain('payroll')
    expect(out.csv.toLowerCase()).not.toContain('fs02')
  })

  describe('closes leaks found in the M1 review', () => {
    // Every value in `secrets` must be gone, and the residual check must come back empty.
    function expectClean(fields: Omit<Parameters<typeof row>[0], 'Log index'>, secrets: string[]) {
      const out = sanitizeLog(toCsv([row({ 'Log index': '1', ...fields })]), {
        fileName: 'x.csv',
      })
      const haystack = out.csv.toLowerCase()
      for (const s of secrets) expect(haystack, s).not.toContain(s.toLowerCase())
      expect(out.residual).toEqual([])
      return out
    }

    it('pseudonymises DOMAIN\\account whatever the case of the domain', () => {
      const out = expectClean(
        { 'Log message': 'Logged in as corp\\jdoe; owner Contoso\\JDoe; run by CORP\\svc_robot' },
        ['corp', 'jdoe', 'contoso', 'svc_robot'],
      )
      expect(out.counts.account).toBe(3)
    })

    it('does not treat path segments as DOMAIN\\account', () => {
      const out = expectClean({ 'Log message': 'Saved C:\\Users\\jdoe\\Reports\\q.xlsx' }, [
        'jdoe',
        'reports',
      ])
      expect(out.counts.account).toBe(0)
      expect(out.csv).toMatch(/C:\\Users\\[^\\]+\\[^\\]+\\[^\\]+\.xlsx/)
    })

    it('does not treat relative path segments as DOMAIN\\account', () => {
      const out = sanitizeLog(
        toCsv([
          row({
            'Log index': '1',
            'Log message': 'Read Data\\Invoices\\a.pdf and Reports\\Q1\\x.xlsx',
          }),
        ]),
        { fileName: 'x.csv' },
      )
      expect(out.counts.account).toBe(0)
      expect(out.csv).toContain('Data\\Invoices\\a.pdf')
    })

    it('keeps every JSON key when rewritten keys would collide', () => {
      const out = sanitizeLog(
        toCsv([
          row({
            'Log index': '1',
            Inputs: JSON.stringify({ T: param('Table', { Acme: 1, acme: 2, ACME: 3 }) }),
          }),
        ]),
        { fileName: 'x.csv', terms: ['Acme'] },
      )
      const after = parseCsv(out.csv)
      if (!after.ok) throw new Error('parse failed')
      const value = parsePayload(after.rows[0]!.Inputs!).params[0]!.value
      const table = JSON.parse(value) as Record<string, number>
      expect(Object.values(table).sort()).toEqual([1, 2, 3])
      expect(out.csv.toLowerCase()).not.toContain('acme')
    })

    it('replaces a whole file:// address even when it contains spaces', () => {
      expectClean({ 'Log message': 'Opened file:///C:/Users/jdoe/Client Acme/report.pdf today' }, [
        'jdoe',
        'acme',
        'report',
      ])
    })

    it('never rewrites the payload structure keys', () => {
      const out = sanitizeLog(
        toCsv([
          row({ 'Log index': '1', Inputs: JSON.stringify({ F: param('Folder', 'x', 'NewVar') }) }),
        ]),
        { fileName: 'x.csv', terms: ['val', 'loc', 'abl'] },
      )
      const after = parseCsv(out.csv)
      if (!after.ok) throw new Error('parse failed')
      const p = parsePayload(after.rows[0]!.Inputs!).params[0]!
      expect(p.value).toBe('x')
      expect(p.label).toBe('Folder')
      expect(p.variable).toBe('NewVar')
    })

    it('keeps keys named like Object.prototype members', () => {
      const out = sanitizeLog(
        toCsv([
          row({
            'Log index': '1',
            Inputs:
              '{"T":{"localizedName":"T","value":{"constructor":1,"toString":2,"__proto__":3},"variableName":null}}',
          }),
        ]),
        { fileName: 'x.csv' },
      )
      const after = parseCsv(out.csv)
      if (!after.ok) throw new Error('parse failed')
      const value = parsePayload(after.rows[0]!.Inputs!).params[0]!.value
      expect(Object.keys(JSON.parse(value) as object).sort()).toEqual([
        '__proto__',
        'constructor',
        'toString',
      ])
    })

    it('sanitizes forward-slash drive paths', () => {
      const out = expectClean({ 'Log message': 'Saved C:/Users/jdoe/Reports/q.xlsx' }, [
        'jdoe',
        'reports',
      ])
      expect(out.csv).toMatch(/C:\/Users\/[^/]+\/[^/]+\/[^/]+\.xlsx/)
    })

    it('keeps URL pseudonyms intact instead of reading "https:/" as a drive path', () => {
      const out = expectClean(
        { 'Log message': 'See https://example.com/a//b?x=1 and file:///C:/Users/jdoe/y.pdf' },
        ['jdoe'],
      )
      expect(out.csv).toContain('https://host1.example.test/path1')
      expect(out.csv).toContain('file://host2/path2')
      expect(out.counts.path).toBe(0)
    })

    it('sanitizes file:// URIs and //host/share paths', () => {
      expectClean(
        {
          'Log message': 'Opened file://fs01/finance/x.pdf and file:///C:/Users/jdoe/y.pdf',
          Inputs: JSON.stringify({ P: param('Folder', '//fs03/payroll/z.pdf') }),
        },
        ['fs01', 'finance', 'jdoe', 'fs03', 'payroll'],
      )
    })

    it('learns and rewrites JSON object keys', () => {
      const out = expectClean(
        {
          Inputs: JSON.stringify({
            Table: param('Data table', {
              'C:\\Users\\jdoe\\x.xlsx': { owner: 'jdoe@acme.com' },
              rows: [{ 'corp\\mallory': 1 }],
            }),
          }),
        },
        ['jdoe', 'acme', 'mallory'],
      )
      const after = parseCsv(out.csv)
      if (!after.ok) throw new Error('parse failed')
      expect(parsePayload(after.rows[0]!.Inputs!).malformed).toBe(false)
    })

    it('learns OneDrive organisation and SharePoint site names', () => {
      expectClean(
        {
          'Log message':
            'C:\\Users\\bob\\OneDrive - Globex\\a.txt from https://globex.sharepoint.com/sites/Payroll/x; Globex Payroll approved',
        },
        ['globex', 'payroll'],
      )
    })
  })

  it('is deterministic', () => {
    expect(sanitize().csv).toBe(sanitize().csv)
  })
})
