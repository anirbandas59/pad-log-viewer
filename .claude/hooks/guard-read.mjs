// PreToolUse(Read|Grep): block reading .env files and CSVs outside tests/fixtures/ (raw logs hold client data).
import { basename, relative, resolve } from 'node:path'
import { deny, failClosed, projectDir, readInput } from './lib.mjs'

failClosed('guard-read', async () => {
  const { tool_input } = await readInput()
  const target = tool_input?.file_path ?? tool_input?.path
  if (!target) process.exit(0)
  const abs = resolve(projectDir, target)
  const rel = relative(projectDir, abs).replace(/\\/g, '/')
  if (/^\.env/.test(basename(abs))) deny('Reading .env files is not allowed.')
  if (/\.csv$/i.test(abs) && !rel.startsWith('tests/fixtures/')) {
    deny(
      'Reading CSV files outside tests/fixtures/ is not allowed: raw PAD logs contain client data. Use a sanitized fixture.',
    )
  }
  process.exit(0)
})
