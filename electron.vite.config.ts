import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

/** Git-Stand beim Bauen – daran erkennt die App später, ob es eine neuere Version gibt. */
function gitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

export default defineConfig({
  main: {
    define: {
      // LOKAL_IDE_BUILD_COMMIT überschreibt den Stand – nur zum Testen des Update-Hinweises
      __BUILD_COMMIT__: JSON.stringify(process.env.LOKAL_IDE_BUILD_COMMIT || gitCommit()),
      // Aus diesem Ordner holt sich die App Updates (git pull) und baut sich neu
      __SOURCE_DIR__: JSON.stringify(resolve('.')),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString())
    }
  },
  preload: {},
  renderer: {
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    plugins: [react()]
  }
})
