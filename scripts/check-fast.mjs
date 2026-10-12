// Lints only files changed against HEAD (staged, unstaged and untracked).
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)

let changed
try {
  changed = new Set([
    ...git('diff', '--name-only', '--diff-filter=ACMR', 'HEAD'),
    ...git('diff', '--name-only', '--cached', '--diff-filter=ACMR'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ])
} catch {
  // No HEAD yet (first commit): lint everything tracked or staged.
  changed = new Set([
    ...git('diff', '--name-only', '--cached', '--diff-filter=ACMR'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ])
}

const files = [...changed].filter((f) => /\.(ts|tsx|js|mjs)$/.test(f) && existsSync(f))
if (files.length === 0) {
  console.log('check:fast: no changed source files to lint')
  process.exit(0)
}
try {
  execFileSync('npx', ['eslint', '--max-warnings=0', ...files], { stdio: 'inherit' })
} catch {
  process.exit(1)
}
