// Collects the licenses of all packages included in the finished app into THIRD_PARTY_LICENSES.txt.
// Usage: node scripts/licenses.mjs (runs automatically before `npm run app`)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

// Runtime dependencies plus packages Vite bundles into the UI (listed in devDependencies)
const BUNDLED = ['react', 'react-dom', 'monaco-editor', '@monaco-editor/react', '@xterm/xterm', '@xterm/addon-fit']
const start = [...Object.keys(pkg.dependencies ?? {}), ...BUNDLED]

/** Finds a package the way Node would resolve it from `fromDir`. */
function resolvePkg(name, fromDir) {
  let dir = fromDir
  for (;;) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const found = new Map() // "name@version" -> { name, version, license, repo, text }
function visit(name, fromDir) {
  const dir = resolvePkg(name, fromDir)
  if (!dir) return
  const p = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const key = `${p.name}@${p.version}`
  if (found.has(key)) return
  const licFile = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f))
  const repo = typeof p.repository === 'string' ? p.repository : p.repository?.url
  found.set(key, {
    name: p.name,
    version: p.version,
    license: typeof p.license === 'string' ? p.license : (p.license?.type ?? 'siehe Paket'),
    repo: (repo ?? p.homepage ?? '').replace(/^git\+/, '').replace(/\.git$/, ''),
    text: licFile ? readFileSync(join(dir, licFile), 'utf8').trim() : null
  })
  for (const dep of Object.keys({ ...p.dependencies, ...p.optionalDependencies })) visit(dep, dir)
}
for (const name of start) visit(name, root)

const entries = [...found.values()].sort((a, b) => a.name.localeCompare(b.name))

// llama.cpp is part of node-llama-cpp (as a precompiled library)
const llamaInfo = join(root, 'node_modules/node-llama-cpp/llama/llama.cpp.info.json')
const llamaTag = existsSync(llamaInfo) ? JSON.parse(readFileSync(llamaInfo, 'utf8')).tag : 'unknown'

let out = `Lokal IDE – Third-party software licenses
=========================================

Lokal IDE uses the following open source packages. Their license texts are below.
Electron also ships the licenses of Chromium and Node.js inside the app
(LICENSE.electron.txt and LICENSES.chromium.html in the app bundle).

llama.cpp (https://github.com/ggml-org/llama.cpp), version ${llamaTag}, MIT license –
included via node-llama-cpp.

Generated automatically by scripts/licenses.mjs.

`
for (const e of entries) {
  out += `\n${'-'.repeat(78)}\n${e.name} ${e.version} – ${e.license}\n${e.repo}\n\n${e.text ?? `(No license text included in the package – license according to package.json: ${e.license})`}\n`
}

writeFileSync(join(root, 'THIRD_PARTY_LICENSES.txt'), out)
console.log(`THIRD_PARTY_LICENSES.txt: ${entries.length} packages`)
const counts = {}
for (const e of entries) counts[e.license] = (counts[e.license] ?? 0) + 1
console.log(Object.entries(counts).map(([l, n]) => `${l}: ${n}`).join(', '))
