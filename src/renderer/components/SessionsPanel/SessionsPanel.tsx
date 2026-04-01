import { useState, useCallback, useMemo, useRef } from 'react'
import { makeStyles } from '@fluentui/react-components'
import type { Session } from '@shared/types'
import { SessionItem } from './SessionItem'
import { SessionFilter } from './SessionFilter'

interface SessionsPanelProps {
  sessions: Session[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onCreate: () => void
  onRename: (id: string, name: string) => void
  onCreateAgent?: (session: Session) => void
  width: number
  onWidthChange: (w: number) => void
  onCollapse: () => void
}

const MIN_WIDTH = 140
const MAX_WIDTH = 500
const RECENT_THRESHOLD_MS = 48 * 60 * 60 * 1000

const useStyles = makeStyles({
  outer: {
    display: 'flex',
    height: '100%',
    flexShrink: 0,
  },
  panel: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    outlineStyle: 'none',
    backgroundColor: 'var(--bg-secondary)',
  },
  header: {
    padding: '12px',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    paddingLeft: '8px',
    paddingRight: '8px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    width: '100%',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '6px',
    paddingBottom: '6px',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: '4px',
    color: 'var(--text-muted)',
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--bg-hover)',
    },
  },
  sectionCount: {
    marginLeft: 'auto',
  },
  showOlderBtn: {
    width: '100%',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '6px',
    paddingBottom: '6px',
    fontSize: '12px',
    borderRadius: '4px',
    textAlign: 'left' as const,
    color: 'var(--text-muted)',
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--bg-hover)',
    },
  },
  newSessionBtn: {
    margin: '8px',
    padding: '8px',
    fontSize: '13px',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
    ':hover': {
      backgroundColor: 'var(--bg-hover)',
    },
  },
  dragHandle: {
    width: '4px',
    height: '100%',
    flexShrink: 0,
    cursor: 'col-resize',
    transitionProperty: 'background',
    transitionDuration: '0.15s',
    ':hover': {
      backgroundColor: 'var(--accent)',
    },
  },
})

export function SessionsPanel({ sessions, activeId, onSelect, onClose, onCreate, onRename, onCreateAgent, width, onWidthChange, onCollapse }: SessionsPanelProps) {
  const s = useStyles()
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterValue, setFilterValue] = useState('')
  const [activeCollapsed, setActiveCollapsed] = useState(false)
  const [recentCollapsed, setRecentCollapsed] = useState(false)
  const [showOlder, setShowOlder] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, startWidth: 0 })

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, startWidth: width }
    const handleMove = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartRef.current.x
      const newWidth = dragStartRef.current.startWidth + delta
      if (newWidth < MIN_WIDTH / 2) { onCollapse(); cleanup(); return }
      onWidthChange(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)))
    }
    const handleUp = () => cleanup()
    const cleanup = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [width, onWidthChange, onCollapse])

  const filteredSessions = useMemo(() => {
    if (!filterValue.trim()) return sessions
    const query = filterValue.toLowerCase()
    return sessions.filter(s => s.name.toLowerCase().includes(query) || s.folderName.toLowerCase().includes(query))
  }, [sessions, filterValue])

  const now = Date.now()
  const activeSessions = useMemo(() => filteredSessions.filter(s => s.status !== 'exited'), [filteredSessions])
  const recentSessions = useMemo(() => filteredSessions.filter(s => s.status === 'exited' && (now - s.updatedAt) <= RECENT_THRESHOLD_MS), [filteredSessions, now])
  const olderSessions = useMemo(() => filteredSessions.filter(s => s.status === 'exited' && (now - s.updatedAt) > RECENT_THRESHOLD_MS), [filteredSessions, now])

  const visibleSessions = useMemo(() => {
    const list: Session[] = []
    if (!activeCollapsed) list.push(...activeSessions)
    if (!recentCollapsed) list.push(...recentSessions)
    if (showOlder) list.push(...olderSessions)
    return list
  }, [activeSessions, recentSessions, olderSessions, activeCollapsed, recentCollapsed, showOlder])

  const handleRename = useCallback((id: string, name: string) => { onRename(id, name); setRenamingId(null) }, [onRename])
  const handleRenameCancel = useCallback(() => { setRenamingId(null) }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT') return
    switch (e.key) {
      case 'j': case 'ArrowDown': e.preventDefault(); setHighlightedIndex(prev => Math.min(prev + 1, visibleSessions.length - 1)); break
      case 'k': case 'ArrowUp': e.preventDefault(); setHighlightedIndex(prev => Math.max(prev - 1, 0)); break
      case 'Enter': e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < visibleSessions.length) onSelect(visibleSessions[highlightedIndex].id); break
      case 'x': case 'Delete': e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < visibleSessions.length && !visibleSessions[highlightedIndex].isExternal) onClose(visibleSessions[highlightedIndex].id); break
      case 'F2': e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < visibleSessions.length) setRenamingId(visibleSessions[highlightedIndex].id); break
      case '/': e.preventDefault(); setFilterOpen(true); break
      case 'Escape': e.preventDefault(); if (filterOpen) { setFilterOpen(false); setFilterValue('') } else { panelRef.current?.blur() }; break
    }
  }, [visibleSessions, highlightedIndex, filterOpen, onSelect, onClose])

  const renderSection = (title: string, items: Session[], collapsed: boolean, onToggle: () => void) => (
    <div style={{ marginBottom: '4px' }}>
      <button type="button" onClick={onToggle} className={s.sectionHeader}>
        <span style={{ fontSize: '10px' }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
        <span>{title}</span>
        <span className={s.sectionCount}>{items.length}</span>
      </button>
      {!collapsed && items.map(session => {
        const flatIndex = visibleSessions.indexOf(session)
        return (
          <SessionItem
            key={session.id}
            session={session}
            isActive={session.id === activeId}
            isHighlighted={flatIndex === highlightedIndex}
            isRenaming={session.id === renamingId}
            onSelect={() => onSelect(session.id)}
            onClose={() => onClose(session.id)}
            onRename={(name) => handleRename(session.id, name)}
            onRenameCancel={handleRenameCancel}
            onCreateAgent={onCreateAgent ? () => onCreateAgent(session) : undefined}
          />
        )
      })}
    </div>
  )

  return (
    <div className={s.outer} style={{ width: `${width}px` }}>
      <div ref={panelRef} tabIndex={0} onKeyDown={handleKeyDown} className={s.panel}>
        <div className={s.header}>Sessions</div>
        {filterOpen && (
          <SessionFilter value={filterValue} onChange={setFilterValue} onClose={() => { setFilterOpen(false); setFilterValue('') }} />
        )}
        <div className={s.list}>
          {renderSection('Active', activeSessions, activeCollapsed, () => setActiveCollapsed(prev => !prev))}
          {recentSessions.length > 0 && renderSection('Recent', recentSessions, recentCollapsed, () => setRecentCollapsed(prev => !prev))}
          {olderSessions.length > 0 && !showOlder && (
            <button type="button" onClick={() => setShowOlder(true)} className={s.showOlderBtn}>
              Show {olderSessions.length} older session{olderSessions.length !== 1 ? 's' : ''}
            </button>
          )}
          {showOlder && olderSessions.length > 0 && renderSection('Older', olderSessions, false, () => setShowOlder(false))}
        </div>
        <button type="button" onClick={onCreate} className={s.newSessionBtn}>+ New Session</button>
      </div>
      <div
        onMouseDown={handleDragStart}
        className={`${s.dragHandle} ${isDragging ? s.dragHandleDragging : ''}`}
      />
    </div>
  )
}
