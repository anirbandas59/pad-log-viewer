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

  it('is deterministic', () => {
    expect(sanitize().csv).toBe(sanitize().csv)
  })
})
