// Erzeugt src/main/catalog.ts aus der Modell-Liste unten.
// Fragt bei Hugging Face die echten Dateien (inkl. mehrteiliger Modelle) und Größen ab.
// Aufruf: node scripts/update-catalog.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HF = 'https://huggingface.co'

const apache = (repo) => ({ name: 'Apache 2.0', url: `${HF}/${repo}/blob/main/LICENSE`, commercial: true })

/** Varianten, in der Reihenfolge, in der sie angeboten werden. */
const SMALL = ['Q4_K_M', 'Q6_K', 'Q8_0', 'BF16']
const MEDIUM = ['Q3_K_M', 'Q4_K_M', 'Q6_K', 'Q8_0', 'BF16']
const LARGE = ['UD-Q2_K_XL', 'Q3_K_M', 'Q4_K_M', 'Q6_K', 'Q8_0', 'BF16']

/**
 * Kuratierte Modelle. activeB = Parameter, die pro Token tatsächlich gerechnet werden
 * (bei MoE-Modellen viel weniger als totalB – deshalb sind sie so schnell).
 */
const MODELS = [
  // ---- Klein: laufen auf fast jedem Mac ----
  { id: 'qwen3.5-0.8b', repo: 'unsloth/Qwen3.5-0.8B-GGUF', name: 'Qwen3.5 0.8B', totalB: 0.8, activeB: 0.8, size: 'klein',
    description: 'Winzig und blitzschnell. Für einfache Fragen und Autovervollständigung.', tags: ['Allround', 'winzig'], license: apache('Qwen/Qwen3.5-0.8B'), quants: SMALL },
  { id: 'qwen2.5-coder-1.5b', repo: 'bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF', name: 'Qwen2.5 Coder 1.5B', totalB: 1.5, activeB: 1.5, size: 'klein',
    description: 'Sehr schnell, gut für kurze Code-Fragen. Etwas älter.', tags: ['Code'], license: apache('Qwen/Qwen2.5-Coder-1.5B-Instruct'), quants: ['Q4_K_M', 'Q6_K', 'Q8_0', 'f16'] },
  { id: 'qwen3.5-2b', repo: 'unsloth/Qwen3.5-2B-GGUF', name: 'Qwen3.5 2B', totalB: 1.9, activeB: 1.9, size: 'klein',
    description: 'Klein und schnell, überraschend brauchbar für Code und Deutsch.', tags: ['Allround', 'schnell'], license: apache('Qwen/Qwen3.5-2B'), quants: SMALL },
  { id: 'gemma-4-e2b', repo: 'unsloth/gemma-4-E2B-it-GGUF', name: 'Gemma 4 E2B', totalB: 4.6, activeB: 2, size: 'klein',
    description: 'Googles kleinstes Gemma 4, für Laptops und Handys optimiert.', tags: ['Allround', 'Deutsch'], license: apache('google/gemma-4-E2B-it'), quants: SMALL },
  { id: 'qwen2.5-coder-3b', repo: 'bartowski/Qwen2.5-Coder-3B-Instruct-GGUF', name: 'Qwen2.5 Coder 3B', totalB: 3.1, activeB: 3.1, size: 'klein',
    description: 'Solides Code-Modell, aber älter und nur nicht-kommerziell nutzbar.', tags: ['Code'],
    license: { name: 'Qwen Research License', url: `${HF}/Qwen/Qwen2.5-Coder-3B-Instruct/blob/main/LICENSE`, commercial: false,
      note: 'Nur für nicht-kommerzielle Zwecke (Forschung/Ausprobieren). Für kommerzielle Nutzung braucht es eine Lizenz von Alibaba.' },
    quants: ['Q4_K_M', 'Q6_K', 'Q8_0', 'f16'] },
  { id: 'qwen3.5-4b', repo: 'unsloth/Qwen3.5-4B-GGUF', name: 'Qwen3.5 4B', totalB: 4.2, activeB: 4.2, size: 'klein',
    description: 'Bester Allrounder für 8 GB RAM: gut bei Code, Werkzeugen und Deutsch.', tags: ['Allround', 'Code', 'empfohlen'], license: apache('Qwen/Qwen3.5-4B'), quants: SMALL },
  { id: 'gemma-4-e4b', repo: 'unsloth/gemma-4-E4B-it-GGUF', name: 'Gemma 4 E4B', totalB: 7.5, activeB: 4, size: 'klein',
    description: 'Gemma 4 für Laptops: stark beim Formulieren und in Deutsch.', tags: ['Allround', 'Deutsch'], license: apache('google/gemma-4-E4B-it'), quants: SMALL },

  // ---- Mittel: 16–32 GB RAM ----
  { id: 'qwen2.5-coder-7b', repo: 'bartowski/Qwen2.5-Coder-7B-Instruct-GGUF', name: 'Qwen2.5 Coder 7B', totalB: 7.6, activeB: 7.6, size: 'mittel',
    description: 'Bewährtes Code-Modell, inzwischen von Qwen3.5 überholt.', tags: ['Code'], license: apache('Qwen/Qwen2.5-Coder-7B-Instruct'), quants: ['Q4_K_M', 'Q6_K', 'Q8_0', 'f16'] },
  { id: 'qwen3.5-9b', repo: 'unsloth/Qwen3.5-9B-GGUF', name: 'Qwen3.5 9B', totalB: 9, activeB: 9, size: 'mittel',
    description: 'Deutlich klüger als die kleinen Modelle, guter Coding-Agent.', tags: ['Allround', 'Code'], license: apache('Qwen/Qwen3.5-9B'), quants: SMALL },
  { id: 'gemma-4-12b', repo: 'unsloth/gemma-4-12b-it-GGUF', name: 'Gemma 4 12B', totalB: 11.9, activeB: 11.9, size: 'mittel',
    description: 'Ausgewogenes Gemma-4-Modell, sehr gut in Deutsch.', tags: ['Allround', 'Deutsch'], license: apache('google/gemma-4-12B-it'), quants: MEDIUM },
  { id: 'gpt-oss-20b', repo: 'ggml-org/gpt-oss-20b-GGUF', name: 'gpt-oss 20B', totalB: 20.9, activeB: 3.6, size: 'mittel',
    description: 'Offenes Modell von OpenAI. MoE: rechnet nur 3,6B pro Wort – sehr schnell, stark bei Logik und Werkzeugen.', tags: ['Reasoning', 'schnell', 'MoE'], license: apache('openai/gpt-oss-20b'), quants: ['MXFP4'] },
  { id: 'gemma-4-26b-a4b', repo: 'unsloth/gemma-4-26B-A4B-it-GGUF', name: 'Gemma 4 26B A4B', totalB: 25.2, activeB: 4, size: 'mittel',
    description: 'MoE-Gemma: Wissen eines großen Modells, Tempo eines kleinen.', tags: ['Allround', 'schnell', 'MoE'], license: apache('google/gemma-4-26B-A4B-it'), quants: MEDIUM },
  { id: 'qwen3.8-27b', repo: 'unsloth/Qwen3.8-27B-GGUF', name: 'Qwen3.8 27B', totalB: 27.3, activeB: 27.3, size: 'mittel',
    description: 'Aktuell eines der stärksten Modelle dieser Größe. Dicht (kein MoE), daher langsamer.', tags: ['Allround', 'Code', 'Qualität'], license: apache('Qwen/Qwen3.8-27B'), quants: MEDIUM },
  { id: 'qwen3-coder-30b-a3b', repo: 'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF', name: 'Qwen3 Coder 30B A3B', totalB: 30.5, activeB: 3.3, size: 'mittel',
    description: 'Spezielles Coding-Agent-Modell als MoE – schnell und gut mit Werkzeugen.', tags: ['Code', 'Agent', 'schnell', 'MoE'], license: apache('Qwen/Qwen3-Coder-30B-A3B-Instruct'), quants: MEDIUM },
  { id: 'gemma-4-31b', repo: 'unsloth/gemma-4-31B-it-GGUF', name: 'Gemma 4 31B', totalB: 30.7, activeB: 30.7, size: 'mittel',
    description: 'Größtes Gemma 4, dicht – hohe Qualität, braucht viel Speicher.', tags: ['Allround', 'Qualität'], license: apache('google/gemma-4-31B-it'), quants: MEDIUM },
  { id: 'qwen3.6-35b-a3b', repo: 'unsloth/Qwen3.6-35B-A3B-GGUF', name: 'Qwen3.6 35B A3B', totalB: 34.7, activeB: 3, size: 'mittel',
    description: 'Sehr beliebter MoE-Allrounder: groß im Wissen, schnell wie ein 3B-Modell.', tags: ['Allround', 'Code', 'schnell', 'MoE'], license: apache('Qwen/Qwen3.6-35B-A3B'), quants: MEDIUM },

  // ---- Groß: 64–256 GB RAM ----
  { id: 'qwen3-coder-next', repo: 'unsloth/Qwen3-Coder-Next-GGUF', name: 'Qwen3 Coder Next 80B', totalB: 79.7, activeB: 3, size: 'groß',
    description: 'Großes Coding-Agent-Modell, als MoE trotzdem schnell.', tags: ['Code', 'Agent', 'MoE'], license: apache('Qwen/Qwen3-Coder-Next'), quants: LARGE },
  { id: 'gpt-oss-120b', repo: 'ggml-org/gpt-oss-120b-GGUF', name: 'gpt-oss 120B', totalB: 116.8, activeB: 5.1, size: 'groß',
    description: 'Großes offenes OpenAI-Modell, rechnet nur 5,1B pro Wort.', tags: ['Reasoning', 'MoE'], license: apache('openai/gpt-oss-120b'), quants: ['MXFP4'] },
  { id: 'qwen3.8-flash-next', repo: 'unsloth/Qwen3.8-Flash-Next-GGUF', name: 'Qwen3.8 Flash-Next 177B', totalB: 176.9, activeB: 7, size: 'groß',
    description: 'Neuestes großes Qwen-MoE mit 512 Experten, auf Tempo getrimmt.', tags: ['Allround', 'Code', 'MoE'],
    license: { name: 'Qwen Community License 1.0', url: `${HF}/Qwen/Qwen3.8-Flash-Next/blob/main/LICENSE`, commercial: false,
      note: 'Privat und intern frei. Wer kommerziell ein KI-Coding-/Büro-Produkt (wie diese IDE) oder eine Modell-API anbietet, braucht eine eigene Lizenz von Qwen.' },
    quants: LARGE },

  // ---- Riesig: 256 GB+ (Mac Studio / Server) ----
  { id: 'qwen3.5-397b-a17b', repo: 'unsloth/Qwen3.5-397B-A17B-GGUF', name: 'Qwen3.5 397B A17B', totalB: 397, activeB: 17, size: 'riesig',
    description: 'Flaggschiff-Klasse für Workstations. Rechnet 17B pro Wort.', tags: ['Allround', 'Qualität', 'MoE'], license: apache('Qwen/Qwen3.5-397B-A17B'), quants: LARGE },
  { id: 'qwen3-coder-480b', repo: 'unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF', name: 'Qwen3 Coder 480B A35B', totalB: 480, activeB: 35, size: 'riesig',
    description: 'Das größte offene Coding-Modell dieser Liste. Nur für sehr große Rechner.', tags: ['Code', 'Agent', 'Qualität', 'MoE'], license: apache('Qwen/Qwen3-Coder-480B-A35B-Instruct'), quants: LARGE }
]

