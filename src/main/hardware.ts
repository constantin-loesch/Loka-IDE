// Hardware assessment: does a model fit into memory and roughly how fast does it run?
// Rule of thumb: for every generated word all active weights have to be read from memory once –
// so the speed depends mostly on the memory bandwidth.
import { readFileSync } from 'node:fs'
import { cpus, platform, totalmem } from 'node:os'
import type { Fit, HardwareInfo } from '../shared/types'
import { t } from './i18n'

const GB = 1024 ** 3

/** Memory bandwidth in GB/s for known graphics cards (rough manufacturer figures). */
const GPU_BANDWIDTH: [RegExp, number][] = [
  // NVIDIA – data center
  [/H200/i, 4800],
  [/H100/i, 3350],
  [/B200/i, 8000],
  [/A100/i, 1935],
  [/L40/i, 864],
  [/A6000|RTX 6000 Ada/i, 960],
  [/A10\b/i, 600],
  [/\bL4\b/i, 300],
  [/\bT4\b/i, 320],
  [/GB10|DGX Spark/i, 273],
  // NVIDIA – GeForce
  [/5090/, 1792],
  [/5080/, 960],
  [/5070 Ti/i, 896],
  [/5070/, 672],
  [/5060 Ti/i, 448],
  [/4090/, 1008],
  [/4080/, 717],
  [/4070 Ti Super/i, 672],
  [/4070/, 504],
  [/4060 Ti/i, 288],
  [/4060/, 272],
  [/3090/, 936],
  [/3080/, 760],
  [/3070/, 448],
  [/3060 Ti/i, 448],
  [/3060/, 360],
  [/2080/, 448],
  [/2070|2060/, 336],
  // AMD
  [/MI300/i, 5300],
  [/7900 XTX/i, 960],
  [/7900/i, 800],
  [/9070/i, 640],
  [/7800/i, 624],
  [/6900|6800/i, 512]
]

/** Bandwidth of the main memory. Apple Silicon shares it with the GPU (“unified memory”). */
function ramBandwidth(cpu: string): number {
  const apple: [RegExp, number][] = [
    [/M\d Ultra/, 800],
    [/M4 Max/, 546],
    [/M5 Max/, 600],
    [/M[1-3] Max/, 400],
    [/M4 Pro/, 273],
    [/M[125] Pro/, 200],
    [/M3 Pro/, 150],
    [/M5/, 153],
    [/M4/, 120],
    [/M[23]/, 100],
    [/M1/, 68]
  ]
  const hit = apple.find(([re]) => re.test(cpu))
  if (hit) return hit[1]
  // PCs: dual-channel DDR5 ≈ 80 GB/s, DDR4 ≈ 40 GB/s – servers with many channels considerably more
  if (/EPYC|Xeon|Threadripper/i.test(cpu)) return 200
  return 60
}

/**
 * NVIDIA Jetson: CPU and GPU share the main memory (like Apple Silicon).
 * The model is in /proc/device-tree/model, e.g. “NVIDIA Jetson AGX Orin Developer Kit”.
 */
export interface JetsonInfo {
  model: string
  /** Memory bandwidth in GB/s (manufacturer figure) */
  bandwidthGBs: number
}

let jetsonCache: JetsonInfo | null | undefined
export function jetson(): JetsonInfo | null {
  if (jetsonCache !== undefined) return jetsonCache
  jetsonCache = null
  if (platform() !== 'linux') return null
  let model = ''
  try {
    model = readFileSync('/proc/device-tree/model', 'utf8').replace(/\0/g, '').trim()
  } catch {
    /* no device tree – not a Jetson */
  }
  let tegra = false
  try {
    tegra = readFileSync('/etc/nv_tegra_release', 'utf8').length > 0
  } catch {
    /* missing */
  }
  if (!/jetson/i.test(model) && !tegra) return null
  const ramGB = totalmem() / GB
  const table: [RegExp, number][] = [
    [/Thor/i, 273],
    [/AGX Orin/i, 204.8],
    [/Orin NX/i, 102.4],
    [/Orin Nano/i, ramGB < 6 ? 34 : 68],
    [/AGX Xavier/i, 136.5],
    [/Xavier NX/i, 59.7],
    [/TX2/i, 59.7],
    [/Nano/i, 25.6]
  ]
  const bw = table.find(([re]) => re.test(model))?.[1] ?? 100
  jetsonCache = { model: model || 'NVIDIA Jetson', bandwidthGBs: bw }
  return jetsonCache
}

