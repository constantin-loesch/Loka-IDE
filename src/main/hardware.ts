// Hardware-Einschätzung: Passt ein Modell in den Speicher und wie schnell läuft es ungefähr?
// Faustregel: Pro erzeugtem Wort müssen alle aktiven Gewichte einmal aus dem Speicher gelesen werden –
// das Tempo hängt also vor allem an der Speicherbandbreite.
import { cpus, platform, totalmem } from 'node:os'
import type { Fit, HardwareInfo } from '../shared/types'

const GB = 1024 ** 3

/** Speicherbandbreite in GB/s für bekannte Grafikkarten (grobe Herstellerangaben). */
const GPU_BANDWIDTH: [RegExp, number][] = [
  // NVIDIA – Rechenzentrum
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

/** Bandbreite des Arbeitsspeichers. Apple Silicon teilt ihn mit der GPU („Unified Memory“). */
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
  // PCs: Dual-Channel DDR5 ≈ 80 GB/s, DDR4 ≈ 40 GB/s – Server mit vielen Kanälen deutlich mehr
  if (/EPYC|Xeon|Threadripper/i.test(cpu)) return 200
  return 60
}

export function describeHardware(gpu: HardwareInfo['gpu'], gpuNames: string[], vramBytes: number, unified: boolean): HardwareInfo {
  const cpu = cpus()[0]?.model?.trim() ?? 'unbekannt'
  const ram = ramBandwidth(cpu)
  const name = gpuNames.join(', ')
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

/** Ersatz, solange llama.cpp noch nicht initialisiert ist (oder fehlschlägt). */
export function fallbackHardware(): HardwareInfo {
  const mac = platform() === 'darwin'
  return describeHardware(mac ? 'metal' : 'cpu', [], 0, mac)
}

export interface Assessment {
  fit: Fit
  tokensPerSec: number | null
  note?: string
}

/**
 * Passt eine Modelldatei auf diese Hardware, und wie schnell wird sie ungefähr?
 * activeFraction: Anteil der Gewichte, die pro Wort gerechnet werden (MoE < 1).
 */
export function assess(sizeBytes: number, activeFraction: number, hw: HardwareInfo): Assessment {
  const needed = sizeBytes * 1.2 + 0.5 * GB // Gewichte + Kontext/KV-Cache
  const activeBytes = sizeBytes * activeFraction
  // In der Praxis erreicht man etwa 60 % der theoretischen Bandbreite
  const speed = (bwGBs: number): number => (bwGBs * 1e9 * 0.6) / activeBytes

  // Apple Silicon und reiner CPU-Betrieb: alles liegt im Arbeitsspeicher
  if (hw.unifiedMemory || hw.gpu === 'cpu' || hw.vramBytes === 0) {
    const fit: Fit = needed <= hw.ramBytes - 3.5 * GB ? 'gut' : needed <= hw.ramBytes - 1.5 * GB ? 'knapp' : 'zu-gross'
    return { fit, tokensPerSec: fit === 'zu-gross' ? null : Math.max(1, Math.round(speed(hw.bandwidthGBs))) }
  }

  // Eigene Grafikkarte (CUDA/Vulkan): am schnellsten, wenn alles in den Grafikspeicher passt
  if (needed <= hw.vramBytes * 0.95) return { fit: 'gut', tokensPerSec: Math.max(1, Math.round(speed(hw.bandwidthGBs))) }
  if (needed <= hw.vramBytes + hw.ramBytes - 4 * GB) {
    // Teil auf der GPU, Rest im Arbeitsspeicher – der langsame Teil bremst alles
    const onGpu = Math.min(1, (hw.vramBytes * 0.9) / sizeBytes)
    const secPerToken =
      (activeBytes * onGpu) / (hw.bandwidthGBs * 1e9 * 0.6) + (activeBytes * (1 - onGpu)) / (hw.ramBandwidthGBs * 1e9 * 0.6)
    return {
      fit: 'knapp',
      tokensPerSec: Math.max(1, Math.round(1 / secPerToken)),
      note: `Passt nicht ganz in den Grafikspeicher (${Math.round(hw.vramBytes / GB)} GB) – ein Teil läuft auf der CPU, das bremst.`
    }
  }
  return { fit: 'zu-gross', tokensPerSec: null }
}
