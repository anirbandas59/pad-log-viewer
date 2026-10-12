// PreToolUse(Edit|Write), cloud only: the developer session may not weaken its own gates.
import { relative, resolve } from 'node:path'
import { deny, failClosed, isCloud, projectDir, readInput } from './lib.mjs'

failClosed('guard-protected-files', async () => {
  if (!isCloud) process.exit(0)
  const { tool_input } = await readInput()
  const rel = relative(projectDir, resolve(projectDir, tool_input?.file_path ?? '')).replace(
    /\\/g,
    '/',
  )
  if (rel === 'CLAUDE.md' || rel.startsWith('.claude/') || rel.startsWith('.github/workflows/')) {
    deny(
      `${rel} is protected in cloud sessions. Propose the change in the PR body under "Proposed config changes" instead.`,
    )
  }
  process.exit(0)
})
