import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useAgents } from '@/hooks/useAgents'
import { AgentItem } from './AgentItem'
import { AgentForm } from './AgentForm'
import type { AgentProfile, AgentGroup } from '@shared/types'

interface AgentsSidebarProps {
  activeSessionId: string | null
  collapsed: boolean
  onToggle: () => void
}

export function AgentsSidebar({ activeSessionId, collapsed, onToggle }: AgentsSidebarProps) {
  const { groups, saveGroups, launchAgent } = useAgents()
  const [activeGroupIndex, setActiveGroupIndex] = useState(0)
  const [editingAgent, setEditingAgent] = useState<AgentProfile | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const activeGroup: AgentGroup | undefined = groups[activeGroupIndex]

  // --- Group operations ---

  const addGroup = useCallback(() => {
    const newGroup: AgentGroup = {
      id: uuidv4(),
      name: `Group ${groups.length + 1}`,
      agents: []
    }
    const updated = [...groups, newGroup]
    saveGroups(updated)
    setActiveGroupIndex(updated.length - 1)
  }, [groups, saveGroups])

  const deleteGroup = useCallback((groupId: string) => {
    const updated = groups.filter(g => g.id !== groupId)
    saveGroups(updated)
    setActiveGroupIndex(prev => {
      if (prev >= updated.length) return Math.max(0, updated.length - 1)
      return prev
    })
  }, [groups, saveGroups])

  const startRenameGroup = useCallback((group: AgentGroup) => {
    setRenamingGroupId(group.id)
    setRenameValue(group.name)
  }, [])

  const commitRenameGroup = useCallback(() => {
    if (!renamingGroupId) return
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenamingGroupId(null)
      return
    }
    const updated = groups.map(g =>
      g.id === renamingGroupId ? { ...g, name: trimmed } : g
    )
    saveGroups(updated)
    setRenamingGroupId(null)
  }, [renamingGroupId, renameValue, groups, saveGroups])

  // --- Agent operations ---

  const handleLaunch = useCallback((agentId: string) => {
    if (!activeSessionId) return
    launchAgent(agentId, activeSessionId)
  }, [activeSessionId, launchAgent])

  const handleSaveAgent = useCallback((agent: AgentProfile) => {
    if (!activeGroup) return

    const existingIndex = activeGroup.agents.findIndex(a => a.id === agent.id)
    let updatedAgents: AgentProfile[]
    if (existingIndex >= 0) {
      updatedAgents = activeGroup.agents.map(a => a.id === agent.id ? agent : a)
    } else {
      updatedAgents = [...activeGroup.agents, agent]
    }

    const updated = groups.map((g, i) =>
      i === activeGroupIndex ? { ...g, agents: updatedAgents } : g
    )
    saveGroups(updated)
    setShowForm(false)
    setEditingAgent(null)
  }, [activeGroup, activeGroupIndex, groups, saveGroups])

  const handleDeleteAgent = useCallback((agentId: string) => {
    if (!activeGroup) return
    const updatedAgents = activeGroup.agents.filter(a => a.id !== agentId)
    const updated = groups.map((g, i) =>
      i === activeGroupIndex ? { ...g, agents: updatedAgents } : g
    )
    saveGroups(updated)
  }, [activeGroup, activeGroupIndex, groups, saveGroups])

  const handleMoveAgent = useCallback((agentId: string, direction: 'up' | 'down') => {
    if (!activeGroup) return
    const idx = activeGroup.agents.findIndex(a => a.id === agentId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= activeGroup.agents.length) return

    const updatedAgents = [...activeGroup.agents]
    const temp = updatedAgents[idx]
    updatedAgents[idx] = updatedAgents[swapIdx]
    updatedAgents[swapIdx] = temp

    const updated = groups.map((g, i) =>
      i === activeGroupIndex ? { ...g, agents: updatedAgents } : g
    )
    saveGroups(updated)
  }, [activeGroup, activeGroupIndex, groups, saveGroups])

  const handleEditAgent = useCallback((agent: AgentProfile) => {
    setEditingAgent(agent)
    setShowForm(true)
  }, [])

  const handleCancelForm = useCallback(() => {
    setShowForm(false)
    setEditingAgent(null)
  }, [])

  // --- Collapsed state ---

  if (collapsed) {
    return (
      <div
        className="w-6 min-w-6 h-full border-l border-[var(--bg-hover)] flex items-center justify-center cursor-pointer"
        style={{ background: 'var(--bg-secondary)' }}
        onClick={onToggle}
        title="Expand Agents sidebar"
      >
        <span
          className="text-xs uppercase tracking-widest"
          style={{
            color: 'var(--text-muted)',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)'
          }}
        >
          Agents
        </span>
      </div>
    )
  }

  // --- Expanded state ---

  return (
    <div
      className="w-[220px] min-w-[220px] h-full border-l border-[var(--bg-hover)] flex flex-col"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between p-3">
        <span
          className="text-xs uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Agents
        </span>
        <button
          onClick={onToggle}
          className="text-xs px-1 py-0.5 rounded hover:bg-[var(--bg-hover)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Collapse sidebar"
        >
          &#9654;
        </button>
      </div>

      {/* Group tabs */}
      <div className="flex items-center gap-0.5 px-2 pb-1 overflow-x-auto">
        {groups.map((group, idx) => (
          <div key={group.id} className="flex items-center shrink-0">
            {renamingGroupId === group.id ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRenameGroup()
                  if (e.key === 'Escape') setRenamingGroupId(null)
                }}
                onBlur={commitRenameGroup}
                autoFocus
                className="text-xs px-2 py-1 rounded border border-[var(--accent)] outline-none w-20"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)'
                }}
              />
            ) : (
              <button
                onClick={() => setActiveGroupIndex(idx)}
                onDoubleClick={() => startRenameGroup(group)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (groups.length > 1) deleteGroup(group.id)
                }}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{
                  background: idx === activeGroupIndex ? 'var(--bg-hover)' : 'transparent',
                  color: idx === activeGroupIndex ? 'var(--text-primary)' : 'var(--text-muted)'
                }}
                title="Click to select, double-click to rename, right-click to delete"
              >
                {group.name}
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addGroup}
          className="text-xs px-1.5 py-1 rounded hover:bg-[var(--bg-hover)] transition-colors shrink-0"
          style={{ color: 'var(--text-muted)' }}
          title="Add new group"
        >
          +
        </button>
      </div>

      {/* Agents list */}
      <div className="flex-1 overflow-y-auto px-1">
        {activeGroup && activeGroup.agents.length > 0 ? (
          activeGroup.agents.map((agent, idx) => (
            <AgentItem
              key={agent.id}
              agent={agent}
              index={idx}
              onLaunch={() => handleLaunch(agent.id)}
              onEdit={handleEditAgent}
              onDelete={handleDeleteAgent}
              onMoveUp={() => handleMoveAgent(agent.id, 'up')}
              onMoveDown={() => handleMoveAgent(agent.id, 'down')}
            />
          ))
        ) : (
          <div
            className="text-xs p-3 text-center"
            style={{ color: 'var(--text-muted)' }}
          >
            {groups.length === 0
              ? 'Click + to create a group'
              : 'No agents in this group'}
          </div>
        )}
      </div>

      {/* Form or Add button */}
      {showForm ? (
        <AgentForm
          initialValues={editingAgent ?? undefined}
          onSave={handleSaveAgent}
          onCancel={handleCancelForm}
        />
      ) : (
        <div className="p-2 border-t border-[var(--bg-hover)]">
          <button
            onClick={() => { setEditingAgent(null); setShowForm(true) }}
            className="w-full px-2 py-1.5 text-sm rounded border border-[var(--bg-hover)] hover:bg-[var(--bg-hover)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            disabled={groups.length === 0}
          >
            + Add Agent
          </button>
        </div>
      )}
    </div>
  )
}
