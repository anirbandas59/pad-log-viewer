// Notification, local only: reuse the maintainer's WSL-to-Windows notification chain if present.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isCloud, readInput } from './lib.mjs'

if (isCloud) process.exit(0)
const input = await readInput().catch(() => ({}))
const script = join(homedir(), '.claude', 'hooks', 'notify.sh')
if (!existsSync(script)) process.exit(0)
// Skip when user settings already run notify.sh, to avoid duplicate notifications.
try {
  if (readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf8').includes('notify.sh'))
    process.exit(0)
} catch {
  // No user settings; continue.
}
spawnSync('bash', [script], {
  input: JSON.stringify(input),
  stdio: ['pipe', 'ignore', 'ignore'],
  timeout: 15_000,
})
process.exit(0)
