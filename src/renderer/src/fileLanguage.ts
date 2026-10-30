// Ordnet Dateien einer Monaco-Sprache zu und baut eindeutige Modell-URIs.
import { languages, Uri } from 'monaco-editor'

/** Dateinamen ohne (eindeutige) Endung, die Monaco nicht selbst kennt. */
const BY_NAME: Record<string, string> = {
  '.gitignore': 'shell',
  '.dockerignore': 'shell',
  '.npmignore': 'shell',
  '.gitattributes': 'shell',
  '.bashrc': 'shell',
  '.zshrc': 'shell',
  '.profile': 'shell',
  '.zprofile': 'shell',
  '.bash_profile': 'shell',
  makefile: 'shell',
  '.editorconfig': 'ini',
  '.npmrc': 'ini',
  '.prettierrc': 'json',
  '.eslintrc': 'json',
  '.babelrc': 'json',
  gemfile: 'ruby',
  rakefile: 'ruby',
  podfile: 'ruby',
  brewfile: 'ruby',
  jenkinsfile: 'java'
}

/** Endungen, die Monaco nicht kennt, aber einer ähnlichen Sprache entsprechen. */
const BY_EXT: Record<string, string> = {
  vue: 'html',
  svelte: 'html',
  astro: 'html',
  jsonc: 'json',
  json5: 'json',
  webmanifest: 'json',
  toml: 'ini',
  env: 'shell',
  properties: 'ini',
  conf: 'ini',
  cfg: 'ini',
  gradle: 'java',
  groovy: 'java',
  zsh: 'shell',
  fish: 'shell',
  mts: 'typescript',
  cts: 'typescript',
  mdx: 'markdown',
  plist: 'xml',
  xsd: 'xml',
  csproj: 'xml',
  gltf: 'json',
  ipynb: 'json'
}

export function detectLanguage(path: string): string {
  const name = (path.split('/').pop() ?? path).toLowerCase()
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot) : ''

  for (const lang of languages.getLanguages()) {
    if (lang.filenames?.some((f) => f.toLowerCase() === name)) return lang.id
  }
  if (BY_NAME[name]) return BY_NAME[name]
  if (name.startsWith('.env')) return 'shell'
  if (name.startsWith('dockerfile')) return 'dockerfile'
  if (ext) {
    for (const lang of languages.getLanguages()) {
      if (lang.extensions?.some((e) => e.toLowerCase() === ext)) return lang.id
    }
    if (BY_EXT[ext.slice(1)]) return BY_EXT[ext.slice(1)]
  }
  return 'plaintext'
}

/** Monaco-Modelle werden über diese URI gefunden – auch bei Leerzeichen, # oder ? im Pfad. */
export function modelUri(path: string): Uri {
  return Uri.file(path)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('de', { maximumFractionDigits: 1 })} ${units[i]}`
}
