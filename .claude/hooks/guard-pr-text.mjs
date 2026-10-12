// PreToolUse(Bash): deny PR bodies, reviews and comments that carry author/tool attribution.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deny, failClosed, hasAttribution, projectDir, readInput } from './lib.mjs'

const GH_TEXT_COMMAND =
  /\bgh\s+(pr\s+(create|edit|comment|review)|issue\s+comment|api\b[^\n]*\/(pulls|issues)\b)/

failClosed('guard-pr-text', async () => {
  const { tool_input } = await readInput()
  const command = tool_input?.command ?? ''
  if (!GH_TEXT_COMMAND.test(command)) process.exit(0)

  // Inline text is part of the command; body files are read from disk.
  const texts = [command]
  for (const m of command.matchAll(/(?:--body-file|-F)(?:=|\s+)(?:\w+=@)?(\S+)|\w+=@(\S+)/g)) {
    const file = (m[1] ?? m[2]).replace(/^['"]|['"]$/g, '')
    const p = resolve(projectDir, file)
    if (file !== '-' && existsSync(p)) texts.push(readFileSync(p, 'utf8'))
  }
  if (texts.some(hasAttribution)) {
    deny(
      'PR bodies, reviews and comments must not contain attribution: no "Generated with/by Claude Code" lines, robot emoji, claude.ai/code/session links, or Co-Authored-By/Author/Signed-off-by lines. Remove them and run the command again.',
    )
  }
  process.exit(0)
})
