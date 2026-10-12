// PreToolUse(Bash): deny pushes to main or dev and any force-push.
import { deny, failClosed, readInput, sh } from './lib.mjs'

const PROTECTED = new Set(['main', 'dev'])

function targetBranch(refspec) {
  const dst = refspec.includes(':') ? refspec.split(':').pop() : refspec
  return dst.replace(/^\+/, '').replace(/^refs\/heads\//, '')
}

failClosed('guard-push', async () => {
  const { tool_input } = await readInput()
  const command = tool_input?.command ?? ''
  for (const m of command.matchAll(/\bgit\s+(?:-C\s+\S+\s+)?push\b([^;&|\n]*)/g)) {
    const args = m[1].trim().split(/\s+/).filter(Boolean)
    if (
      args.some((a) =>
        /^(--force(-with-lease|-if-includes)?(=.*)?|-[a-zA-Z]*f[a-zA-Z]*|--mirror|--all|--delete|-d)$/.test(
          a,
        ),
      )
    ) {
      deny(
        'Force-push, --mirror, --all and branch deletion are not allowed. Push a normal commit to your feature/* branch.',
      )
    }
    const positional = args.filter((a) => !a.startsWith('-'))
    const refspecs = positional.slice(1)
    if (refspecs.some((r) => r.startsWith('+'))) deny('Force refspecs (+branch) are not allowed.')
    let targets = refspecs.map(targetBranch)
    if (targets.length === 0) {
      targets = [sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim()]
    }
    const bad = targets.filter((t) => PROTECTED.has(t) || t === 'HEAD')
    if (bad.length > 0) {
      deny(
        `Pushing to ${bad.join(', ')} is not allowed. main and dev change only through PRs merged by the maintainer; push to feature/m<N>-<slug> instead.`,
      )
    }
  }
  process.exit(0)
})