/** Fehlt eine Quantisierung, nimm die nächstbeste (unsloth bietet manche nur als „Dynamic“ UD-…). */
const FALLBACK = {
  'UD-Q2_K_XL': ['UD-IQ2_M', 'Q2_K'],
  Q3_K_M: ['UD-Q3_K_M', 'UD-Q3_K_XL'],
  Q4_K_M: ['UD-Q4_K_M', 'UD-Q4_K_XL'],
  Q6_K: ['UD-Q6_K', 'UD-Q6_K_XL'],
  Q8_0: ['UD-Q8_K_XL'],
  BF16: ['F16', 'f16']
}

const QUANT_LABEL = {
  'UD-IQ2_M': '2-Bit (Unsloth Dynamic) – passt noch am ehesten, spürbar schwächer',
  'UD-Q3_K_M': '3-Bit (Unsloth Dynamic) – klein, leichte Einbußen',
  'UD-Q3_K_XL': '3-Bit (Unsloth Dynamic) – klein, leichte Einbußen',
  'UD-Q4_K_M': '4-Bit (Unsloth Dynamic) – empfohlen: schnell, kaum Qualitätsverlust',
  'UD-Q4_K_XL': '4-Bit (Unsloth Dynamic) – empfohlen: schnell, kaum Qualitätsverlust',
  'UD-Q6_K': '6-Bit (Unsloth Dynamic) – sehr gute Qualität',
  'UD-Q6_K_XL': '6-Bit (Unsloth Dynamic) – sehr gute Qualität',
  'UD-Q8_K_XL': '8-Bit (Unsloth Dynamic) – nahezu verlustfrei',
  F16: '16-Bit – Original, unquantisiert (groß und langsamer)',
  'UD-Q2_K_XL': '2-Bit (Unsloth Dynamic) – passt noch am ehesten, spürbar schwächer',
  Q3_K_M: '3-Bit – klein, leichte Einbußen',
  Q4_K_M: '4-Bit – empfohlen: schnell, kaum Qualitätsverlust',
  Q6_K: '6-Bit – sehr gute Qualität',
  Q8_0: '8-Bit – nahezu verlustfrei',
  BF16: '16-Bit – Original, unquantisiert (groß und langsamer)',
  f16: '16-Bit – Original, unquantisiert (groß und langsamer)',
  MXFP4: 'MXFP4 – Originalformat, so wurde das Modell trainiert'
}

