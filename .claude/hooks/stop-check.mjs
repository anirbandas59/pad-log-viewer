// Stop, cloud only: keep working until `npm run check` passes; give up after 3 consecutive failures.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isCloud, projectDir, readInput, sh } from './lib.mjs'

const MAX_FAILURES = 3
if (!isCloud) process.exit(0)
await readInput().catch(() => ({}))

const stateDir = join(projectDir, '.claude', '.state')
const stateFile = join(stateDir, 'stop-check.json')
let state = { lastGreen: null, failures: 0 }
try {
  state = { ...state, ...JSON.parse(readFileSync(stateFile, 'utf8')) }
} catch {
  // First run.
}
const save = () => {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(stateFile, JSON.stringify(state))
}

const fingerprint = createHash('sha256')
  .update(sh('git', ['rev-parse', 'HEAD']))
  .update(sh('git', ['status', '--porcelain']))
  .update(sh('git', ['diff', 'HEAD'], { maxBuffer: 64 * 1024 * 1024 }))
  .digest('hex')
if (fingerprint === state.lastGreen) process.exit(0)

try {
  sh('npm', ['run', 'check'], { maxBuffer: 64 * 1024 * 1024, timeout: 900_000 })
  state = { lastGreen: fingerprint, failures: 0 }
  save()
  process.exit(0)
} catch (err) {
  state.failures += 1
  const tail = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(-30).join('\n')
  if (state.failures >= MAX_FAILURES) {
    state.failures = 0
    save()
    process.stdout.write(
      JSON.stringify({
        systemMessage: `npm run check failed ${MAX_FAILURES} times in a row; stopping. Report the failure to the user instead of retrying.`,
      }),
    )
    process.exit(0)
  }
  save()
  process.stderr.write(
    `npm run check failed (attempt ${state.failures}/${MAX_FAILURES}). Fix it before stopping:\n${tail}\n`,
  )
  process.exit(2)
}
