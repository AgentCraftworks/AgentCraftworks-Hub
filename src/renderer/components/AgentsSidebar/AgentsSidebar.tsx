import { useState, useCallback, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAgents } from '@/hooks/useAgents'
import { AgentItem } from './AgentItem'
import { AgentForm } from './AgentForm'
import type { AgentProfile, ProjectFolder } from '@shared/types'

interface AgentsSidebarProps {
  activeSessionId: string | null
  prefillAgent?: AgentProfile | null
  onPrefillConsumed?: () => void
}

// --- Shared inline styles ---
const overlayPanel = (width: string): React.CSSProperties => ({
  position: 'absolute', right: '44px', top: 0, bottom: 0, width,
  display: 'flex', flexDirection: 'column',
  borderLeft: '1px solid var(--bg-hover)', zIndex: 20,
  background: 'var(--bg-secondary)', boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.35)',
})

const sectionHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px', borderBottom: '1px solid var(--bg-hover)',
}

const smallBtn: React.CSSProperties = {
  fontSize: '12px', paddingLeft: '4px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px',
  borderRadius: '4px', background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', transition: 'background 150ms',
}

const outlineBtn: React.CSSProperties = {
  paddingLeft: '8px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px',
  fontSize: '13px', borderRadius: '4px', cursor: 'pointer',
  color: 'var(--text-secondary)', background: 'transparent',
  border: '1px solid var(--bg-hover)', transition: 'background 150ms',
}

