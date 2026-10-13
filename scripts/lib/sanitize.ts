// Pure sanitizer logic for scripts/sanitize-log.ts; no Node APIs so tests can import it.
//
// Replaces GUIDs, Windows/UNC paths, URLs, e-mail addresses, DOMAIN\account names,
// user names found in those, and caller-supplied terms with stable pseudonyms, so
// the same original maps to the same replacement across the whole file. Timestamps,
// indexes, statuses, module/action names, CSV shape and JSON validity are kept.
import Papa from 'papaparse'
import { parseFileName } from '../../src/core/csv/fileName.ts'
import { splitSepLine } from '../../src/core/csv/parseCsv.ts'

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
/**
 * Rest of a path or file:// address. Names may contain spaces and punctuation, but no
 * character is taken where the next item on the line starts (a drive, a URL scheme or a
 * UNC path), whatever precedes it: quotes, brackets, commas. Otherwise the match would
 * swallow that item's prefix and leave its remainder unrecognised. Stops at a
 * Windows-forbidden character. `s` is the (maybe JSON-escaped) backslash separator.
 */
function pathRest(s: string): string {
  const nextItem = [
    String.raw`(?<!\w)[A-Za-z]:`,
    String.raw`(?<![\w+.-])[A-Za-z][\w+.-]*:\/\/`,
    String.raw`(?<![\w\\/])${s}${s}`,
    String.raw`(?<![\w:/])\/\/`,
  ].join('|')
  return String.raw`(?:(?!${nextItem})[^:*?"<>|\r\n])*`
}
/**
 * file:// addresses are often typed by hand with spaces, so they follow the path rule
 * (optionally file://host/C: or file:///C:); web URLs stop at whitespace. Built per call
 * from the separator `s`: in escaped (malformed JSON) cells every separator is already
 * `\\`, which the plain-text UNC guard would read as the start of the next item.
 */
function urlRe(s: string): RegExp {
  return new RegExp(
    String.raw`\bfile:\/\/(?:(?:[\w.-]*\/)?[A-Za-z]:)?${pathRest(s)}|\bhttps?:\/\/[^\s"'<>]*`,
    'gi',
  )
}
// learn() runs on unescaped text, so it uses the plain-text separator.
const URL_RE = urlRe(String.raw`\\`)
// One path segment: no separator and no Windows-forbidden character.
const SEG = String.raw`[^\\/:*?"<>|\r\n]+`
// DOMAIN\account in any case. The domain must not continue a path (no separator, drive
// colon or word character before it) and the account must not be followed by another
// segment, so C:\Users\jdoe\x is left to the path rules.
// The trailing lookahead repeats the account characters so a backtracked, shortened
// match (Data\Invoice from Data\Invoices\a.pdf) cannot slip through.
const ACCOUNT = /(?<![\w\\/:.$-])([A-Za-z][A-Za-z0-9-]{1,14})\\([A-Za-z][\w.$-]*)(?![\w.$\\/-])/g
const USER_DIR = new RegExp(String.raw`(?<!\w)[A-Za-z]:[\\/]Users[\\/](${SEG})`, 'gi')
// \\host\share or //host/share; a preceding colon means a URL scheme, handled by URL_RE.
const UNC_HOST = new RegExp(String.raw`(?<![\\/:])(?:\\\\|//)(${SEG})[\\/]`, 'g')
const ONEDRIVE_ORG = /OneDrive - ([^\\/:*?"<>|\r\n]+)/gi
// E-mail display names: "Das, Anirban ORG" <a@b.c>, or Jane Doe <a@b.c> at the start of a value
// or after a list separator (an unquoted name mid-sentence would learn ordinary words).
const DISPLAY_NAME =
  /(?:"([^"<>\r\n]{2,80})"|(?:^|[,;:]\s*)([A-Za-z][^"<>\r\n,;:]{1,60}?))\s*<\s*[\w.+-]+@[\w-]+(?:\.[\w-]+)+\s*>/g
// Long base64 or hex runs: encoded documents, OCR results, mailbox item ids, hashes, ciphertext.
// PAD cuts long values and appends "...", so a run right before that marker counts from 20 chars.
const BLOB =
  /(?<![A-Za-z0-9+/=_-])(?:[A-Za-z0-9+/_-]{40,}={0,2}|[A-Za-z0-9+/_-]{20,39}(?= ?\.\.\.))(?![A-Za-z0-9+/=_-])/g
