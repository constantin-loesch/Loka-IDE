import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

/** Git state at build time – the app later uses it to tell whether there is a newer version. */
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
      // LOKAL_IDE_BUILD_COMMIT overrides the state – only for testing the update notice
      __BUILD_COMMIT__: JSON.stringify(process.env.LOKAL_IDE_BUILD_COMMIT || gitCommit()),
      // The app fetches updates from this folder (git pull) and rebuilds itself
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
