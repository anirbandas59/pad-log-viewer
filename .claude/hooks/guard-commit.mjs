// PreToolUse(Bash): gate `git commit` on message format, stray CSVs and `npm run check:fast`.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deny, failClosed, projectDir, readInput, sh } from './lib.mjs'

const SUBJECT =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w./-]+\))?!?: \S.{0,71}$/
const ATTRIBUTION = /^\s*(co-authored-by|author|signed-off-by)\s*:/im
const GENERATED = /generated with \[?claude|🤖/i
const FORMAT_HELP =
  'Rewrite the commit message as Conventional Commits: `type(scope): subject` (types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert; subject <= 72 chars, imperative), then a blank line, then an optional body. Do NOT include Co-Authored-By, Author, Signed-off-by or "Generated with" lines. Then run git commit again.'

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    return s.slice(1, -1)
  return s
}

// Returns the commit message, or null when it cannot be determined (e.g. --no-edit).
function extractMessage(command) {
  const heredoc = command.match(/<<-?\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\s*\1\b/)
  if (heredoc) return heredoc[2]
  const parts = []
  for (const m of command.matchAll(
    /(?:^|\s)(?:-m|--message)(?:=|\s+)("(?:[^"\\]|\\.)*"|'[^']*'|\S+)/g,
  )) {
    parts.push(unquote(m[1]).replace(/\\"/g, '"').replace(/\\n/g, '\n'))
  }
  if (parts.length > 0) return parts.join('\n\n')
  const file = command.match(/(?:^|\s)(?:-F|--file)(?:=|\s+)(\S+)/)
  if (file) {
    const p = resolve(projectDir, unquote(file[1]))
    if (existsSync(p)) return readFileSync(p, 'utf8')
  }
  return null
}

function checkMessage(message) {
  const lines = message.replace(/\r/g, '').split('\n')
  const subject = lines[0]?.trim() ?? ''
  if (ATTRIBUTION.test(message) || GENERATED.test(message)) {
    return `Commit message contains an author/co-author/attribution line. ${FORMAT_HELP}`
  }
  if (!SUBJECT.test(subject)) {
    return `Commit subject "${subject}" is not a Conventional Commit. ${FORMAT_HELP}`
  }
  if (lines.length > 1 && lines[1].trim() !== '') {
    return `The commit body must be separated from the subject by a blank line. ${FORMAT_HELP}`
  }
  return null
}

failClosed('guard-commit', async () => {
  const { tool_input } = await readInput()
  const command = tool_input?.command ?? ''
  if (!/\bgit\s+(?:-C\s+\S+\s+)?commit\b/.test(command)) process.exit(0)

  const message = extractMessage(command)
  if (message !== null) {
    const problem = checkMessage(message)
    if (problem) deny(problem)
  }

  // Files staged before the command plus any the command itself adds (`git add … && git commit`).
  const staged = sh('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    .split('\n')
    .filter(Boolean)
  const strayCsv = staged.filter((f) => /\.csv$/i.test(f) && !f.startsWith('tests/fixtures/'))
  if (strayCsv.length > 0) {
    deny(
      `CSV files may only be committed under tests/fixtures/ (sanitized output only). Unstage: ${strayCsv.join(', ')}`,
    )
  }

  try {
    sh('npm', ['run', '--silent', 'check:fast'], { stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n')
    deny(`npm run check:fast failed; fix these errors before committing:\n${out}`)
  }
  process.exit(0)
})
