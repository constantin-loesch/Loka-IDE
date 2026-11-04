// npm sometimes strips the execute permission from node-pty's “spawn-helper” during install.
// Without it no terminal starts (“posix_spawnp failed”). Runs as postinstall.
import { chmodSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const base = join('node_modules', 'node-pty')
const dirs = [join(base, 'build', 'Release')]
const prebuilds = join(base, 'prebuilds')
if (existsSync(prebuilds)) for (const d of readdirSync(prebuilds)) dirs.push(join(prebuilds, d))

for (const dir of dirs) {
  const helper = join(dir, 'spawn-helper')
  if (existsSync(helper)) chmodSync(helper, 0o755)
}