export function AgentsSidebar({ activeSessionId, prefillAgent, onPrefillConsumed }: AgentsSidebarProps) {
  const { groups, saveGroups, launchAgent } = useAgents()
  const [openGroupIndex, setOpenGroupIndex] = useState<number | null>(null)
  const [editingAgent, setEditingAgent] = useState<AgentProfile | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingPrefill, setPendingPrefill] = useState<AgentProfile | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const groupPickerRef = useRef<HTMLDivElement>(null)

  const openGroup: ProjectFolder | undefined = openGroupIndex !== null ? groups[openGroupIndex] : undefined

  // Keyboard: Ctrl+1-9 toggle project tabs
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.shiftKey || e.altKey) return
      const digit = e.key.match(/^[1-9]$/)
      if (!digit) return
      const idx = parseInt(digit[0], 10) - 1
      if (idx >= groups.length) return
      e.preventDefault()
      setOpenGroupIndex(prev => prev === idx ? null : idx)
      setShowForm(false); setEditingAgent(null)
    }
    window.addEventListener('keydown', handleKey, { capture: true })
    return () => window.removeEventListener('keydown', handleKey, { capture: true })
  }, [groups.length])

  // 1-9 (no modifier): launch Nth agent in open group
  useEffect(() => {
    if (openGroupIndex === null || !openGroup) return
    const handleAgentKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const digit = e.key.match(/^[1-9]$/)
      if (!digit) return
      const idx = parseInt(digit[0], 10) - 1
      if (idx >= openGroup.agents.length) return
      e.preventDefault()
      if (activeSessionId) { launchAgent(openGroup.agents[idx].id, activeSessionId); setOpenGroupIndex(null) }
    }
    window.addEventListener('keydown', handleAgentKey, { capture: true })
    return () => window.removeEventListener('keydown', handleAgentKey, { capture: true })
  }, [openGroupIndex, openGroup, activeSessionId, launchAgent])

  // Close popup on outside click
  useEffect(() => {
    if (openGroupIndex === null) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (popupRef.current?.contains(target)) return
      if (tabsRef.current?.contains(target)) return
      setOpenGroupIndex(null); setShowForm(false); setEditingAgent(null)
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [openGroupIndex])

  // Handle prefill
  useEffect(() => {
    if (!prefillAgent) return
    setPendingPrefill(prefillAgent); onPrefillConsumed?.()
  }, [prefillAgent])

  const handlePickGroup = useCallback((groupIndex: number) => {
    if (!pendingPrefill) return
    setOpenGroupIndex(groupIndex); setEditingAgent(pendingPrefill); setShowForm(true); setPendingPrefill(null)
  }, [pendingPrefill])

  const handlePickNewGroup = useCallback(() => {
    if (!pendingPrefill) return
    const newGroup: ProjectFolder = { id: uuidv4(), name: 'New Project', agents: [] }
    const updated = [...groups, newGroup]
    saveGroups(updated); setOpenGroupIndex(updated.length - 1); setEditingAgent(pendingPrefill); setShowForm(true); setPendingPrefill(null)
  }, [pendingPrefill, groups, saveGroups])

  const handleTabClick = useCallback((index: number) => {
    setOpenGroupIndex(prev => prev === index ? null : index); setShowForm(false); setEditingAgent(null)
  }, [])

  // Drag-and-drop reorder
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)) }, [])
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const rect = e.currentTarget.getBoundingClientRect(); setDropIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex || dragIndex + 1 === dropIndex) { setDragIndex(null); setDropIndex(null); return }
    const updated = [...groups]; const [moved] = updated.splice(dragIndex, 1); const insertAt = dropIndex > dragIndex ? dropIndex - 1 : dropIndex; updated.splice(insertAt, 0, moved); saveGroups(updated)
    if (openGroupIndex !== null) {
      if (openGroupIndex === dragIndex) setOpenGroupIndex(insertAt)
      else { const min = Math.min(dragIndex, insertAt); const max = Math.max(dragIndex, insertAt); if (openGroupIndex >= min && openGroupIndex <= max) setOpenGroupIndex(openGroupIndex + (dragIndex > insertAt ? 1 : -1)) }
    }
    setDragIndex(null); setDropIndex(null)
  }, [dragIndex, dropIndex, groups, saveGroups, openGroupIndex])
  const handleDragEnd = useCallback(() => { setDragIndex(null); setDropIndex(null) }, [])

  // Project operations
  const addGroup = useCallback(() => { const g: ProjectFolder = { id: uuidv4(), name: `Project ${groups.length + 1}`, agents: [] }; const u = [...groups, g]; saveGroups(u); setOpenGroupIndex(u.length - 1) }, [groups, saveGroups])
  const deleteGroup = useCallback((gid: string) => { saveGroups(groups.filter(g => g.id !== gid)); setOpenGroupIndex(null) }, [groups, saveGroups])
  const handleSetGroupIcon = useCallback(async (gid: string) => { const s = await (window as any).tangentAPI.dialog.openFile([{ name: 'Icons', extensions: ['ico', 'png'] }]); if (s) saveGroups(groups.map(g => g.id === gid ? { ...g, iconPath: s } : g)) }, [groups, saveGroups])
  const handleClearGroupIcon = useCallback((gid: string) => { saveGroups(groups.map(g => g.id === gid ? { ...g, iconPath: undefined } : g)) }, [groups, saveGroups])
  const startRenameGroup = useCallback((g: ProjectFolder) => { setRenamingGroupId(g.id); setRenameValue(g.name) }, [])
  const commitRenameGroup = useCallback(() => { if (!renamingGroupId) return; const t = renameValue.trim(); if (!t) { setRenamingGroupId(null); return }; saveGroups(groups.map(g => g.id === renamingGroupId ? { ...g, name: t } : g)); setRenamingGroupId(null) }, [renamingGroupId, renameValue, groups, saveGroups])

  // Agent operations
  const handleLaunch = useCallback((agentId: string) => { if (!activeSessionId) return; launchAgent(agentId, activeSessionId); setOpenGroupIndex(null) }, [activeSessionId, launchAgent])
  const handleSaveAgent = useCallback((agent: AgentProfile) => {
    if (!openGroup || openGroupIndex === null) return
    const existingIndex = openGroup.agents.findIndex(a => a.id === agent.id)
    const updatedAgents = existingIndex >= 0 ? openGroup.agents.map(a => a.id === agent.id ? agent : a) : [...openGroup.agents, agent]
    saveGroups(groups.map((g, i) => i === openGroupIndex ? { ...g, agents: updatedAgents } : g)); setShowForm(false); setEditingAgent(null)
  }, [openGroup, openGroupIndex, groups, saveGroups])
  const handleDeleteAgent = useCallback((agentId: string) => { if (!openGroup || openGroupIndex === null) return; saveGroups(groups.map((g, i) => i === openGroupIndex ? { ...g, agents: g.agents.filter(a => a.id !== agentId) } : g)) }, [openGroup, openGroupIndex, groups, saveGroups])
  const handleMoveAgent = useCallback((agentId: string, direction: 'up' | 'down') => {
    if (!openGroup || openGroupIndex === null) return; const idx = openGroup.agents.findIndex(a => a.id === agentId); if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1; if (swapIdx < 0 || swapIdx >= openGroup.agents.length) return
    const ua = [...openGroup.agents]; const temp = ua[idx]; ua[idx] = ua[swapIdx]; ua[swapIdx] = temp
    saveGroups(groups.map((g, i) => i === openGroupIndex ? { ...g, agents: ua } : g))
  }, [openGroup, openGroupIndex, groups, saveGroups])
  const handleEditAgent = useCallback((agent: AgentProfile) => { setEditingAgent(agent); setShowForm(true) }, [])
  const handleCancelForm = useCallback(() => { setShowForm(false); setEditingAgent(null) }, [])

  return (
    <div style={{ position: 'relative', display: 'flex', height: '100%', flexShrink: 0 }}>
      {/* Project picker */}
      {pendingPrefill && (
        <div ref={groupPickerRef} style={overlayPanel('220px')}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--bg-hover)' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', color: 'var(--text-muted)' }}>Save to Project</div>
            <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{pendingPrefill.name}</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '4px', paddingRight: '4px', paddingTop: '4px', paddingBottom: '4px' }}>
            {groups.map((group, idx) => (
              <button type="button" key={group.id} onClick={() => handlePickGroup(idx)} style={{ ...outlineBtn, width: '100%', textAlign: 'left', marginBottom: '2px', border: 'none', color: 'var(--text-primary)' }}>
                {group.name} <span style={{ fontSize: '12px', marginLeft: '4px', color: 'var(--text-muted)' }}>({group.agents.length})</span>
              </button>
            ))}
          </div>
          <div style={{ padding: '8px', borderTop: '1px solid var(--bg-hover)', display: 'flex', gap: '8px' }}>
            <button type="button" onClick={handlePickNewGroup} style={{ ...outlineBtn, flex: 1 }}>+ New Project</button>
            <button type="button" onClick={() => setPendingPrefill(null)} style={{ ...outlineBtn, color: 'var(--text-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Popup panel */}
      {openGroupIndex !== null && openGroup && (
        <div ref={popupRef} style={overlayPanel('240px')}>
          <div style={sectionHeader}>
            {renamingGroupId === openGroup.id ? (
              <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRenameGroup(); if (e.key === 'Escape') setRenamingGroupId(null) }}
                onBlur={commitRenameGroup} autoFocus aria-label="Rename project"
                style={{ fontSize: '13px', paddingLeft: '8px', paddingRight: '8px', paddingTop: '2px', paddingBottom: '2px', borderRadius: '4px', outline: 'none', flex: 1, marginRight: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
              />
            ) : (
              <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{openGroup.name}</span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {openGroup.iconPath
                ? <button type="button" onClick={() => handleClearGroupIcon(openGroup.id)} style={smallBtn} title="Remove icon">&#128465;</button>
                : <button type="button" onClick={() => handleSetGroupIcon(openGroup.id)} style={smallBtn} title="Set icon">&#128247;</button>}
              <button type="button" onClick={() => startRenameGroup(openGroup)} style={smallBtn} title="Rename">&#9998;</button>
              {groups.length > 1 && <button type="button" onClick={() => deleteGroup(openGroup.id)} style={{ ...smallBtn, color: 'var(--error)' }} title="Delete">&times;</button>}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '4px', paddingRight: '4px', paddingTop: '4px', paddingBottom: '4px' }}>
            {openGroup.agents.length > 0 ? openGroup.agents.map((agent, idx) => (
              <AgentItem key={agent.id} agent={agent} index={idx} onLaunch={() => handleLaunch(agent.id)} onEdit={handleEditAgent} onDelete={handleDeleteAgent} onMoveUp={() => handleMoveAgent(agent.id, 'up')} onMoveDown={() => handleMoveAgent(agent.id, 'down')} />
            )) : <div style={{ fontSize: '12px', padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>No agents in this project</div>}
          </div>
          {showForm ? <AgentForm initialValues={editingAgent ?? undefined} onSave={handleSaveAgent} onCancel={handleCancelForm} /> : (
            <div style={{ padding: '8px', borderTop: '1px solid var(--bg-hover)' }}>
              <button type="button" onClick={() => { setEditingAgent(null); setShowForm(true) }} style={{ ...outlineBtn, width: '100%' }}>+ Add Agent</button>
            </div>
          )}
        </div>
      )}

      {/* Vertical tab strip */}
      <div ref={tabsRef} style={{ width: '44px', minWidth: '44px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '8px', paddingBottom: '8px', gap: '2px', flexShrink: 0, borderLeft: '1px solid var(--bg-hover)', background: 'var(--bg-secondary)' }}>
        {groups.map((group, idx) => (
          <div key={group.id} style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {dropIndex === idx && dragIndex !== null && dragIndex !== idx && dragIndex + 1 !== idx && (
              <div style={{ position: 'absolute', top: 0, left: '4px', right: '4px', height: '2px', borderRadius: '999px', zIndex: 10, background: 'var(--accent)' }} />
            )}
            <AgentTab name={group.name} iconPath={group.iconPath} isOpen={openGroupIndex === idx} isDragging={dragIndex === idx} title={idx < 9 ? `Ctrl+${idx + 1}` : undefined} onClick={() => handleTabClick(idx)} draggable onDragStart={(e) => handleDragStart(e, idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={handleDrop} onDragEnd={handleDragEnd} />
            {dropIndex === idx + 1 && dragIndex !== null && dragIndex !== idx && dragIndex !== idx + 1 && idx === groups.length - 1 && (
              <div style={{ position: 'absolute', bottom: 0, left: '4px', right: '4px', height: '2px', borderRadius: '999px', zIndex: 10, background: 'var(--accent)' }} />
            )}
          </div>
        ))}
        <button type="button" onClick={addGroup} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', color: 'var(--text-muted)', opacity: 0.7, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', transition: 'opacity 150ms' }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }} title="Add project" aria-label="Add project">+</button>
      </div>
    </div>
  )
}

// --- Helpers ---
const EMOJI_RE = /^([\p{Emoji_Presentation}\p{Extended_Pictographic}][\u{FE00}-\u{FE0F}\u{200D}\p{Emoji_Presentation}\p{Extended_Pictographic}]*)\s*/u

function parseGroupName(name: string): { emoji: string | null; text: string } {
  const m = name.match(EMOJI_RE)
  return m ? { emoji: m[1], text: name.slice(m[0].length) } : { emoji: null, text: name }
}

// --- Vertical Tab Component ---
function AgentTab({ name, title, iconPath, isOpen, isDragging, onClick, draggable, onDragStart, onDragOver, onDrop, onDragEnd }: {
  name: string; title?: string; iconPath?: string; isOpen: boolean; isDragging?: boolean; onClick: () => void
  draggable?: boolean; onDragStart?: (e: React.DragEvent) => void; onDragOver?: (e: React.DragEvent) => void; onDrop?: (e: React.DragEvent) => void; onDragEnd?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const { emoji, text } = parseGroupName(name)
  const initial = text.charAt(0).toUpperCase()
  const active = isOpen || hovered

  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      style={{ width: '36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', paddingTop: '8px', paddingBottom: '8px', borderRadius: '4px', border: 'none', cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.4 : 1, background: isOpen ? 'var(--bg-hover)' : hovered ? 'rgba(255,255,255,0.06)' : 'transparent', borderLeft: isOpen ? '2px solid var(--accent)' : hovered ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent', transition: 'background 150ms ease, border-color 150ms ease' }}
      title={title ?? name}
    >
      {iconPath ? (
        <div style={{ width: '28px', height: '28px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', background: isOpen ? 'var(--accent)' : active ? 'var(--bg-tertiary)' : 'transparent', transition: 'background 150ms ease' }}>
          <img src={`tangent-file:///${iconPath.replace(/\\/g, '/')}`} alt={name} style={{ width: '20px', height: '20px', objectFit: 'contain' }} draggable={false} />
        </div>
      ) : (
        <div style={{ width: '28px', height: '28px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: emoji ? '16px' : '12px', fontWeight: emoji ? 'normal' : 'bold', background: isOpen ? 'var(--accent)' : active ? 'var(--bg-tertiary)' : 'transparent', color: isOpen ? '#fff' : active ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'background 150ms ease, color 150ms ease' }}>
          {emoji ?? initial}
        </div>
      )}
      <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.2, fontWeight: 500, writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: active ? 'var(--text-primary)' : 'var(--text-muted)', maxHeight: '65px', overflow: 'hidden', transition: 'color 150ms ease' }}>
        {text}
      </span>
    </button>
  )
}
