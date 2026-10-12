// Pure sanitizer logic for scripts/sanitize-log.ts; no Node APIs so tests can import it.
//
// Replaces GUIDs, Windows/UNC paths, URLs, e-mail addresses, DOMAIN\account names,
// user names found in those, and caller-supplied terms with stable pseudonyms, so
// the same original maps to the same replacement across the whole file. Timestamps,
// indexes, statuses, module/action names, CSV shape and JSON validity are kept.
import Papa from 'papaparse'

export interface SanitizeOptions {
  /** Original file name; its run GUID is replaced consistently with the log body. */
  fileName: string
  /** Extra words to remove everywhere (client names, machine names), matched case-insensitively. */
  terms?: string[]
  /** Replacement flow name for the output file name. */
  flowName?: string
}

export interface SanitizeResult {
  csv: string
  fileName: string
  /** Number of replacements per kind (guid, path, email, url, account, term). */
  counts: Record<string, number>
  /** Sensitive originals still present in the output; must be empty. */
  residual: string[]
}

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const URL_RE = /\b(?:https?|file):\/\/[^\s"'<>]*/gi
// One path segment: no separator and no Windows-forbidden character.
const SEG = String.raw`[^\\/:*?"<>|\r\n]+`
// DOMAIN\account in any case. The domain must not continue a path (no separator, drive
// colon or word character before it) and the account must not be followed by another
// segment, so C:\Users\jdoe\x is left to the path rules.
const ACCOUNT = /(?<![\w\\/:.$-])([A-Za-z][A-Za-z0-9-]{1,14})\\([A-Za-z][\w.$-]*)(?![\\/])/g
const USER_DIR = new RegExp(String.raw`(?<!\w)[A-Za-z]:[\\/]Users[\\/](${SEG})`, 'gi')
// \\host\share or //host/share; a preceding colon means a URL scheme, handled by URL_RE.
const UNC_HOST = new RegExp(String.raw`(?<![\\/:])(?:\\\\|//)(${SEG})[\\/]`, 'g')
const ONEDRIVE_ORG = /OneDrive - ([^\\/:*?"<>|\r\n]+)/gi
const SHAREPOINT_SITE = /\/(?:sites|teams)\/([^/?#\s"'<>]+)/gi
// Host labels that identify nobody; learning them would also rewrite our own pseudonyms.
const HOST_NOISE = new Set(['www', 'com', 'net', 'org', 'co', 'example', 'test', 'localhost'])

// Generic Windows folders kept as-is so fixtures stay readable.
const GENERIC = new Set(
  [
    'users',
    'public',
    'default',
    'program files',
    'program files (x86)',
    'programdata',
    'windows',
    'system32',
    'appdata',
    'local',
    'roaming',
    'locallow',
    'temp',
    'tmp',
    'desktop',
    'documents',
    'downloads',
    'pictures',
    'microsoft',
    'power automate desktop',
  ].map((s) => s.toLowerCase()),
)

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

class Pseudonyms {
  private maps = new Map<string, Map<string, string>>()
  readonly counts: Record<string, number> = {
    guid: 0,
    path: 0,
    email: 0,
    url: 0,
    account: 0,
    term: 0,
  }
  /** Lower-cased originals that must not survive. */
  readonly secrets = new Set<string>()

  get(kind: string, original: string, make: (n: number) => string): string {
    let map = this.maps.get(kind)
    if (!map) this.maps.set(kind, (map = new Map()))
    const key = original.toLowerCase()
    let value = map.get(key)
    if (value === undefined) {
      value = make(map.size + 1)
      map.set(key, value)
    }
    return value
  }

  count(kind: string) {
    this.counts[kind] = (this.counts[kind] ?? 0) + 1
  }
}

function fakeGuid(n: number): string {
  const hex = n.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

class Sanitizer {
  readonly p = new Pseudonyms()
  private terms: { re: RegExp; original: string }[] = []

  constructor(terms: readonly string[]) {
    for (const t of terms) this.addTerm(t)
  }

  addTerm(term: string) {
    const t = term.trim()
    if (!t || this.terms.some((x) => x.original.toLowerCase() === t.toLowerCase())) return
    this.terms.push({ re: new RegExp(escapeRe(t), 'gi'), original: t })
    this.p.secrets.add(t.toLowerCase())
    // Longest first, so "Acme Corp" is replaced before "Acme".
    this.terms.sort((a, b) => b.original.length - a.original.length)
  }

  /** First pass over unescaped text: learn names that must also vanish from free text. */
  learn(text: string) {
    const add = (name: string | undefined) => {
      if (name && name.length >= 3 && !GENERIC.has(name.toLowerCase())) this.addTerm(name)
    }
    for (const m of text.matchAll(USER_DIR)) add(m[1])
    for (const m of text.matchAll(UNC_HOST)) add(m[1])
    for (const m of text.matchAll(ONEDRIVE_ORG)) add(m[1]?.trim())
    for (const m of text.matchAll(EMAIL)) {
      const [local, domain = ''] = m[0].split('@')
      add(local)
      add(domain.split('.')[0])
    }
    for (const m of text.matchAll(ACCOUNT)) {
      add(m[1])
      add(m[2])
    }
    for (const m of text.matchAll(URL_RE)) {
      const [, scheme = '', host = ''] = /^(\w+):\/\/([^/:?#]*)/.exec(m[0]) ?? []
      // Web hosts end in a public suffix; file:// hosts are bare machine names.
      const labels = host.split('.')
      for (const label of scheme.toLowerCase() === 'file' ? labels : labels.slice(0, -1)) {
        if (!HOST_NOISE.has(label.toLowerCase())) add(label)
      }
      for (const site of m[0].matchAll(SHAREPOINT_SITE)) add(safeDecode(site[1]!))
    }
  }

  private segment(seg: string, isLast: boolean): string {
    if (/^[A-Za-z]:$/.test(seg) || GENERIC.has(seg.toLowerCase()) || seg === '') return seg
    const ext = isLast ? /(\.[A-Za-z0-9]{1,5})(\.\.\.)?$/.exec(seg) : null
    if (ext) {
      const stem = seg.slice(0, seg.length - ext[0].length)
      return this.p.get('file', stem, (n) => `file${n}`) + ext[1]! + (ext[2] ?? '')
    }
    const dots = seg.endsWith('...') ? '...' : ''
    const core = dots ? seg.slice(0, -3) : seg
    return this.p.get('dir', core, (n) => `dir${n}`) + dots
  }

  private path(match: string, backslashSep: string): string {
    this.p.count('path')
    // C:/x and //host/share use forward slashes; everything else uses the (maybe escaped) backslash.
    const sep = /^(?:[A-Za-z]:\/|\/\/)/.test(match) ? '/' : backslashSep
    const unc = match.startsWith(sep + sep)
    const body = unc ? match.slice(sep.length * 2) : match
    const parts = body.split(sep)
    const mapped = parts.map((seg, i) => {
      if (seg === '') return seg
      if (unc && i === 0) return this.p.get('host', seg, (n) => `host${n}`)
      if (unc && i === 1) return this.p.get('share', seg, (n) => `share${n}`)
      return this.segment(seg, i === parts.length - 1)
    })
    return (unc ? sep + sep : '') + mapped.join(sep)
  }

  /**
   * Sanitizes one string. `escaped` means backslashes are JSON-escaped (`\\`),
   * used for cells whose JSON could not be parsed.
   */
  text(input: string, escaped = false): string {
    const sep = escaped ? '\\\\' : '\\'
    const s = escapeRe(sep)
    let out = input.replace(GUID, (g) => {
      this.p.count('guid')
      this.p.secrets.add(g.toLowerCase())
      return this.p.get('guid', g, fakeGuid)
    })
    out = out.replace(URL_RE, (u) => {
      this.p.count('url')
      const scheme = u.slice(0, u.indexOf(':')).toLowerCase()
      return this.p.get('url', u, (n) =>
        scheme === 'file' ? `file://host${n}/path${n}` : `https://host${n}.example.test/path${n}`,
      )
    })
    out = out.replace(EMAIL, (e) => {
      this.p.count('email')
      return this.p.get('email', e, (n) => `user${n}@example.test`)
    })
    // Greedy up to a Windows-forbidden character: in free text a path may run into the
    // following words, which then get pseudonymized too. Over-replacing is the safe side.
    // Drive paths take either separator; `//host` is a UNC path unless a URL scheme precedes it.
    const pathRe = new RegExp(
      String.raw`(?:(?<!\w)[A-Za-z]:(?:${s}|/)|${s}${s}|(?<![:\w/])//)[^:*?"<>|\r\n]*`,
      'g',
    )
    out = out.replace(pathRe, (m) => this.path(m, sep))
    out = out.replace(ACCOUNT, (_m, _domain: string, user: string) => {
      this.p.count('account')
      return `DOMAIN${sep}` + this.p.get('account', user, (n) => `account${n}`)
    })
    for (const { re, original } of this.terms) {
      out = out.replace(re, () => {
        this.p.count('term')
        return this.p.get('term', original, (n) => `term${n}`)
      })
    }
    return out
  }

  /** Sanitizes a JSON cell structurally; falls back to escaped text when it is not valid JSON. */
  json(cell: string): string {
    if (cell.trim() === '') return cell
    let value: unknown
    try {
      value = JSON.parse(cell)
    } catch {
      return this.text(cell, true)
    }
    const walk = (v: unknown): unknown => {
      if (typeof v === 'string') return this.text(v)
      if (Array.isArray(v)) return v.map(walk)
      if (v && typeof v === 'object') {
        // Keys can carry data too (dictionaries, data-table columns); generic keys pass unchanged.
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [this.text(k), walk(x)]))
      }
      return v
    }
    return JSON.stringify(walk(value))
  }
}

const JSON_COLUMNS = new Set(['inputs', 'outputs'])

function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsOf)
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [k, ...stringsOf(v)])
  }
  return []
}

export function sanitizeLog(csv: string, options: SanitizeOptions): SanitizeResult {
  const bom = csv.charCodeAt(0) === 0xfeff
  const parsed = Papa.parse<string[]>(bom ? csv.slice(1) : csv, { skipEmptyLines: 'greedy' })
  const [header = [], ...rows] = parsed.data
  const jsonCols = new Set(
    header.flatMap((h, i) => (JSON_COLUMNS.has(h.trim().toLowerCase()) ? [i] : [])),
  )

  const fileMatch =
    /^(.+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(.+?)(\.csv)?$/i.exec(
      options.fileName,
    )

  const s = new Sanitizer(options.terms ?? [])
  // JSON cells are learned from their decoded strings so paths match the plain-text patterns.
  for (const r of rows) {
    r.forEach((cell, i) => {
      if (!jsonCols.has(i)) return s.learn(cell)
      try {
        stringsOf(JSON.parse(cell)).forEach((x) => s.learn(x))
      } catch {
        s.learn(cell.replace(/\\\\/g, '\\'))
      }
    })
  }

  const out = rows.map((r) => r.map((cell, i) => (jsonCols.has(i) ? s.json(cell) : s.text(cell))))
  const body = Papa.unparse({ fields: header, data: out }, { newline: '\r\n' })

  let fileName: string
  if (fileMatch) {
    const flow = options.flowName ?? s.text(fileMatch[1]!)
    const guid = s.text(fileMatch[2]!)
    fileName = `${flow}_${guid}_${fileMatch[3]!}.csv`
  } else {
    fileName = (options.flowName ?? s.text(options.fileName.replace(/\.csv$/i, ''))) + '.csv'
  }

  const result = (bom ? '\uFEFF' : '') + body
  const haystack = (result + fileName).toLowerCase()
  const residual = [...s.p.secrets].filter((x) => haystack.includes(x)).sort()
  return { csv: result, fileName, counts: s.p.counts, residual }
}
