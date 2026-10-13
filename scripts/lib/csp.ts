// Content-Security-Policy for the shipped single-file HTML (M8). The build hashes the one
// inline script and stylesheet, allows nothing else, and refuses a page that would load any
// file or URL, so the reviewer's copy can never reach the network.
import { createHash } from 'node:crypto'

export interface InlineHashes {
  /** CSP source expressions, e.g. `'sha256-…'`, one per inline element. */
  scripts: string[]
  styles: string[]
}

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
const STYLE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi
// Attributes that make the browser load or submit to a URL. `data` is <object data>, never
// data-*; `xlink:href` is SVG's namespaced form of href.
const URL_ATTR =
  /\s(?:xlink:)?(src|href|srcset|poster|data|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi

const hash = (text: string) =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`

/** Hashes of every inline `<script>` (without `src`) and `<style>` body, exactly as written. */
export function inlineHashes(html: string): InlineHashes {
  const scripts = [...html.matchAll(SCRIPT)]
    .filter((m) => !/\ssrc\s*=/i.test(m[1]!))
    .map((m) => hash(m[2]!))
  const styles = [...html.matchAll(STYLE)].map((m) => hash(m[1]!))
  return { scripts, styles }
}

/**
 * Every URL in the page's tags that would load or submit something: `src`, `href` (and SVG
 * `xlink:href`), each `srcset` candidate, `poster`, `<object data>` and `<form action>`, except
 * `data:` URIs and in-page `#` links. Script and style bodies are skipped, since text inside
 * them is not markup.
 */
export function externalReferences(html: string): string[] {
  const markup = html.replace(SCRIPT, '<script$1></script>').replace(STYLE, '<style></style>')
  const refs: string[] = []
  for (const tag of markup.match(/<[a-z][^>]*>/gi) ?? []) {
    for (const m of tag.matchAll(URL_ATTR)) {
      const value = (m[2] ?? m[3] ?? m[4] ?? '').trim()
      // srcset lists "url descriptor" candidates separated by a comma and whitespace (a data:
      // URI's own comma has no whitespace after it); each candidate's URL is checked.
      const urls =
        m[1]!.toLowerCase() === 'srcset'
          ? value.split(/,\s+/).map((c) => c.trim().split(/\s+/)[0] ?? '')
          : [value]
      for (const url of urls) if (url && !/^(data:|#)/i.test(url)) refs.push(url)
    }
  }
  return refs
}

/**
 * Nothing loads by default; only the hashed script and stylesheet run. React sets `style`
 * attributes, so those stay allowed; `style-src 'unsafe-inline'` is the fallback for
 * browsers without `style-src-elem`/`-attr`, which ignore it when they have them.
 */
export function contentSecurityPolicy({ scripts, styles }: InlineHashes): string {
  return [
    "default-src 'none'",
    `script-src ${scripts.join(' ')}`,
    "style-src 'unsafe-inline'",
    `style-src-elem ${styles.join(' ') || "'none'"}`,
    "style-src-attr 'unsafe-inline'",
    'img-src data:',
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ')
}

/**
 * The page with a CSP `<meta>` right after its charset, before any script. Throws when the
 * page would load anything from outside itself, has no inline script, or already has a policy.
 */
export function addCsp(html: string): string {
  if (/http-equiv\s*=\s*["']?Content-Security-Policy/i.test(html)) {
    throw new Error('The page already has a Content-Security-Policy.')
  }
  const external = externalReferences(html)
  if (external.length > 0) {
    throw new Error(`The page must be self-contained but loads: ${external.join(', ')}`)
  }
  const hashes = inlineHashes(html)
  if (hashes.scripts.length === 0) throw new Error('The page has no inline script to allow.')
  const charset = /<meta\s+charset[^>]*>/i.exec(html)
  if (!charset) throw new Error('The page has no <meta charset> to put the policy after.')
  const at = charset.index + charset[0].length
  const indent = /\n([ \t]*)<meta\s+charset/i.exec(html)?.[1] ?? ''
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(hashes)}" />`
  return `${html.slice(0, at)}\n${indent}${meta}${html.slice(at)}`
}
