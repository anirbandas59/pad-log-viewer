// SessionStart(startup|resume): prepare the cloud VM and give Claude branch, milestone and review context.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { COMMIT_IDENTITY, context, isCloud, projectDir, sh } from './lib.mjs'

const notes = []
const run = (cmd, args, opts) => {
  try {
    return sh(cmd, args, { timeout: 30_000, ...opts }).trim()
  } catch {
    return ''
  }
}

if (isCloud) {
  // Cloud VMs default to a Claude git identity; commits must be authored as the maintainer.
  run('git', ['config', 'user.name', COMMIT_IDENTITY.name])
  run('git', ['config', 'user.email', COMMIT_IDENTITY.email])
  const major = Number(process.versions.node.split('.')[0])
  if (major !== 24)
    notes.push(`WARNING: Node ${process.versions.node} is running; this project requires Node 24.`)
  if (!existsSync(join(projectDir, 'node_modules'))) {
    try {
      sh('npm', ['ci', '--no-audit', '--no-fund'], { timeout: 600_000 })
      notes.push('Installed dependencies with npm ci.')
    } catch (err) {
      notes.push(`npm ci failed: ${String(err.stderr ?? err).slice(-500)}`)
    }
  }
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
notes.push(`Current branch: ${branch || 'unknown'}.`)
// Cloud sessions can only push to their own claude/<task>-<id> branch, so the milestone
// comes from the PR title (`feat(m<N>): ...`) first and the branch name second.
const isWorkBranch = /^(feature|claude)\//.test(branch)
let milestone =
  branch.match(/^feature\/m(\d+[a-z]?)-/i)?.[1] ??
  branch.match(/^claude\/.*?\bm(?:ilestone)?-?(\d+[a-z]?)\b/i)?.[1]
if (branch === 'main' || branch === 'dev') {
  notes.push(
    'You are on a protected branch: never commit or push here; work on your session branch (claude/*) or feature/m<N>-<slug>.',
  )
}

if (isWorkBranch) {
  const pr = run('gh', ['pr', 'view', '--json', 'number,url,title,labels,reviews'])
  if (pr) {
    try {
      const data = JSON.parse(pr)
      const labels = data.labels.map((l) => l.name)
      milestone = data.title?.match(/^\w+\(m(\d+[a-z]?)\)/i)?.[1] ?? milestone
      notes.push(`Open PR #${data.number} (${data.url}), labels: ${labels.join(', ') || 'none'}.`)
      const last = data.reviews.at(-1)
      if (labels.includes('changes-requested') && last?.body) {
        notes.push(`Latest review findings to address:\n${last.body.slice(0, 4000)}`)
      }
    } catch {
      // gh output not JSON; skip review context.
    }
  }
}

if (milestone) {
  notes.push(
    `Active milestone: M${milestone.toUpperCase()} (see the Milestones table in docs/implementation-plan.md).`,
  )
}

context('SessionStart', notes.join('\n'))
