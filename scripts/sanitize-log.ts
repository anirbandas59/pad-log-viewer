// Turns a real PAD log into a safe test fixture.
//
//   npm run sanitize -- <input.csv> [--out-dir tests/fixtures] [--terms "Client A,VM-PROD-01"] [--flow Name]
//
// Writes the sanitized CSV under --out-dir with the run GUID replaced in its name,
// prints replacement counts, and exits non-zero if any known secret survives.
// Always read the output before committing it: free-text names the sanitizer
// cannot recognise must be passed with --terms.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parseArgs } from 'node:util'
import { sanitizeLog } from './lib/sanitize.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'out-dir': { type: 'string', default: 'tests/fixtures' },
    terms: { type: 'string', default: '' },
    flow: { type: 'string' },
  },
})

const input = positionals[0]
if (!input || positionals.length > 1) {
  console.error(
    'Usage: npm run sanitize -- <input.csv> [--out-dir dir] [--terms "a,b"] [--flow Name]',
  )
  process.exit(2)
}

const result = sanitizeLog(readFileSync(input, 'utf8'), {
  fileName: basename(input),
  terms: values.terms
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
  flowName: values.flow,
})

if (result.residual.length > 0) {
  console.error(
    `Refusing to write: ${result.residual.length} sensitive value(s) survived sanitizing.`,
  )
  process.exit(1)
}

mkdirSync(values['out-dir'], { recursive: true })
const out = join(values['out-dir'], result.fileName)
writeFileSync(out, result.csv)
console.log(`Wrote ${out}`)
console.log(
  Object.entries(result.counts)
    .map(([k, n]) => `${k}: ${n}`)
    .join(', '),
)
console.log('Review the file before committing it.')