async function tree(repo) {
  const res = await fetch(`${HF}/api/models/${repo}/tree/main?recursive=true`)
  if (!res.ok) throw new Error(`${repo}: HTTP ${res.status}`)
  return (await res.json()).filter((f) => f.type === 'file' && f.path.endsWith('.gguf') && !/mmproj|eagle|draft|(^|\/)mtp/i.test(f.path))
}

/** Dateien einer Quantisierung – einzeln oder als Teile 00001-of-0000N (ggf. im Unterordner). */
function filesFor(files, quant) {
  const q = quant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Exakt diese Quantisierung, nicht z. B. "UD-Q4_K_M" wenn "Q4_K_M" gesucht ist
  const re = new RegExp(`(^|[/-])${q}(\\.gguf$|-000\\d\\d-of-000\\d\\d\\.gguf$|/)`, 'i')
  const hits = files.filter((f) => re.test(f.path) && (quant.startsWith('UD-') || !/(^|[/-])UD-/i.test(f.path)))
  hits.sort((a, b) => a.path.localeCompare(b.path))
  // Mehrteilige Modelle nur, wenn wirklich alle Teile hochgeladen sind
  const split = hits[0]?.path.match(/-000\d\d-of-000(\d\d)\.gguf$/)
  if (split && hits.length !== Number(split[1])) {
    console.warn(`  ! ${quant}: nur ${hits.length} von ${Number(split[1])} Teilen vorhanden`)
    return []
  }
  if (!split && hits.length > 1) return [] // mehrdeutig
  return hits
}