const SHAREPOINT_SITE = /\/(?:sites|teams)\/([^/?#\s"'<>]+)/gi
// Host labels that identify nobody; learning them would also rewrite our own pseudonyms.
const HOST_NOISE = new Set(['www', 'com', 'net', 'org', 'co', 'example', 'test', 'localhost'])
// Extra labels skipped for web hosts only: as substring terms they would mangle ordinary
// names (api would turn Call_API into Call_term1). file:// hosts are bare machine names,
// and a machine called portal or dev must still be learned.
const WEB_HOST_NOISE = new Set([
  ...HOST_NOISE,
  'api',
  'app',
  'apps',
  'portal',
  'login',
  'auth',
  'mail',
  'cdn',
  'static',
  'dev',
  'prod',
  'sharepoint',
  'onmicrosoft',
  'microsoft',
  'azurewebsites',
  'blob',
  'core',
  'windows',
  'cloud',
])

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

/**
 * Wraps a replacer so trailing whitespace stays outside the replacement. A spaced match can
 * end in "… to "; replacing the space too would glue the pseudonym to the next item
 * (path1C:\…), and that drive is then no longer recognised.
 */
function keepTrailingSpace(replace: (match: string) => string): (match: string) => string {
  return (match) => {
    const core = match.trimEnd()
    return core === '' ? match : replace(core) + match.slice(core.length)
  }
}

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
    blob: 0,
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

  private readonly keep: ReadonlySet<string>

  /**
   * @param terms caller-supplied words to remove everywhere
   * @param keep lower-cased words never learned as names (the column headers: a folder called
   *   Inputs must not turn the Inputs header into a "surviving secret")
   */
  constructor(terms: readonly string[], keep: ReadonlySet<string> = new Set()) {
    this.keep = keep
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
      const lower = name?.toLowerCase() ?? ''
      if (name && name.length >= 3 && !GENERIC.has(lower) && !this.keep.has(lower)) {
        this.addTerm(name)
      }
    }
    for (const m of text.matchAll(USER_DIR)) add(m[1])
    for (const m of text.matchAll(UNC_HOST)) add(m[1])
    for (const m of text.matchAll(ONEDRIVE_ORG)) add(m[1]?.trim())
    for (const m of text.matchAll(DISPLAY_NAME)) {
      for (const word of (m[1] ?? m[2] ?? '').split(/[\s,]+/)) add(word)
    }
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
      const isFile = scheme.toLowerCase() === 'file'
      const noise = isFile ? HOST_NOISE : WEB_HOST_NOISE
      for (const label of isFile ? labels : labels.slice(0, -1)) {
        if (!noise.has(label.toLowerCase())) add(label)
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
    out = out.replace(
      urlRe(s),
      keepTrailingSpace((u) => {
        this.p.count('url')
        const scheme = u.slice(0, u.indexOf(':')).toLowerCase()
        return this.p.get('url', u, (n) =>
          scheme === 'file' ? `file://host${n}/path${n}` : `https://host${n}.example.test/path${n}`,
        )
      }),
    )
    out = out.replace(EMAIL, (e) => {
      this.p.count('email')
      return this.p.get('email', e, (n) => `user${n}@example.test`)
    })
    // Greedy up to a Windows-forbidden character: in free text a path may run into the
    // following words, which then get pseudonymized too. Over-replacing is the safe side.
    // Drive paths take either separator; `//host` is a UNC path unless a URL scheme precedes it.
    const pathRe = new RegExp(
      String.raw`(?:(?<!\w)[A-Za-z]:(?:${s}|/)|${s}${s}|(?<![:\w/])//)${pathRest(s)}`,
      'g',
    )
    out = out.replace(
      pathRe,
      keepTrailingSpace((m) => this.path(m, sep)),
    )
    out = out.replace(BLOB, (b) => {
      // Needs letters and digits, and few slashes, so long names and joined paths are kept.
      if (!/\d/.test(b) || !/[A-Za-z]/.test(b) || (b.match(/\//g)?.length ?? 0) > b.length / 10) {
        return b
      }
      this.p.count('blob')
      return this.p.get('blob', b, (n) => `blob${n}`)
    })
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
        // Distinct keys can map to the same pseudonym (Acme/acme), so suffix repeats to keep every entry.
        // A null-prototype object keeps keys like constructor and __proto__ as plain data.
        const out = Object.create(null) as Record<string, unknown>
        for (const [k, x] of Object.entries(v)) {
          const base = PAYLOAD_KEYS.has(k) ? k : this.text(k)
          let key = base
          for (let n = 2; Object.hasOwn(out, key); n++) key = `${base}_${n}`
          out[key] = walk(x)
        }
        return out
      }
      return v
    }
    return JSON.stringify(walk(value))
  }
}

const JSON_COLUMNS = new Set(['inputs', 'outputs'])
// PAD's parameter structure; rewriting these would break parsePayload on the fixture.
const PAYLOAD_KEYS = new Set(['localizedName', 'value', 'variableName'])

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
  // Portal exports start with an Excel sep= line; it is kept verbatim in the output.
  const sep = splitSepLine(csv)
  const parsed = Papa.parse<string[]>(sep.body, {
    skipEmptyLines: 'greedy',
    // Papa auto-detects when there is no sep= hint; the output reuses what it found.
    ...(sep.delimiter ? { delimiter: sep.delimiter } : {}),
  })
  const delimiter = sep.delimiter ?? parsed.meta.delimiter
  const [header = [], ...rows] = parsed.data
  const jsonCols = new Set(
    header.flatMap((h, i) => (JSON_COLUMNS.has(h.trim().toLowerCase()) ? [i] : [])),
  )

  const nameInfo = parseFileName(options.fileName)

  const s = new Sanitizer(options.terms ?? [], new Set(header.map((h) => h.trim().toLowerCase())))
  // The original flow name can appear in the body too (messages, Run flow inputs); remove it
  // there as well, whether or not --flow renames the fixture.
  if (nameInfo.matched && nameInfo.flowName.length >= 3) s.addTerm(nameInfo.flowName)
  // JSON cells are learned from their decoded strings so paths match the plain-text patterns.
  for (const r of rows) {
    r.forEach((cell, i) => {
      if (!jsonCols.has(i)) return s.learn(cell)
      try {
        const value: unknown = JSON.parse(cell)
        stringsOf(value).forEach((x) => s.learn(x))
        // Values read from environment variables (machine and user names) are removed everywhere.
        for (const prm of Object.values(value && typeof value === 'object' ? value : {})) {
          const { localizedName, value: v } = (prm ?? {}) as {
            localizedName?: unknown
            value?: unknown
          }
          if (
            localizedName === 'Environment variable value' &&
            typeof v === 'string' &&
            v.trim().length >= 3
          ) {
            s.addTerm(v)
          }
        }
      } catch {
        s.learn(cell.replace(/\\\\/g, '\\'))
      }
    })
  }

  const out = rows.map((r) => r.map((cell, i) => (jsonCols.has(i) ? s.json(cell) : s.text(cell))))
  const body = Papa.unparse({ fields: header, data: out }, { newline: '\r\n', delimiter })

  let fileName: string
  if (nameInfo.matched) {
    // The flow name can carry project ids and client process names: pseudonymise it unless
    // the caller names the fixture. Keep the original separators (- for portal exports).
    const base = nameInfo.fileName
    const sep1 = base.charAt(nameInfo.flowName.length)
    const sep2 = base.charAt(nameInfo.flowName.length + 1 + 36)
    const flow = options.flowName ?? s.p.get('flow', nameInfo.flowName, (n) => `flow${n}`)
    const guid = s.text(nameInfo.runId!)
    // Keep the export timestamp only in the portal shape; anything else may be free text.
    const exported = /^\d{8}T\d{6}Z$/i.test(nameInfo.exportedAt!)
      ? nameInfo.exportedAt!
      : s.p.get('export', nameInfo.exportedAt!, (n) => `export${n}`)
    fileName = `${flow}${sep1}${guid}${sep2}${exported}.csv`
  } else {
    fileName = (options.flowName ?? s.text(options.fileName.replace(/\.csv$/i, ''))) + '.csv'
  }

  const result = (bom ? '\uFEFF' : '') + sep.line + body
  const haystack = (result + fileName).toLowerCase()
  const residual = [...s.p.secrets].filter((x) => haystack.includes(x)).sort()
  return { csv: result, fileName, counts: s.p.counts, residual }
}
