import { useCallback, useEffect, useState } from 'react'
import type { GitFileStatus, GitHubAccount, GitStatus } from '../../../shared/types'
import { Icon } from './Icon'

interface Props {
  root: string | null
  onOpenFolder: () => void
  onOpenFile: (path: string) => void
}

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Lokal%20IDE'

const STATUS_LABEL: Record<GitFileStatus, { letter: string; title: string }> = {
  modified: { letter: 'M', title: 'Geändert' },
  added: { letter: 'A', title: 'Hinzugefügt' },
  deleted: { letter: 'D', title: 'Gelöscht' },
  renamed: { letter: 'R', title: 'Umbenannt' },
  untracked: { letter: 'U', title: 'Neu (noch nicht versioniert)' },
  conflict: { letter: '!', title: 'Konflikt' }
}

/** IPC-Fehler enthalten ein technisches Präfix – nur die eigentliche Meldung zeigen. */
function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** "https://github.com/user/repo.git" → "user/repo" */
function repoName(url: string): string {
  return url.replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '')
}

function webUrl(remote: string): string | null {
  const m = remote.match(/github\.com[:/](.+?)(\.git)?$/)
  return m ? `https://github.com/${m[1]}` : null
}

export default function GitPanel({ root, onOpenFolder, onOpenFile }: Props): React.JSX.Element {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [account, setAccount] = useState<GitHubAccount | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  // Abgewählte Dateien merken – neue Änderungen sind so automatisch ausgewählt
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    if (!root) return
    try {
      setStatus(await window.api.git.status(root))
    } catch (err) {
      setError(errorText(err))
    }
  }, [root])

  // Status regelmäßig und beim Zurückkehren ins Fenster aktualisieren
  useEffect(() => {
    setStatus(null)
    void refresh()
    const timer = setInterval(refresh, 4000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  useEffect(() => {
    window.api.github.account().then(setAccount).catch(() => setAccount(null))
  }, [])

  /** Führt eine Aktion aus, zeigt Fortschritt und Fehler an und lädt danach den Status neu. */
  const run = async (label: string, action: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setBusy(label)
    setError(null)
    setNotice(null)
    try {
      await action()
      if (success) setNotice(success)
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    } finally {
      setBusy(null)
      await refresh()
    }
  }

  if (!root) {
    return (
      <div className="empty-hint">
        <p>Öffne einen Ordner, um Git zu nutzen.</p>
        <button className="btn primary" onClick={onOpenFolder}>
          Ordner öffnen
        </button>
      </div>
    )
  }

  const messages = (
    <>
      {busy && <div className="git-msg busy">{busy} …</div>}
      {error && (
        <div className="git-msg err" onClick={() => setError(null)} title="Klicken zum Schließen">
          {error}
        </div>
      )}
      {notice && (
        <div className="git-msg ok" onClick={() => setNotice(null)} title="Klicken zum Schließen">
          {notice}
        </div>
      )}
    </>
  )

  if (!status) return <div className="empty-hint">Lade …</div>

  if (!status.isRepo) {
    return (
      <div className="git-panel">
        {messages}
        <div className="empty-hint">
          <p>Dieser Ordner ist noch kein Git-Repository.</p>
          <button className="btn primary" disabled={!!busy} onClick={() => run('Erstelle Repository', () => window.api.git.init(root))}>
            Git-Repository erstellen
          </button>
        </div>
      </div>
    )
  }

  const dir = status.root
  const selected = status.files.filter((f) => !excluded.has(f.path))
  const allSelected = selected.length === status.files.length

  const toggle = (path: string): void =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const doCommit = async (): Promise<void> => {
    const ok = await run(
      'Committe',
      () => window.api.git.commit(dir, message, selected.map((f) => f.path)),
      `${selected.length} Datei${selected.length === 1 ? '' : 'en'} committet.`
    )
    if (ok) {
      setMessage('')
      setExcluded(new Set())
    }
  }

  const canCommit = !busy && message.trim() !== '' && selected.length > 0 && status.identity !== null

  return (
    <div className="git-panel">
      {/* Branch und Synchronisierung */}
      <div className="git-branch">
        <Icon name="git" size={14} />
        <span className="git-branch-name" title={status.upstream ?? 'Kein Upstream'}>
          {status.branch}
        </span>
        <span className="spacer" />
        {status.remoteUrl && (
          <>
            <button className="icon-btn" title="Pull – Änderungen von GitHub holen" disabled={!!busy} onClick={() => run('Hole Änderungen', () => window.api.git.pull(dir), 'Auf dem neuesten Stand.')}>
              <Icon name="arrow-down" size={15} />
              {status.behind > 0 && <span className="git-count">{status.behind}</span>}
            </button>
            <button className="icon-btn" title="Push – Commits zu GitHub hochladen" disabled={!!busy || !status.hasCommits} onClick={() => run('Lade hoch', () => window.api.git.push(dir), 'Hochgeladen.')}>
              <Icon name="arrow-up" size={15} />
              {(status.ahead > 0 || !status.upstream) && <span className="git-count">{status.upstream ? status.ahead : '•'}</span>}
            </button>
          </>
        )}
        <button className="icon-btn" title="Aktualisieren" onClick={() => void refresh()}>
          <Icon name="refresh" size={15} />
        </button>
      </div>

      {messages}

      {!status.identity && <IdentityForm busy={!!busy} onSave={(n, e) => run('Speichere Autor', () => window.api.git.setIdentity(dir, n, e))} />}

      {/* Commit */}
      <div className="git-commit">
        <textarea
          rows={3}
          placeholder="Commit-Nachricht (⌘↩ zum Committen)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey && canCommit) void doCommit()
          }}
        />
        <button className="btn primary" disabled={!canCommit} onClick={doCommit}>
          <Icon name="check" size={14} /> Commit{selected.length > 0 ? ` (${selected.length})` : ''}
        </button>
      </div>

      {/* Änderungen */}
      <div className="git-section-title">
        <label className="git-check" title="Alle aus-/abwählen">
          <input
            type="checkbox"
            checked={status.files.length > 0 && allSelected}
            disabled={status.files.length === 0}
            onChange={() => setExcluded(allSelected ? new Set(status.files.map((f) => f.path)) : new Set())}
          />
        </label>
        Änderungen <span className="git-count">{status.files.length}</span>
      </div>
      <div className="git-files">
        {status.files.length === 0 && <div className="empty-hint">Keine Änderungen.</div>}
        {status.files.map((f) => {
          const slash = f.rel.lastIndexOf('/')
          const label = STATUS_LABEL[f.status]
          return (
            <div key={f.path} className="git-file" title={f.rel}>
              <input type="checkbox" checked={!excluded.has(f.path)} onChange={() => toggle(f.path)} />
              <span
                className={`git-file-name ${f.status === 'deleted' ? 'deleted' : ''}`}
                onClick={() => f.status !== 'deleted' && onOpenFile(f.path)}
              >
                {f.rel.slice(slash + 1)}
                {slash > 0 && <span className="git-file-dir">{f.rel.slice(0, slash)}</span>}
              </span>
              <span className={`git-status s-${f.status}`} title={label.title}>
                {label.letter}
              </span>
            </div>
          )
        })}
      </div>

      <GitHubSection
        dir={dir}
        status={status}
        account={account}
        busy={!!busy}
        run={run}
        onAccount={setAccount}
      />
    </div>
  )
}

