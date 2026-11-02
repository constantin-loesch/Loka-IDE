import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { DirEntry } from '../../../shared/types'
import { Icon } from './Icon'

/** Befehle aus der Kopfzeile des Explorers. */
export interface FileTreeHandle {
  newFile: () => void
  newFolder: () => void
  refresh: () => void
  collapseAll: () => void
}

interface Props {
  root: string
  activePath?: string
  onOpen: (path: string) => void
  /** Datei oder Ordner wurde umbenannt/verschoben – offene Tabs anpassen */
  onRenamed: (from: string, to: string) => void
  /** Datei oder Ordner liegt jetzt im Papierkorb */
  onDeleted: (path: string) => void
  onOpenTerminal: (dir: string) => void
  ref?: Ref<FileTreeHandle>
}

type Editing =
  | { mode: 'new-file' | 'new-folder'; parent: string }
  | { mode: 'rename'; path: string; isDir: boolean }
  | null

interface Menu {
  x: number
  y: number
  entry: DirEntry | null
}

const dirname = (p: string): string => p.slice(0, p.lastIndexOf('/')) || '/'
const basename = (p: string): string => p.slice(p.lastIndexOf('/') + 1)

export default function FileTree({ root, activePath, onOpen, onRenamed, onDeleted, onOpenTerminal, ref }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([root]))
  const [children, setChildren] = useState<Record<string, DirEntry[]>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (dir: string) => {
    const entries = await window.api.fs.readDir(dir).catch(() => null)
    setChildren((prev) => {
      const next = { ...prev }
      if (entries) next[dir] = entries
      else delete next[dir]
      return next
    })
    // Ordner gibt es nicht mehr: aus den aufgeklappten entfernen
    if (!entries) setExpanded((prev) => (prev.has(dir) && dir !== root ? new Set([...prev].filter((d) => d !== dir)) : prev))
  }, [root])

  // Aufgeklappte Ordner laden und beobachten (Änderungen aus Terminal, Git, Agent …)
  // Jeder aufgeklappte Ordner wird einmal geladen; danach halten ihn die Datei-Ereignisse aktuell
  const requested = useRef(new Set<string>())
  useEffect(() => {
    for (const dir of requested.current) if (!expanded.has(dir)) requested.current.delete(dir)
    for (const dir of expanded) {
      if (requested.current.has(dir)) continue
      requested.current.add(dir)
      void load(dir)
    }
    void window.api.fs.watch([...expanded])
  }, [expanded, load])

  useEffect(() => () => void window.api.fs.watch([]), [])

  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  useEffect(
    () =>
      window.api.fs.onChanged((dir) => {
        if (expandedRef.current.has(dir)) void load(dir)
      }),
    [load]
  )

  const isDir = (path: string): boolean =>
    path === root || Object.values(children).some((list) => list.some((e) => e.path === path && e.isDir))

  /** Zielordner für „Neue Datei“: der ausgewählte Ordner bzw. der Ordner der ausgewählten Datei. */
  const targetDir = (): string => {
    if (!selected || !selected.startsWith(root)) return root
    return isDir(selected) ? selected : dirname(selected)
  }

  const startNew = (mode: 'new-file' | 'new-folder', parent = targetDir()): void => {
    setExpanded((prev) => new Set([...prev, parent]))
    setEditing({ mode, parent })
    setMenu(null)
  }

  const refresh = (): void => {
    for (const dir of expanded) void load(dir)
  }

  useImperativeHandle(ref, () => ({
    newFile: () => startNew('new-file'),
    newFolder: () => startNew('new-folder'),
    refresh,
    collapseAll: () => setExpanded(new Set([root]))
  }))

  const toggle = (dir: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) {
        // Unterordner mit zuklappen
        for (const d of prev) if (d === dir || d.startsWith(dir + '/')) next.delete(d)
      } else next.add(dir)
      return next
    })
  }

  /** Eingabe übernehmen. Gibt eine Fehlermeldung zurück oder null. */
  const commit = async (name: string): Promise<string | null> => {
    if (!editing) return null
    const clean = name.trim().replace(/\/+$/, '')
    if (!clean) {
      setEditing(null)
      return null
    }
    if (clean.startsWith('/') || clean.split('/').some((p) => p === '..' || p === '.')) return 'Ungültiger Name'
    try {
      if (editing.mode === 'rename') {
        const to = `${dirname(editing.path)}/${clean}`
        if (to !== editing.path) {
          await window.api.fs.rename(editing.path, to)
          onRenamed(editing.path, to)
          setSelected(to)
          // Aufgeklappte Unterordner mitnehmen
          setExpanded((prev) => new Set([...prev].map((d) => (d === editing.path || d.startsWith(editing.path + '/') ? to + d.slice(editing.path.length) : d))))
          await load(dirname(editing.path))
          await load(dirname(to))
        }
      } else {
        const path = `${editing.parent}/${clean}`
        if (editing.mode === 'new-file') await window.api.fs.createFile(path)
        else await window.api.fs.createDir(path)
        // „ordner/datei.ts“ legt Zwischenordner an – die aufklappen
        const dirs: string[] = []
        for (let d = editing.mode === 'new-file' ? dirname(path) : path; d.length > editing.parent.length; d = dirname(d)) dirs.push(d)
        setExpanded((prev) => new Set([...prev, editing.parent, ...dirs]))
        await load(editing.parent)
        for (const d of dirs) await load(d)
        setSelected(path)
        if (editing.mode === 'new-file') onOpen(path)
      }
      setEditing(null)
      return null
    } catch (err) {
      return String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    }
  }

  const remove = async (path: string): Promise<void> => {
    setMenu(null)
    if (path === root) return
    if (!confirm(`„${basename(path)}“ in den Papierkorb verschieben?`)) return
    try {
      await window.api.fs.trash(path)
      onDeleted(path)
      if (selected === path) setSelected(null)
      await load(dirname(path))
    } catch (err) {
      alert(`Löschen fehlgeschlagen:\n${err}`)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (editing || !selected || selected === root) return
    if (e.key === 'F2' || (e.key === 'Enter' && window.api.platform === 'darwin')) {
      e.preventDefault()
      setEditing({ mode: 'rename', path: selected, isDir: isDir(selected) })
    } else if (e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) {
      e.preventDefault()
      void remove(selected)
    }
  }

  // Kontextmenü schließen bei Klick daneben oder Escape
  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [menu])

  const openMenu = (e: React.MouseEvent, entry: DirEntry | null): void => {
    e.preventDefault()
    e.stopPropagation()
    if (entry) setSelected(entry.path)
    setMenu({ x: e.clientX, y: e.clientY, entry })
  }

  const renderInput = (depth: number, mode: 'new-file' | 'new-folder'): React.JSX.Element => (
    <div className="tree-row editing" style={{ paddingLeft: depth * 12 + (mode === 'new-folder' ? 0 : 14) }}>
      {mode === 'new-folder' && (
        <span className="chevron">
          <Icon name="chevron" size={14} />
        </span>
      )}
      <NameInput initial="" onCommit={commit} onCancel={() => setEditing(null)} />
    </div>
  )

  const renderDir = (dir: string, depth: number): React.JSX.Element[] => {
    const rows: React.JSX.Element[] = []
    if (editing && editing.mode !== 'rename' && editing.parent === dir) {
      rows.push(<div key="__new__">{renderInput(depth, editing.mode)}</div>)
    }
    for (const e of children[dir] ?? []) {
      const open = expanded.has(e.path)
      const renaming = editing?.mode === 'rename' && editing.path === e.path
      const cls = `tree-row ${selected === e.path || (!selected && activePath === e.path) ? 'selected' : ''} ${activePath === e.path ? 'active' : ''}`
      rows.push(
        <div key={e.path}>
          <div
            className={cls}
            style={{ paddingLeft: depth * 12 + (e.isDir ? 0 : 14) }}
            onClick={() => {
              setSelected(e.path)
              if (e.isDir) toggle(e.path)
              else onOpen(e.path)
            }}
            onContextMenu={(ev) => openMenu(ev, e)}
            title={e.path}
          >
            {e.isDir && (
              <span className={`chevron ${open ? 'open' : ''}`}>
                <Icon name="chevron" size={14} />
              </span>
            )}
            {renaming ? (
              <NameInput initial={e.name} selectStem={!e.isDir} onCommit={commit} onCancel={() => setEditing(null)} />
            ) : (
              <span className="tree-name">{e.name}</span>
            )}
          </div>
          {e.isDir && open && renderDir(e.path, depth + 1)}
        </div>
      )
    }
    return rows
  }

  const m = menu
  const menuDir = m ? (m.entry ? (m.entry.isDir ? m.entry.path : dirname(m.entry.path)) : root) : root
  const rel = (p: string): string => p.slice(root.length + 1) || '.'
  const revealLabel = window.api.platform === 'darwin' ? 'Im Finder zeigen' : 'Im Dateimanager zeigen'

  return (
    <div
      className="filetree"
      ref={treeRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => openMenu(e, null)}
      onClick={(e) => {
        // Klick auf freie Fläche: Auswahl aufheben, damit „Neue Datei“ ins Hauptverzeichnis geht
        if (e.target === e.currentTarget) setSelected(null)
      }}
    >
      {renderDir(root, 0)}

      {m && (
        <div className="context-menu" style={{ left: m.x, top: m.y }} onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={() => startNew('new-file', menuDir)}>Neue Datei …</button>
          <button onClick={() => startNew('new-folder', menuDir)}>Neuer Ordner …</button>
          <hr />
          {m.entry && !m.entry.isDir && (
            <button
              onClick={() => {
                setMenu(null)
                onOpen(m.entry!.path)
              }}
            >
              Öffnen
            </button>
          )}
          <button
            onClick={() => {
              setMenu(null)
              onOpenTerminal(menuDir)
            }}
          >
            Im Terminal öffnen
          </button>
          <button
            onClick={() => {
              setMenu(null)
              void window.api.fs.reveal(m.entry?.path ?? root)
            }}
          >
            {revealLabel}
          </button>
          <hr />
          <button
            onClick={() => {
              setMenu(null)
              void window.api.copy(m.entry?.path ?? root)
            }}
          >
            Pfad kopieren
          </button>
          <button
            onClick={() => {
              setMenu(null)
              void window.api.copy(rel(m.entry?.path ?? root))
            }}
          >
            Relativen Pfad kopieren
          </button>
          {m.entry && (
            <>
              <hr />
              <button
                onClick={() => {
                  setMenu(null)
                  setEditing({ mode: 'rename', path: m.entry!.path, isDir: m.entry!.isDir })
                }}
              >
                Umbenennen …<kbd>F2</kbd>
              </button>
              <button className="danger" onClick={() => void remove(m.entry!.path)}>
                In den Papierkorb
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Eingabefeld im Baum – Enter übernimmt, Escape bricht ab, Fehler erscheinen darunter. */
function NameInput({
  initial,
  selectStem = false,
  onCommit,
  onCancel
}: {
  initial: string
  selectStem?: boolean
  onCommit: (name: string) => Promise<string | null>
  onCancel: () => void
}): React.JSX.Element {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    // Wie VS Code: beim Umbenennen nur den Namen ohne Endung markieren
    const dot = initial.lastIndexOf('.')
    el.setSelectionRange(0, selectStem && dot > 0 ? dot : initial.length)
  }, [initial, selectStem])

  const submit = async (): Promise<void> => {
    if (busy.current) return
    busy.current = true
    const err = await onCommit(value)
    busy.current = false
    setError(err)
    if (err) inputRef.current?.focus()
  }

  return (
    <span className="tree-input">
      <input
        ref={inputRef}
        value={value}
        spellCheck={false}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') void submit()
          else if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => {
          if (!value.trim() || value === initial) onCancel()
          else if (!error) void submit()
        }}
      />
      {error && <span className="tree-input-error">{error}</span>}
    </span>
  )
}
