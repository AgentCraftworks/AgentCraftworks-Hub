import { useState, useRef, useEffect } from 'react'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { mapStatusToUI } from '@shared/statusMapping'
import type { Session } from '@shared/types'

interface SessionItemProps {
  session: Session
  isActive: boolean
  isHighlighted: boolean
  isRenaming: boolean
  onSelect: () => void
  onClose: () => void
  onRename: (name: string) => void
  onRenameCancel: () => void
  onCreateAgent?: () => void
}

const useStyles = makeStyles({
  root: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '8px',
    paddingBottom: '8px',
    marginBottom: '4px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  highlighted: {
    boxShadow: '0 0 0 1px var(--accent)',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  name: {
    fontSize: '13px',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
  },
  badge: {
    fontSize: '10px',
    paddingLeft: '6px',
    paddingRight: '6px',
    paddingTop: '2px',
    paddingBottom: '2px',
    borderRadius: '999px',
    flexShrink: 0,
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
  },
  extBadge: {
    fontSize: '10px',
    paddingLeft: '6px',
    paddingRight: '6px',
    paddingTop: '2px',
    paddingBottom: '2px',
    borderRadius: '999px',
    flexShrink: 0,
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--error)',
  },
  activity: {
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontStyle: 'italic',
    color: 'var(--text-secondary)',
  },
  closeBtn: {
    opacity: 0,
    fontSize: '12px',
    paddingLeft: '4px',
    paddingRight: '4px',
    borderRadius: '4px',
    flexShrink: 0,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderWidth: 0,
    ':hover': {
      backgroundColor: 'var(--bg-hover)',
    },
  },
  closeBtnVisible: {
    opacity: 1,
  },
  renameInput: {
    fontSize: '13px',
    fontWeight: 500,
    width: '100%',
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: 0,
    paddingBottom: 0,
    borderRadius: '4px',
    outlineStyle: 'none',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent)',
  },
  contextMenu: {
    position: 'fixed',
    zIndex: 50,
    paddingTop: '4px',
    paddingBottom: '4px',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    minWidth: '180px',
    backgroundColor: 'var(--bg-secondary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
  },
  contextMenuItem: {
    width: '100%',
    textAlign: 'left' as const,
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '6px',
    paddingBottom: '6px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--bg-hover)',
    },
  },
})

export function SessionItem({
  session,
  isActive,
  isHighlighted,
  isRenaming,
  onSelect,
  onClose,
  onRename,
  onRenameCancel,
  onCreateAgent
}: SessionItemProps) {
  const s = useStyles()
  const ui = mapStatusToUI(session.status)
  const [renameValue, setRenameValue] = useState(session.name)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [hovered, setHovered] = useState(false)

  const bgStyle = isActive ? ui.bgTintSelected : ui.bgTint
  const borderLeft = ui.barColor ? `3px solid var(${ui.barColor})` : '3px solid transparent'
  const shadow = isActive ? ui.glowShadow : 'none'
  const barAnimClass = ui.label === 'error' ? 'animate-pulse-fast' : ''

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(session.name)
      setTimeout(() => renameInputRef.current?.focus(), 0)
    }
  }, [isRenaming, session.name])

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== session.name) {
      onRename(trimmed)
    } else {
      onRenameCancel()
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') handleRenameSubmit()
    else if (e.key === 'Escape') onRenameCancel()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [contextMenu])

  return (
    <div
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={mergeClasses(s.root, isHighlighted && s.highlighted, barAnimClass)}
      style={{
        background: bgStyle,
        borderLeft,
        transition: 'background 400ms ease, border-color 400ms ease',
        boxShadow: shadow
      }}
    >
      {ui.dotVisible && (
        <span
          className={mergeClasses(s.dot, ui.dotAnimation === 'pulse-slow' ? 'animate-pulse-slow' : ui.dotAnimation === 'pulse-fast' ? 'animate-pulse-fast' : '')}
          style={{ background: ui.dotColor ? `var(${ui.dotColor})` : undefined }}
        />
      )}

      <div className={s.info}>
        <div className={s.nameRow}>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleRenameSubmit}
              onClick={(e) => e.stopPropagation()}
              className={s.renameInput}
              aria-label="Rename session"
            />
          ) : (
            <>
              <span className={s.name}>{session.name}</span>
              <span className={s.badge}>
                {session.agentType === 'copilot-cli' ? 'copilot' : session.agentType === 'claude-code' ? 'claude' : 'shell'}
              </span>
              {session.isExternal && <span className={s.extBadge}>ext</span>}
            </>
          )}
        </div>
        {!isRenaming && (
          <div className={s.activity}>
            {session.agentType !== 'shell' && (!session.lastActivity || session.lastActivity.includes('cmd.exe'))
              ? (session.status === 'processing' || session.status === 'tool_executing' ? 'Thinking...' : 'Waiting...')
              : session.lastActivity || 'idle'}
          </div>
        )}
      </div>

      {!session.isExternal && !isRenaming && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className={mergeClasses(s.closeBtn, hovered && s.closeBtnVisible)}
        >
          ×
        </button>
      )}

      {contextMenu && (
        <div
          className={s.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {onCreateAgent && (
            <button
              onClick={() => { setContextMenu(null); onCreateAgent() }}
              className={s.contextMenuItem}
            >
              Save as Agent...
            </button>
          )}
          <button
            onClick={() => { setContextMenu(null); onClose() }}
            className={s.contextMenuItem}
          >
            Close Session
          </button>
        </div>
      )}
    </div>
  )
}
