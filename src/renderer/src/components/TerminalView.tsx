import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface Instance {
  term: Terminal
  fit: FitAddon
  /** Wird einmal geöffnet und dann zwischen den Containern verschoben */
  el: HTMLDivElement
}

const instances = new Map<string, Instance>()
/** Ausgabe, die ankommt, bevor das Terminal gezeichnet wurde */
const early = new Map<string, string[]>()

// Ein gemeinsamer Empfänger für alle Terminals
window.api.terminal.onData(({ id, data }) => {
  const inst = instances.get(id)
  if (inst) inst.term.write(data)
  else early.set(id, [...(early.get(id) ?? []), data])
})
window.api.terminal.onExit(({ id, code }) => {
  instances.get(id)?.term.write(`\r\n\x1b[90m[Prozess beendet mit Code ${code}]\x1b[0m\r\n`)
})

const THEME = {
  background: '#1e1f22',
  foreground: '#dfe1e5',
  cursor: '#dfe1e5',
  selectionBackground: '#4f8cff55',
  black: '#1e1f22',
  red: '#e5636a',
  green: '#4fbf7a',
  yellow: '#e0a84a',
  blue: '#4f8cff',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#dfe1e5',
  brightBlack: '#6b6e75',
  brightRed: '#ff7b82',
  brightGreen: '#6bd896',
  brightYellow: '#f2c26b',
  brightBlue: '#79a9ff',
  brightMagenta: '#d891ef',
  brightCyan: '#71cbd6',
  brightWhite: '#ffffff'
}

function instance(id: string): Instance {
  let inst = instances.get(id)
  if (inst) return inst
  const term = new Terminal({
    fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
    fontSize: 12.5,
    lineHeight: 1.15,
    cursorBlink: true,
    scrollback: 10000,
    allowProposedApi: true,
    macOptionIsMeta: true,
    theme: THEME
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.onData((d) => void window.api.terminal.write(id, d))
  term.onResize(({ cols, rows }) => void window.api.terminal.resize(id, cols, rows))
  // Cmd+C kopiert die Auswahl, Cmd+K leert das Terminal (wie im macOS-Terminal)
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown' || !(e.metaKey || (e.ctrlKey && e.shiftKey))) return true
    const k = e.key.toLowerCase()
    if (k === 'c' && term.hasSelection()) {
      void window.api.copy(term.getSelection())
      return false
    }
    if (k === 'k' && e.metaKey) {
      term.clear()
      return false
    }
    return true
  })
  const el = document.createElement('div')
  el.className = 'xterm-host'
  inst = { term, fit, el }
  instances.set(id, inst)
  return inst
}

export function disposeTerminal(id: string): void {
  instances.get(id)?.term.dispose()
  instances.delete(id)
  early.delete(id)
}

export function focusTerminal(id: string): void {
  instances.get(id)?.term.focus()
}

/** Zeigt ein Terminal an. Bleibt beim Tab-Wechsel erhalten, nur das DOM-Element wandert. */
export default function TerminalView({ id, visible }: { id: string; visible: boolean }): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const inst = instance(id)
    const container = box.current!
    container.appendChild(inst.el)
    if (!inst.term.element) {
      inst.term.open(inst.el)
      for (const d of early.get(id) ?? []) inst.term.write(d)
      early.delete(id)
    }
    const doFit = (): void => {
      // Ausgeblendet hat der Container keine Größe
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        try {
          inst.fit.fit()
        } catch {
          /* noch nicht gezeichnet */
        }
      }
    }
    const ro = new ResizeObserver(doFit)
    ro.observe(container)
    doFit()
    return () => {
      ro.disconnect()
      if (inst.el.parentElement === container) container.removeChild(inst.el)
    }
  }, [id])

  useEffect(() => {
    if (visible) {
      const inst = instances.get(id)
      requestAnimationFrame(() => {
        try {
          inst?.fit.fit()
        } catch {
          /* ignorieren */
        }
        inst?.term.focus()
      })
    }
  }, [visible, id])

  return <div className="terminal-box" ref={box} style={{ display: visible ? 'block' : 'none' }} />
}
