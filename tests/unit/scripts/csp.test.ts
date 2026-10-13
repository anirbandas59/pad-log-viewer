// M8: the shipped HTML carries a Content-Security-Policy that blocks every network request,
// and the build refuses anything that is not inlined.
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  addCsp,
  contentSecurityPolicy,
  externalReferences,
  inlineHashes,
} from '../../../scripts/lib/csp.ts'

const sha = (text: string) =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`

const SCRIPT = 'var a="<a href=\\"https://example.com\\">x</a>";console.log(a)'
const STYLE = ':root{--x:1}body{background:url(data:image/png;base64,AAAA)}'
const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" />
    <title>PAD Log Viewer</title>
    <script type="module" crossorigin>${SCRIPT}</script>
    <style rel="stylesheet" crossorigin>${STYLE}</style>
  </head>
  <body><div id="root"></div><a href="#main">Skip</a></body>
</html>`

describe('inlineHashes', () => {
  it('hashes each inline script and style body exactly as written', () => {
    expect(inlineHashes(PAGE)).toEqual({ scripts: [sha(SCRIPT)], styles: [sha(STYLE)] })
  })

  it('hashes non-ASCII text as UTF-8', () => {
    const body = 'console.log("請求書 ü")'
    expect(inlineHashes(`<script>${body}</script>`).scripts).toEqual([sha(body)])
  })
})

describe('externalReferences', () => {
  it('also reports srcset, poster, object data and form action, but not data-* attributes', () => {
    const html = PAGE.replace(
      '<title>',
      '<img srcset="a.png 1x, b.png 2x"><video poster="p.jpg"></video>' +
        '<object data="https://x.example/o.swf"></object><form action="/submit"></form>' +
        '<div data-testid="run" data="data:,ok"></div><title>',
    )
    expect(externalReferences(html)).toEqual([
      'a.png 1x, b.png 2x',
      'p.jpg',
      'https://x.example/o.swf',
      '/submit',
    ])
  })

  it('accepts data: URIs and in-page links, and ignores text inside scripts and styles', () => {
    expect(externalReferences(PAGE)).toEqual([])
  })

  it('reports every file or URL the page would load', () => {
    const html = PAGE.replace(
      '<title>',
      '<link rel="icon" href="./favicon.svg" /><script src="https://cdn.example/x.js"></script>' +
        "<img src='logo.png'><link rel=stylesheet href=//fonts.example/a.css><title>",
    )
    expect(externalReferences(html)).toEqual([
      './favicon.svg',
      'https://cdn.example/x.js',
      'logo.png',
      '//fonts.example/a.css',
    ])
  })
})

describe('contentSecurityPolicy', () => {
  const build = () => {
    const policy = contentSecurityPolicy({ scripts: ["'sha256-AAA='"], styles: ["'sha256-BBB='"] })
    const directives = new Map(
      policy.split(';').map((d) => {
        const [name, ...values] = d.trim().split(/\s+/)
        return [name!, values.join(' ')] as const
      }),
    )
    return { policy, directives }
  }

  it('blocks everything by default, every network request included', () => {
    const { directives } = build()
    expect(directives.get('default-src')).toBe("'none'")
    expect(directives.get('connect-src')).toBe("'none'")
    expect(directives.get('base-uri')).toBe("'none'")
    expect(directives.get('form-action')).toBe("'none'")
    expect(directives.get('object-src')).toBe("'none'")
  })

  it('runs only the hashed inline script: no unsafe-inline, no eval', () => {
    const { policy, directives } = build()
    expect(directives.get('script-src')).toBe("'sha256-AAA='")
    expect(policy).not.toMatch(/unsafe-eval/)
  })

  it('loads only the hashed stylesheet; style attributes stay allowed for React', () => {
    const { directives } = build()
    expect(directives.get('style-src-elem')).toBe("'sha256-BBB='")
    expect(directives.get('style-src-attr')).toBe("'unsafe-inline'")
  })

  it('allows images only from data: URIs (the inlined icon)', () => {
    expect(build().directives.get('img-src')).toBe('data:')
  })
})

describe('addCsp', () => {
  it('puts the policy right after the charset, before any script', () => {
    const out = addCsp(PAGE)
    const meta = out.indexOf('<meta http-equiv="Content-Security-Policy"')
    expect(meta).toBeGreaterThan(out.indexOf('<meta charset="UTF-8" />'))
    expect(meta).toBeLessThan(out.indexOf('<script'))
    expect(out).toContain(sha(SCRIPT))
    expect(out).toContain(sha(STYLE))
    expect(out.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '')).toBe(PAGE)
  })

  it('refuses a page that loads anything from outside itself', () => {
    expect(() =>
      addCsp(PAGE.replace('data:image/svg+xml,%3Csvg%3E%3C/svg%3E', './favicon.svg')),
    ).toThrow(/\.\/favicon\.svg/)
  })

  it('refuses a page with no inline script or that already has a policy', () => {
    expect(() => addCsp(PAGE.replace(/<script[\s\S]*<\/script>/, ''))).toThrow(/script/)
    expect(() => addCsp(addCsp(PAGE))).toThrow(/already/)
  })
})
