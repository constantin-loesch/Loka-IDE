// npm entfernt beim Installieren manchmal das Ausführungsrecht von node-ptys „spawn-helper“.
// Ohne das startet kein Terminal („posix_spawnp failed“). Wird als postinstall ausgeführt.
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
