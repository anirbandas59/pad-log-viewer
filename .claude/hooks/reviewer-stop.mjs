// SubagentStop(reviewer): a review must end with a verdict line and the acceptance-criteria checklist.
import { readFileSync } from 'node:fs'
import { readInput } from './lib.mjs'

const input = await readInput().catch(() => ({}))
if (input.stop_hook_active) process.exit(0)

let text = input.last_assistant_message ?? ''
if (!text && input.agent_transcript_path) {
  try {
    const lines = readFileSync(input.agent_transcript_path, 'utf8').trim().split('\n')
    for (const line of lines.reverse()) {
      const entry = JSON.parse(line)
      const content = entry.message?.role === 'assistant' ? entry.message.content : null
      const t = Array.isArray(content)
        ? content
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('\n')
        : ''
      if (t) {
        text = t
        break
      }
    }
  } catch {
    // Fall through with whatever text we have.
  }
}

const problems = []
if (
  !/^\s*(\*\*)?Verdict:?(\*\*)?\s*(APPROVE|REQUEST_CHANGES)\s*$/im.test(text) &&
  !/^\s*(APPROVE|REQUEST_CHANGES)\s*$/m.test(text)
) {
  problems.push('a final verdict line: `Verdict: APPROVE` or `Verdict: REQUEST_CHANGES`')
}
if (!/^\s*[-*] \[[ xX]\] /m.test(text)) {
  problems.push(
    'the milestone acceptance-criteria checklist (`- [x] ...` / `- [ ] ...`, one item per criterion)',
  )
}
if (problems.length > 0) {
  process.stderr.write(
    `Your review is incomplete. Add ${problems.join(' and ')}, post the corrected review, then finish.\n`,
  )
  process.exit(2)
}
process.exit(0)