export function describeHardware(gpu: HardwareInfo['gpu'], gpuNames: string[], vramBytes: number, unified: boolean): HardwareInfo {
  const cpu = cpus()[0]?.model?.trim() ?? 'unbekannt'
  const name = gpuNames.join(', ')
  const j = jetson()
  if (j) {
    // Shared memory: the bandwidth applies to CPU and GPU alike
    return {
      platform: platform(),
      cpu: `${j.model} (${cpu})`,
      ramBytes: totalmem(),
      gpu,
      gpuNames: gpuNames.length ? gpuNames : [j.model],
      vramBytes,
      unifiedMemory: true,
      bandwidthGBs: j.bandwidthGBs,
      ramBandwidthGBs: j.bandwidthGBs
    }
  }
  // DGX Spark (GB10) shares the memory as well
  const spark = /GB10|DGX Spark/i.test(name)
  if (spark) unified = true
  const ram = spark ? 273 : ramBandwidth(cpu)
  const gpuBw = unified ? ram : (GPU_BANDWIDTH.find(([re]) => re.test(name))?.[1] ?? 300)
  return {
    platform: platform(),
    cpu,
    ramBytes: totalmem(),
    gpu,
    gpuNames,
    vramBytes,
    unifiedMemory: unified,
    bandwidthGBs: gpu === 'cpu' ? ram : gpuBw,
    ramBandwidthGBs: ram
  }
}

/** Fallback while llama.cpp is not initialized yet (or fails). */
export function fallbackHardware(): HardwareInfo {
  const mac = platform() === 'darwin'
  return describeHardware(mac ? 'metal' : 'cpu', [], 0, mac || !!jetson())
}

export interface Assessment {
  fit: Fit
  tokensPerSec: number | null
  note?: string
}

/**
 * Does a model file fit this hardware, and roughly how fast will it be?
 * activeFraction: share of the weights computed per word (MoE < 1).
 */
export function assess(sizeBytes: number, activeFraction: number, hw: HardwareInfo): Assessment {
  const needed = sizeBytes * 1.2 + 0.5 * GB // weights + context/KV cache
  const activeBytes = sizeBytes * activeFraction
  // In practice you get about 60 % of the theoretical bandwidth
  const speed = (bwGBs: number): number => (bwGBs * 1e9 * 0.6) / activeBytes

  // Apple Silicon, Jetson and pure CPU mode: everything lives in main memory
  if (hw.unifiedMemory || hw.gpu === 'cpu' || hw.vramBytes === 0) {
    const fit: Fit = needed <= hw.ramBytes - 3.5 * GB ? 'good' : needed <= hw.ramBytes - 1.5 * GB ? 'tight' : 'too-large'
    return { fit, tokensPerSec: fit === 'too-large' ? null : Math.max(1, Math.round(speed(hw.bandwidthGBs))) }
  }

  // Dedicated graphics card (CUDA/Vulkan): fastest when everything fits into graphics memory
  if (needed <= hw.vramBytes * 0.95) return { fit: 'good', tokensPerSec: Math.max(1, Math.round(speed(hw.bandwidthGBs))) }
  if (needed <= hw.vramBytes + hw.ramBytes - 4 * GB) {
    // Part on the GPU, rest in main memory – the slow part slows everything down
    const onGpu = Math.min(1, (hw.vramBytes * 0.9) / sizeBytes)
    const secPerToken =
      (activeBytes * onGpu) / (hw.bandwidthGBs * 1e9 * 0.6) + (activeBytes * (1 - onGpu)) / (hw.ramBandwidthGBs * 1e9 * 0.6)
    return {
      fit: 'tight',
      tokensPerSec: Math.max(1, Math.round(1 / secPerToken)),
      note: t('Doesn\'t quite fit into graphics memory ({gb} GB) – part of it runs on the CPU, which slows it down.', { gb: Math.round(hw.vramBytes / GB) })
    }
  }
  return { fit: 'too-large', tokensPerSec: null }
}
