// PostToolUse(Edit|Write): format and auto-fix the edited file; report remaining lint errors to Claude.
import { existsSync } from 'node:fs'
import { context, readInput, sh } from './lib.mjs'

const input = await readInput().catch(() => ({}))
const file = input.tool_input?.file_path
if (!file || !existsSync(file) || file.includes('node_modules')) process.exit(0)

if (/\.(ts|tsx|js|mjs|json|css|md|ya?ml|html)$/.test(file)) {
  try {
    sh('npx', ['--no-install', 'prettier', '--write', '--ignore-unknown', file])
  } catch {
    // Prettier problems surface through lint or check:fast.
  }
}
if (/\.(ts|tsx|js|mjs)$/.test(file)) {
  try {
    sh('npx', ['--no-install', 'eslint', '--fix', '--max-warnings=0', file])
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(0, 40).join('\n')
    context('PostToolUse', `ESLint reports remaining problems in ${file}:\n${out}`)
  }
}
process.exit(0)
