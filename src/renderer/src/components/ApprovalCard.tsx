import { useMemo, useState } from 'react'
import type { ApprovalAnswer, ApprovalRequest } from '../../../shared/types'
import { t } from '../i18n'

interface Props {
  req: ApprovalRequest
  onAnswer: (a: ApprovalAnswer) => void
}

/** Asks the user before the agent changes a file or runs a command. */
export default function ApprovalCard({ req, onAnswer }: Props): React.JSX.Element {
  const [reason, setReason] = useState('')

  const title =
    req.kind === 'command'
      ? t('Run command?')
      : req.kind === 'edit'
        ? t('Change file: {file}', { file: req.relPath ?? '' })
        : req.isNew
          ? t('Create new file: {file}', { file: req.relPath ?? '' })
          : t('Overwrite file: {file}', { file: req.relPath ?? '' })

  return (
    <div className={`approval ${req.danger ? 'danger' : ''}`}>
      <div className="approval-title">{title}</div>
      {req.danger && <div className="approval-danger">⚠ {t('{reason} – please check carefully.', { reason: req.danger })}</div>}

      {req.kind === 'command' ? (
        <pre className="approval-command">$ {req.command}</pre>
      ) : (
        <Diff before={req.before ?? ''} after={req.after ?? ''} />
      )}

      <input
        className="approval-reason"
        placeholder={t('Optional: note to the model, e.g. why not')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onAnswer({ id: req.id, approved: false, reason: reason.trim() || undefined })}
      />
      <div className="approval-actions">
        <button className="btn primary" onClick={() => onAnswer({ id: req.id, approved: true })}>
          {t('Allow')}
        </button>
        <button className="btn" onClick={() => onAnswer({ id: req.id, approved: false, reason: reason.trim() || undefined })}>
          {t('Decline')}
        </button>
        {!req.danger && (
          <button
            className="link-btn"
            title={t('Allow similar actions without asking until the next new chat')}
            onClick={() => onAnswer({ id: req.id, approved: true, always: true })}
          >
            {req.kind === 'command' ? t('Always allow commands in this chat') : t('Always allow file changes in this chat')}
          </button>
        )}
      </div>
    </div>
  )
}

type Line = { type: ' ' | '+' | '-'; text: string } | { type: '…'; count: number }

/** Line-by-line diff (longest common subsequence), unchanged blocks are collapsed. */
function lineDiff(before: string, after: string): Line[] {
  const a = before === '' ? [] : before.split('\n')
  const b = after.split('\n')
  // For very large files the table would be too expensive – then just show old against new
  if (a.length * b.length > 4_000_000) {
    return [...a.map((text) => ({ type: '-' as const, text })), ...b.map((text) => ({ type: '+' as const, text }))]
  }
  const n = a.length
  const m = b.length
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])

  const out: { type: ' ' | '+' | '-'; text: string }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: ' ', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ type: '-', text: a[i++] })
    else out.push({ type: '+', text: b[j++] })
  }
  while (i < n) out.push({ type: '-', text: a[i++] })
  while (j < m) out.push({ type: '+', text: b[j++] })

  // Only show 3 lines of context around changes
  const keep = out.map(() => false)
  out.forEach((l, k) => {
    if (l.type !== ' ') for (let d = -3; d <= 3; d++) if (out[k + d]) keep[k + d] = true
  })
  const result: Line[] = []
  let skipped = 0
  out.forEach((l, k) => {
    if (keep[k]) {
      if (skipped) result.push({ type: '…', count: skipped })
      skipped = 0
      result.push(l)
    } else skipped++
  })
  if (skipped) result.push({ type: '…', count: skipped })
  return result
}

function Diff({ before, after }: { before: string; after: string }): React.JSX.Element {
  const lines = useMemo(() => lineDiff(before, after), [before, after])
  const added = lines.filter((l) => l.type === '+').length
  const removed = lines.filter((l) => l.type === '-').length
  return (
    <div className="diff">
      <div className="diff-stats">
        <span className="diff-add">+{added}</span> <span className="diff-del">−{removed}</span>
      </div>
      <pre>
        {lines.map((l, k) =>
          l.type === '…' ? (
            <div key={k} className="diff-skip">
              ⋯ {t('{count} unchanged lines', { count: l.count })}
            </div>
          ) : (
            <div key={k} className={l.type === '+' ? 'diff-add' : l.type === '-' ? 'diff-del' : ''}>
              {l.type} {l.text}
            </div>
          )
        )}
      </pre>
    </div>
  )
}
