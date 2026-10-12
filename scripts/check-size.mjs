// Fails when the built single-file HTML exceeds the 1.5 MB budget.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BUDGET_BYTES = 1.5 * 1024 * 1024
const dist = 'dist'
const files = readdirSync(dist).filter((f) => f.endsWith('.html'))
if (files.length === 0) {
  console.error('check-size: no HTML file in dist/; run the build first')
  process.exit(1)
}
let failed = false
for (const f of files) {
  const size = statSync(join(dist, f)).size
  const ok = size <= BUDGET_BYTES
  failed ||= !ok
  console.log(
    `check-size: ${f} ${(size / 1024).toFixed(1)} KiB / ${(BUDGET_BYTES / 1024).toFixed(0)} KiB ${ok ? 'OK' : 'OVER BUDGET'}`,
  )
}
process.exit(failed ? 1 : 0)
