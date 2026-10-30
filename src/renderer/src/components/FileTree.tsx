import { useEffect, useState } from 'react'
import type { DirEntry } from '../../../shared/types'
import { Icon } from './Icon'

interface Props {
  root: string
  activePath?: string
  onOpen: (path: string) => void
}

export default function FileTree({ root, activePath, onOpen }: Props): React.JSX.Element {
  return (
    <div className="filetree">
      {/* key: beim Wechsel des Ordners den Baum neu laden */}
      <Folder key={root} path={root} depth={0} activePath={activePath} onOpen={onOpen} initiallyOpen />
    </div>
  )
}

function Folder({
  path,
  depth,
  activePath,
  onOpen,
  initiallyOpen = false
}: {
  path: string
  depth: number
  activePath?: string
  onOpen: (p: string) => void
  initiallyOpen?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(initiallyOpen)
  const [entries, setEntries] = useState<DirEntry[] | null>(null)

  // Inhalte erst laden, wenn der Ordner aufgeklappt wird
  useEffect(() => {
    if (open && entries === null) {
      window.api.fs.readDir(path).then(setEntries).catch(() => setEntries([]))
    }
  }, [open, entries, path])

  const name = path.split('/').pop()

  return (
    <div>
      {depth > 0 && (
        <div className="tree-row" style={{ paddingLeft: depth * 12 }} onClick={() => setOpen((v) => !v)}>
          <span className={`chevron ${open ? 'open' : ''}`}>
            <Icon name="chevron" size={14} />
          </span>
          <span className="tree-name">{name}</span>
        </div>
      )}
      {open &&
        entries?.map((e) =>
          e.isDir ? (
            <Folder key={e.path} path={e.path} depth={depth + 1} activePath={activePath} onOpen={onOpen} />
          ) : (
            <div
              key={e.path}
              className={`tree-row ${activePath === e.path ? 'selected' : ''}`}
              style={{ paddingLeft: (depth + 1) * 12 + 14 }}
              onClick={() => onOpen(e.path)}
            >
              <span className="tree-name">{e.name}</span>
            </div>
          )
        )}
    </div>
  )
}
