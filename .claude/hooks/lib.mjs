// Shared helpers for hook scripts. Hooks read one JSON payload on stdin.
import { execFileSync } from 'node:child_process'

export const isCloud = process.env.CLAUDE_CODE_REMOTE === 'true'
export const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()

export async function readInput() {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  return raw.trim() ? JSON.parse(raw) : {}
}

export function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  })
}

export function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
  process.exit(0)
}

export function context(hookEventName, text) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext: text } }),
  )
  process.exit(0)
}

// PreToolUse gates fail closed: an unexpected error blocks the action.
export function failClosed(name, main) {
  main().catch((err) => {
    process.stderr.write(`${name} hook error, blocking for safety: ${err?.stack || err}\n`)
    process.exit(2)
  })
}
