import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { makeStyles } from '@fluentui/react-components'
import type { Session } from '@shared/types'

declare const tangentAPI: {
  shell: {
    openEditor: (folderPath: string) => Promise<void>
    openInExplorer: (folderPath: string) => Promise<void>
    getEditor: () => Promise<string>
    setEditor: (editor: string) => Promise<void>
  }
}

interface StatusBarProps {
  sessions: Session[]
  activeSession: Session | undefined
  onToggleSettings: () => void
  onToggleHub?: () => void
  hubOpen?: boolean
}

const AGENT_LABELS: Record<string, string> = {
  'copilot-cli': 'Copilot CLI',
  'claude-code': 'Claude Code',
  shell: 'Shell'
}

function truncatePathLeft(p: string, maxLen: number): string {
  if (p.length <= maxLen) return p
  return '\u2026' + p.slice(p.length - maxLen + 1)
}

function truncateRight(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '\u2026'
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

const useStyles = makeStyles({
  root: {
    height: '24px',
    minHeight: '24px',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '12px',
    paddingRight: '12px',
    fontSize: '12px',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--bg-hover)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  statusDot: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  separator: {
    marginLeft: '8px',
    marginRight: '8px',
    color: 'var(--text-muted)',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  bareBtn: {
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: 'var(--text-muted)',
    ':hover': {
      textDecorationLine: 'underline',
    },
  },
  pathBtn: {
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: 'var(--text-muted)',
    ':hover': {
      textDecorationLine: 'underline',
    },
  },
  editorPopup: {
    position: 'absolute',
    bottom: '24px',
    right: 0,
    padding: '8px',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: 'var(--bg-secondary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
  },
  editorInput: {
    paddingLeft: '6px',
    paddingRight: '6px',
    paddingTop: '2px',
    paddingBottom: '2px',
    fontSize: '12px',
    borderRadius: '4px',
    width: '120px',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
  },
  editorSaveBtn: {
    paddingLeft: '6px',
    paddingRight: '6px',
    paddingTop: '2px',
    paddingBottom: '2px',
    fontSize: '12px',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--text-primary)',
    borderWidth: 0,
  },
})

export function StatusBar({ sessions, activeSession, onToggleSettings, onToggleHub, hubOpen }: StatusBarProps) {
  const s = useStyles()
  const [editorPopupOpen, setEditorPopupOpen] = useState(false)
  const [editorValue, setEditorValue] = useState('')
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const statusCounts = useMemo(() => {
    let running = 0, idle = 0, error = 0
    for (const sess of sessions) {
      if (sess.agentType === 'shell') continue
      if (sess.status === 'processing' || sess.status === 'tool_executing') running++
      else if (sess.status === 'agent_ready' || sess.status === 'agent_launching' || sess.status === 'needs_input') idle++
      else if (sess.status === 'failed') error++
    }
    return { running, idle, error }
  }, [sessions])

  const agentLabel = activeSession ? AGENT_LABELS[activeSession.agentType] ?? activeSession.agentType : 'No Session'
  const lastActivity = activeSession ? truncateRight(activeSession.lastActivity || '', 40) : ''
  const cwdPath = activeSession ? truncatePathLeft(activeSession.folderPath || '', 50) : ''

  const handleEditorClick = useCallback(() => {
    if (activeSession?.folderPath) tangentAPI.shell.openEditor(activeSession.folderPath)
  }, [activeSession?.folderPath])

  const handleEditorContextMenu = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    const current = await tangentAPI.shell.getEditor()
    setEditorValue(current)
    setEditorPopupOpen(true)
  }, [])

  const handleEditorSave = useCallback(async () => {
    if (editorValue.trim()) await tangentAPI.shell.setEditor(editorValue.trim())
    setEditorPopupOpen(false)
  }, [editorValue])

  useEffect(() => {
    if (editorPopupOpen && inputRef.current) { inputRef.current.focus(); inputRef.current.select() }
  }, [editorPopupOpen])

  useEffect(() => {
    if (!editorPopupOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setEditorPopupOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editorPopupOpen])

  return (
    <div className={s.root}>
      <div className={s.left}>
        {statusCounts.running > 0 && (
          <span className={s.statusDot}>
            <span style={{ color: 'var(--running)' }}>{'\u25CF'}</span>
            <span>{statusCounts.running}</span>
          </span>
        )}
        {statusCounts.idle > 0 && (
          <span className={s.statusDot}>
            <span style={{ color: 'var(--idle)' }}>{'\u25CF'}</span>
            <span>{statusCounts.idle}</span>
          </span>
        )}
        {statusCounts.error > 0 && (
          <span className={s.statusDot}>
            <span style={{ color: 'var(--error)' }}>{'\u25CF'}</span>
            <span>{statusCounts.error}</span>
          </span>
        )}
        {statusCounts.running === 0 && statusCounts.idle === 0 && statusCounts.error === 0 && (
          <span style={{ color: 'var(--text-muted)' }}>{'\u25CB'}</span>
        )}
      </div>

      <span className={s.separator}>{'\u2502'}</span>

      <div className={s.center}>
        <span style={{ color: 'var(--text-primary)' }}>{agentLabel}</span>
        {lastActivity && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastActivity}</span>
          </>
        )}
      </div>

      <span className={s.spacer} />

      <div className={s.right}>
        {activeSession?.metrics && (activeSession.metrics.inputTokens > 0 || activeSession.metrics.outputTokens > 0) && (
          <>
            <span style={{ color: 'var(--text-muted)' }} title="Token usage (input / output)">
              {formatTokens(activeSession.metrics.inputTokens)}/{formatTokens(activeSession.metrics.outputTokens)}
            </span>
            {activeSession.metrics.cost > 0 && (
              <span style={{ color: 'var(--text-muted)' }} title="Estimated cost">
                ${activeSession.metrics.cost.toFixed(4)}
              </span>
            )}
            <span className={s.separator}>{'\u2502'}</span>
          </>
        )}
        {cwdPath && (
          <button
            type="button"
            className={s.pathBtn}
            title={`Open ${activeSession?.folderPath} in file explorer`}
            onClick={() => activeSession?.folderPath && tangentAPI.shell.openInExplorer(activeSession.folderPath)}
          >
            {cwdPath}
          </button>
        )}
        {activeSession?.folderPath && (
          <span style={{ position: 'relative' }}>
            <button type="button" onClick={handleEditorClick} onContextMenu={handleEditorContextMenu} className={s.bareBtn} title="Open in editor (right-click to configure)">
              Editor
            </button>
            {editorPopupOpen && (
              <div ref={popupRef} className={s.editorPopup}>
                <input
                  ref={inputRef}
                  type="text"
                  value={editorValue}
                  onChange={(e) => setEditorValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditorSave(); if (e.key === 'Escape') setEditorPopupOpen(false) }}
                  className={s.editorInput}
                  placeholder="e.g. code"
                />
                <button type="button" onClick={handleEditorSave} className={s.editorSaveBtn}>Save</button>
              </div>
            )}
          </span>
        )}
        <span className={s.separator}>{'\u2502'}</span>
        <button type="button" onClick={onToggleSettings} className={s.bareBtn} title="Settings">⚙</button>
        {onToggleHub && (
          <>
            <span className={s.separator}>{'\u2502'}</span>
            <button
              type="button"
              onClick={onToggleHub}
              className={s.bareBtn}
              style={{ color: hubOpen ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: hubOpen ? 600 : undefined }}
              title="Toggle GitHub Usage dashboard"
            >
              GitHub Usage
            </button>
            {hubOpen && (
              <>
                <span className={s.separator}>{'\u2502'}</span>
                <button type="button" onClick={onToggleHub} className={s.bareBtn} style={{ color: 'var(--text-primary)', fontWeight: 600 }} title="Return to main terminal view">
                  Back to Main
                </button>
              </>
            )}
          </>
        )}
        <span className={s.separator}>{'\u2502'}</span>
        <span style={{ color: 'var(--text-muted)' }}>Ctrl+B panels</span>
      </div>
    </div>
  )
}
