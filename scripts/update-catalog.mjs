// Generates src/main/catalog.ts from the model list below.
// Queries Hugging Face for the actual files (including multi-part models) and sizes.
// Usage: node scripts/update-catalog.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HF = 'https://huggingface.co'

const apache = (repo) => ({ name: 'Apache 2.0', url: `${HF}/${repo}/blob/main/LICENSE`, commercial: true })

/** Variants, in the order they are offered. */
const SMALL = ['Q4_K_M', 'Q6_K', 'Q8_0', 'BF16']
const MEDIUM = ['Q3_K_M', 'Q4_K_M', 'Q6_K', 'Q8_0', 'BF16']
const LARGE = ['UD-Q2_K_XL', 'Q3_K_M', 'Q4_K_M', 'Q6_K', 'Q8_0', 'BF16']

/**
 * Curated models. activeB = parameters actually computed per token
 * (much less than totalB for MoE models – that's why they are so fast).
 */
const MODELS = [
  // ---- Small: run on almost any Mac ----
  { id: 'qwen3.5-0.8b', repo: 'unsloth/Qwen3.5-0.8B-GGUF', name: 'Qwen3.5 0.8B', totalB: 0.8, activeB: 0.8, size: 'small',
    description: 'Tiny and lightning fast. For simple questions and autocompletion.', tags: ['All-round', 'tiny'], license: apache('Qwen/Qwen3.5-0.8B'), quants: SMALL },
  { id: 'qwen2.5-coder-1.5b', repo: 'bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF', name: 'Qwen2.5 Coder 1.5B', totalB: 1.5, activeB: 1.5, size: 'small',
    description: 'Very fast, good for short code questions. Somewhat older.', tags: ['Code'], license: apache('Qwen/Qwen2.5-Coder-1.5B-Instruct'), quants: ['Q4_K_M', 'Q6_K', 'Q8_0', 'f16'] },
  { id: 'qwen3.5-2b', repo: 'unsloth/Qwen3.5-2B-GGUF', name: 'Qwen3.5 2B', totalB: 1.9, activeB: 1.9, size: 'small',
    description: 'Small and fast, surprisingly useful for code and German.', tags: ['All-round', 'fast'], license: apache('Qwen/Qwen3.5-2B'), quants: SMALL },
  { id: 'gemma-4-e2b', repo: 'unsloth/gemma-4-E2B-it-GGUF', name: 'Gemma 4 E2B', totalB: 4.6, activeB: 2, size: 'small',
    description: 'Google's smallest Gemma 4, optimized for laptops and phones.', tags: ['All-round', 'German'], license: apache('google/gemma-4-E2B-it'), quants: SMALL },
  { id: 'qwen2.5-coder-3b', repo: 'bartowski/Qwen2.5-Coder-3B-Instruct-GGUF', name: 'Qwen2.5 Coder 3B', totalB: 3.1, activeB: 3.1, size: 'small',
    description: 'Solid code model, but older and for non-commercial use only.', tags: ['Code'],
    license: { name: 'Qwen Research License', url: `${HF}/Qwen/Qwen2.5-Coder-3B-Instruct/blob/main/LICENSE`, commercial: false,
      note: 'Non-commercial use only (research/trying out). Commercial use requires a license from Alibaba.' },
    quants: ['Q4_K_M', 'Q6_K', 'Q8_0', 'f16'] },
  { id: 'qwen3.5-4b', repo: 'unsloth/Qwen3.5-4B-GGUF', name: 'Qwen3.5 4B', totalB: 4.2, activeB: 4.2, size: 'small',
    description: 'Best all-rounder for 8 GB RAM: good at code, tools and German.', tags: ['All-round', 'Code', 'recommended'], license: apache('Qwen/Qwen3.5-4B'), quants: SMALL },
  { id: 'gemma-4-e4b', repo: 'unsloth/gemma-4-E4B-it-GGUF', name: 'Gemma 4 E4B', totalB: 7.5, activeB: 4, size: 'small',
    description: 'Gemma 4 for laptops: strong at writing and in German.', tags: ['All-round', 'German'], license: apache('google/gemma-4-E4B-it'), quants: SMALL },

  // ---- Medium: 16–32 GB RAM ----
  { id: 'qwen2.5-coder-7b', repo: 'bartowski/Qwen2.5-Coder-7B-Instruct-GGUF', name: 'Qwen2.5 Coder 7B', totalB: 7.6, activeB: 7.6, size: 'medium',
    description: 'Proven code model, now surpassed by Qwen3.5.', tags: ['Code'], license: apache('Qwen/Qwen2.5-Coder-7B-Instruct'), quants: ['Q4_K_M', 'Q6_K', 'Q8_0', 'f16'] },
  { id: 'qwen3.5-9b', repo: 'unsloth/Qwen3.5-9B-GGUF', name: 'Qwen3.5 9B', totalB: 9, activeB: 9, size: 'medium',
    description: 'Clearly smarter than the small models, a good coding agent.', tags: ['All-round', 'Code'], license: apache('Qwen/Qwen3.5-9B'), quants: SMALL },
  { id: 'gemma-4-12b', repo: 'unsloth/gemma-4-12b-it-GGUF', name: 'Gemma 4 12B', totalB: 11.9, activeB: 11.9, size: 'medium',
    description: 'Balanced Gemma 4 model, very good in German.', tags: ['All-round', 'German'], license: apache('google/gemma-4-12B-it'), quants: MEDIUM },
  { id: 'gpt-oss-20b', repo: 'ggml-org/gpt-oss-20b-GGUF', name: 'gpt-oss 20B', totalB: 20.9, activeB: 3.6, size: 'medium',
    description: 'Open model from OpenAI. MoE: computes only 3.6B per word – very fast, strong at reasoning and tools.', tags: ['Reasoning', 'fast', 'MoE'], license: apache('openai/gpt-oss-20b'), quants: ['MXFP4'] },
  { id: 'gemma-4-26b-a4b', repo: 'unsloth/gemma-4-26B-A4B-it-GGUF', name: 'Gemma 4 26B A4B', totalB: 25.2, activeB: 4, size: 'medium',
    description: 'MoE Gemma: knowledge of a large model, speed of a small one.', tags: ['All-round', 'fast', 'MoE'], license: apache('google/gemma-4-26B-A4B-it'), quants: MEDIUM },
  { id: 'qwen3.8-27b', repo: 'unsloth/Qwen3.8-27B-GGUF', name: 'Qwen3.8 27B', totalB: 27.3, activeB: 27.3, size: 'medium',
    description: 'Currently one of the strongest models of this size. Dense (no MoE), therefore slower.', tags: ['All-round', 'Code', 'Quality'], license: apache('Qwen/Qwen3.8-27B'), quants: MEDIUM },
  { id: 'qwen3-coder-30b-a3b', repo: 'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF', name: 'Qwen3 Coder 30B A3B', totalB: 30.5, activeB: 3.3, size: 'medium',
    description: 'Dedicated coding agent model as MoE – fast and good with tools.', tags: ['Code', 'Agent', 'fast', 'MoE'], license: apache('Qwen/Qwen3-Coder-30B-A3B-Instruct'), quants: MEDIUM },
  { id: 'gemma-4-31b', repo: 'unsloth/gemma-4-31B-it-GGUF', name: 'Gemma 4 31B', totalB: 30.7, activeB: 30.7, size: 'medium',
    description: 'Largest Gemma 4, dense – high quality, needs a lot of memory.', tags: ['All-round', 'Quality'], license: apache('google/gemma-4-31B-it'), quants: MEDIUM },
  { id: 'qwen3.6-35b-a3b', repo: 'unsloth/Qwen3.6-35B-A3B-GGUF', name: 'Qwen3.6 35B A3B', totalB: 34.7, activeB: 3, size: 'medium',
    description: 'Very popular MoE all-rounder: broad knowledge, fast as a 3B model.', tags: ['All-round', 'Code', 'fast', 'MoE'], license: apache('Qwen/Qwen3.6-35B-A3B'), quants: MEDIUM },

  // ---- Large: 64–256 GB RAM ----
  { id: 'qwen3-coder-next', repo: 'unsloth/Qwen3-Coder-Next-GGUF', name: 'Qwen3 Coder Next 80B', totalB: 79.7, activeB: 3, size: 'large',
    description: 'Large coding agent model, still fast as MoE.', tags: ['Code', 'Agent', 'MoE'], license: apache('Qwen/Qwen3-Coder-Next'), quants: LARGE },
  { id: 'gpt-oss-120b', repo: 'ggml-org/gpt-oss-120b-GGUF', name: 'gpt-oss 120B', totalB: 116.8, activeB: 5.1, size: 'large',
    description: 'Large open OpenAI model, computes only 5.1B per word.', tags: ['Reasoning', 'MoE'], license: apache('openai/gpt-oss-120b'), quants: ['MXFP4'] },
  { id: 'qwen3.8-flash-next', repo: 'unsloth/Qwen3.8-Flash-Next-GGUF', name: 'Qwen3.8 Flash-Next 177B', totalB: 176.9, activeB: 7, size: 'large',
    description: 'Newest large Qwen MoE with 512 experts, tuned for speed.', tags: ['All-round', 'Code', 'MoE'],
    license: { name: 'Qwen Community License 1.0', url: `${HF}/Qwen/Qwen3.8-Flash-Next/blob/main/LICENSE`, commercial: false,
      note: 'Free for private and internal use. Offering a commercial AI coding/office product (like this IDE) or a model API requires a separate license from Qwen.' },
    quants: LARGE },

  // ---- Huge: 256 GB+ (Mac Studio / server) ----
  { id: 'qwen3.5-397b-a17b', repo: 'unsloth/Qwen3.5-397B-A17B-GGUF', name: 'Qwen3.5 397B A17B', totalB: 397, activeB: 17, size: 'huge',
    description: 'Flagship class for workstations. Computes 17B per word.', tags: ['All-round', 'Quality', 'MoE'], license: apache('Qwen/Qwen3.5-397B-A17B'), quants: LARGE },
  { id: 'qwen3-coder-480b', repo: 'unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF', name: 'Qwen3 Coder 480B A35B', totalB: 480, activeB: 35, size: 'huge',
    description: 'The largest open coding model in this list. Only for very large machines.', tags: ['Code', 'Agent', 'Quality', 'MoE'], license: apache('Qwen/Qwen3-Coder-480B-A35B-Instruct'), quants: LARGE }
]

/** If a quantization is missing, take the next best one (unsloth offers some only as “Dynamic” UD-…). */
const FALLBACK = {
  'UD-Q2_K_XL': ['UD-IQ2_M', 'Q2_K'],
  Q3_K_M: ['UD-Q3_K_M', 'UD-Q3_K_XL'],
  Q4_K_M: ['UD-Q4_K_M', 'UD-Q4_K_XL'],
  Q6_K: ['UD-Q6_K', 'UD-Q6_K_XL'],
  Q8_0: ['UD-Q8_K_XL'],
  BF16: ['F16', 'f16']
}

const QUANT_LABEL = {
  'UD-IQ2_M': '2-bit (Unsloth Dynamic) – most likely to fit, noticeably weaker',
  'UD-Q3_K_M': '3-bit (Unsloth Dynamic) – small, slight losses',
  'UD-Q3_K_XL': '3-bit (Unsloth Dynamic) – small, slight losses',
  'UD-Q4_K_M': '4-bit (Unsloth Dynamic) – recommended: fast, hardly any quality loss',
  'UD-Q4_K_XL': '4-bit (Unsloth Dynamic) – recommended: fast, hardly any quality loss',
  'UD-Q6_K': '6-bit (Unsloth Dynamic) – very good quality',
  'UD-Q6_K_XL': '6-bit (Unsloth Dynamic) – very good quality',
  'UD-Q8_K_XL': '8-bit (Unsloth Dynamic) – nearly lossless',
  F16: '16-bit – original, unquantized (large and slower)',
  'UD-Q2_K_XL': '2-bit (Unsloth Dynamic) – most likely to fit, noticeably weaker',
  Q3_K_M: '3-bit – small, slight losses',
  Q4_K_M: '4-bit – recommended: fast, hardly any quality loss',
  Q6_K: '6-bit – very good quality',
  Q8_0: '8-bit – nearly lossless',
  BF16: '16-bit – original, unquantized (large and slower)',
  f16: '16-bit – original, unquantized (large and slower)',
  MXFP4: 'MXFP4 – original format, the model was trained this way'
}

async function tree(repo) {
  const res = await fetch(`${HF}/api/models/${repo}/tree/main?recursive=true`)
  if (!res.ok) throw new Error(`${repo}: HTTP ${res.status}`)
  return (await res.json()).filter((f) => f.type === 'file' && f.path.endsWith('.gguf') && !/mmproj|eagle|draft|(^|\/)mtp/i.test(f.path))
}

/** Files of one quantization – single or as parts 00001-of-0000N (possibly in a subfolder). */
function filesFor(files, quant) {
  const q = quant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Exactly this quantization, not e.g. "UD-Q4_K_M" when looking for "Q4_K_M"
  const re = new RegExp(`(^|[/-])${q}(\\.gguf$|-000\\d\\d-of-000\\d\\d\\.gguf$|/)`, 'i')
  const hits = files.filter((f) => re.test(f.path) && (quant.startsWith('UD-') || !/(^|[/-])UD-/i.test(f.path)))
  hits.sort((a, b) => a.path.localeCompare(b.path))
  // Multi-part models only if all parts are actually uploaded
  const split = hits[0]?.path.match(/-000\d\d-of-000(\d\d)\.gguf$/)
  if (split && hits.length !== Number(split[1])) {
    console.warn(`  ! ${quant}: only ${hits.length} of ${Number(split[1])} parts present`)
    return []
  }
  if (!split && hits.length > 1) return [] // ambiguous
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
      console.warn(`  ! ${m.repo}: no files for ${quant}`)
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
  `// Generated by scripts/update-catalog.mjs – do not edit by hand.\n` +
    `// As of ${new Date().toISOString().slice(0, 10)}. GGUF quantizations by unsloth, ggml-org and bartowski;\n` +
    `// the license of the original model applies in each case.\n` +
    `import type { CatalogModel } from '../shared/types'\n\n` +
    `export const CATALOG: CatalogModel[] = ${JSON.stringify(out, null, 2)}\n`
)
console.log(`\nsrc/main/catalog.ts: ${out.length} models, ${out.reduce((s, m) => s + m.variants.length, 0)} variants`)