function IdentityForm({ busy, onSave }: { busy: boolean; onSave: (name: string, email: string) => void }): React.JSX.Element {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  return (
    <div className="git-box">
      <p>Wer soll als Autor in den Commits stehen?</p>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn" disabled={busy || !name.trim() || !email.trim()} onClick={() => onSave(name.trim(), email.trim())}>
        Speichern
      </button>
    </div>
  )
}

function GitHubSection({
  dir,
  status,
  account,
  busy,
  run,
  onAccount
}: {
  dir: string
  status: Extract<GitStatus, { isRepo: true }>
  account: GitHubAccount | null | undefined
  busy: boolean
  run: (label: string, action: () => Promise<unknown>, success?: string) => Promise<boolean>
  onAccount: (a: GitHubAccount | null) => void
}): React.JSX.Element {
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState(dir.split('/').pop()?.replace(/\s+/g, '-') ?? 'projekt')
  const [isPrivate, setIsPrivate] = useState(true)
  const [editRemote, setEditRemote] = useState(false)
  const [remoteInput, setRemoteInput] = useState('')

  const connect = (): Promise<boolean> =>
    run('Verbinde mit GitHub', async () => {
      onAccount(await window.api.github.connect(token))
      setToken('')
    }, 'Mit GitHub verbunden.')

  const saveRemote = async (): Promise<void> => {
    const ok = await run('Speichere Remote', () => window.api.git.setRemote(dir, remoteInput.trim()), 'Remote gespeichert.')
    if (ok) setEditRemote(false)
  }

  const web = status.remoteUrl ? webUrl(status.remoteUrl) : null

  return (
    <div className="git-github">
      <div className="git-section-title">GitHub</div>

      {/* Konto */}
      {account === undefined ? null : account ? (
        <div className="git-account">
          <img src={account.avatarUrl} alt="" />
          <span>
            Angemeldet als <b>{account.login}</b>
          </span>
          <span className="spacer" />
          <button
            className="link-btn"
            disabled={busy}
            onClick={() => run('Melde ab', async () => {
              await window.api.github.disconnect()
              onAccount(null)
            })}
          >
            Abmelden
          </button>
        </div>
      ) : (
        <div className="git-box">
          <p>
            Verbinde dein GitHub-Konto mit einem Zugangs-Token. Er wird nur im macOS-Schlüsselbund gespeichert.
          </p>
          <ol>
            <li>
              <button className="text-link" onClick={() => window.api.openUrl(TOKEN_URL)}>
                Token auf GitHub erstellen
              </button>{' '}
              (Haken bei „repo“ ist schon gesetzt)
            </li>
            <li>Token kopieren und hier einfügen:</li>
          </ol>
          <input
            type="password"
            placeholder="ghp_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && token.trim() && void connect()}
          />
          <button className="btn primary" disabled={busy || !token.trim()} onClick={connect}>
            Verbinden
          </button>
        </div>
      )}

      {/* Remote */}
      {status.remoteUrl && !editRemote ? (
        <div className="git-remote">
          <span className="muted">Repository:</span>{' '}
          {web ? (
            <button className="text-link" onClick={() => window.api.openUrl(web)}>
              {repoName(status.remoteUrl)}
            </button>
          ) : (
            <span>{status.remoteUrl}</span>
          )}
          <button
            className="link-btn"
            onClick={() => {
              setRemoteInput(status.remoteUrl ?? '')
              setEditRemote(true)
            }}
          >
            Ändern
          </button>
        </div>
      ) : (
        <>
          {!status.remoteUrl && account && (
            <div className="git-box">
              <p>Neues Repository auf GitHub anlegen und den Code hochladen:</p>
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Name des Repositorys" />
              <label className="git-check-label">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Privat
              </label>
              <button
                className="btn primary"
                disabled={busy || !repo.trim()}
                onClick={() =>
                  run(
                    'Veröffentliche auf GitHub',
                    () => window.api.github.publish(dir, repo.trim(), isPrivate),
                    status.hasCommits ? 'Auf GitHub veröffentlicht.' : 'Repository angelegt. Mach einen Commit und lade ihn hoch.'
                  )
                }
              >
                Auf GitHub veröffentlichen
              </button>
            </div>
          )}
          <div className="git-box">
            <p>{status.remoteUrl ? 'Remote-URL ändern:' : 'Oder ein vorhandenes Repository verknüpfen:'}</p>
            <input
              placeholder="https://github.com/name/repo.git"
              value={remoteInput}
              onChange={(e) => setRemoteInput(e.target.value)}
            />
            <div className="git-row">
              <button className="btn" disabled={busy || !remoteInput.trim()} onClick={saveRemote}>
                Speichern
              </button>
              {editRemote && (
                <button className="link-btn" onClick={() => setEditRemote(false)}>
                  Abbrechen
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
