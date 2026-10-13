// Structural leak guard for real fixtures: everything that looks like client data must be a
// sanitizer pseudonym. Cannot catch free-text names (pass those to the sanitizer's --terms),
// but fails if a fixture is added or re-sanitized without the sanitizer's rules applied.
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const DIR = 'tests/fixtures/real'
const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.csv'))

const DATE = /^(?:19|20)\d\d(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:\d{6})?$/

function offending(text: string): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  const add = (kind: string, items: string[]) => {
    if (items.length > 0) found[kind] = [...new Set(items)].slice(0, 5)
  }
  add(
    'e-mail',
    (text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []).filter((e) => !/@example\.test$/i.test(e)),
  )
  add(
    'web URL',
    (text.match(/\bhttps?:\/\/[^\s"'<>\\]+/gi) ?? []).filter(
      (u) => !/^https:\/\/host\d+\.example\.test\/path\d+/i.test(u),
    ),
  )
  add(
    'file URL',
    (text.match(/\bfile:\/\/[^\s"'<>\\]*/gi) ?? []).filter(
      (u) => !/^file:\/\/host\d+\/path\d+/i.test(u),
    ),
  )
  add(
    'GUID',
    (text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []).filter(
      (g) => !/^00000000-0000-4000-8000-[0-9a-f]{12}$/i.test(g),
    ),
  )
  add(
    'user folder',
    [...text.matchAll(/Users[\\/]+([^\\/"]+)/g)]
      .map((m) => m[1]!)
      .filter((u) => !/^(?:dir|term|file)\d+$/.test(u) && !u.startsWith('<<')),
  )
  add(
    'OneDrive org',
    [...text.matchAll(/OneDrive - ([^\\/"]+)/g)]
      .map((m) => m[1]!.trim())
      .filter((o) => !/^(?:dir|term)\d+$/.test(o)),
  )
  add(
    'long digit run',
    (text.match(/(?<!\d)\d{8,}(?!\d)/g) ?? []).filter(
      // Same-length pseudonyms are zero-padded counters (00000000 is a pseudonym GUID group).
      (d) => !/^0+[1-9]?\d{0,4}$/.test(d) && !DATE.test(d),
    ),
  )
  add(
    'encoded blob',
    (text.match(/[A-Za-z0-9+/_-]{40,}/g) ?? []).filter((b) => {
      // Digits that belong to the sanitizer's own pseudonyms (term4, dir12) don't make a blob.
      const rest = b.replace(
        /(?:term|dir|file|host|share|account|path|flow|export|user|blob)\d+/g,
        '',
      )
      return (
        /\d/.test(rest) && /[A-Za-z]/.test(rest) && (b.match(/\//g)?.length ?? 0) <= b.length / 10
      )
    }),
  )
  return found
}

describe('real fixtures contain only pseudonyms where client data would be', () => {
  it('has at least one real fixture to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(file, () => {
      expect(offending(readFileSync(`${DIR}/${file}`, 'utf8'))).toEqual({})
    })
  }

  it('catches each kind of leak (self-test)', () => {
    const leaky = [
      'a@corp.com',
      'https://intranet.corp.com/x',
      'file://fs01/share/a.pdf',
      '4c766126-8e2d-47cc-bc49-6f15ac34b689',
      'C:\\Users\\jdoe\\a.txt',
      'C:/Users/mallory/b.txt',
      'OneDrive - Acme Corp',
      '050003521107',
      'AAMkADA4MjhlZTQyLTUzOGQtNDg2My1iNWJiLTA0NGVlNGNiZDA4YgBGAAAAAA',
    ].join(' ')
    expect(Object.keys(offending(leaky)).sort()).toEqual(
      [
        'GUID',
        'OneDrive org',
        'e-mail',
        'encoded blob',
        'file URL',
        'long digit run',
        'user folder',
        'web URL',
      ].sort(),
    )
    expect(Object.keys(offending('C:/Users/mallory/b.txt'))).toEqual(['user folder'])
    expect(
      offending('user1@example.test https://host1.example.test/path1 20261012 000000000005'),
    ).toEqual({})
  })
})