const out = []
for (const m of MODELS) {
  const files = await tree(m.repo)
  const variants = []
  for (const quant of m.quants) {
    let found = quant
    let hits = filesFor(files, quant)
    for (const alt of FALLBACK[quant] ?? []) {
      if (hits.length) break
      found = alt
      hits = filesFor(files, alt)
    }
    if (!hits.length) {
      console.warn(`  ! ${m.repo}: keine Dateien für ${quant}`)
      continue
    }
    const parts = hits.map((f) => ({
      url: `${HF}/${m.repo}/resolve/main/${f.path.split('/').map(encodeURIComponent).join('/')}`,
      fileName: f.path.split('/').pop(),
      sizeBytes: f.lfs?.size ?? f.size
    }))
    variants.push({
      id: `${m.id}:${found}`,
      quant: found === 'f16' ? 'F16' : found,
      label: QUANT_LABEL[found] ?? found,
      sizeBytes: parts.reduce((s, p) => s + p.sizeBytes, 0),
      files: parts
    })
  }
  const recommended = variants.find((v) => /Q4_K|MXFP4/.test(v.quant)) ?? variants[0]
  console.log(`${m.name.padEnd(26)} ${variants.map((v) => `${v.quant} ${(v.sizeBytes / 1e9).toFixed(1)}GB${v.files.length > 1 ? `/${v.files.length}T` : ''}`).join(', ')}`)
  out.push({
    id: m.id,
    name: m.name,
    description: m.description,
    repo: m.repo,
    sizeClass: m.size,
    totalParamsB: m.totalB,
    activeParamsB: m.activeB,
    tags: m.tags,
    license: m.license,
    recommendedVariant: recommended.id,
    variants
  })
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
writeFileSync(
  join(root, 'src/main/catalog.ts'),
  `// Automatisch erzeugt von scripts/update-catalog.mjs – nicht von Hand bearbeiten.\n` +
    `// Stand: ${new Date().toISOString().slice(0, 10)}. GGUF-Quantisierungen von unsloth, ggml-org und bartowski;\n` +
    `// es gilt jeweils die Lizenz des Originalmodells.\n` +
    `import type { CatalogModel } from '../shared/types'\n\n` +
    `export const CATALOG: CatalogModel[] = ${JSON.stringify(out, null, 2)}\n`
)
console.log(`\nsrc/main/catalog.ts: ${out.length} Modelle, ${out.reduce((s, m) => s + m.variants.length, 0)} Varianten`)
