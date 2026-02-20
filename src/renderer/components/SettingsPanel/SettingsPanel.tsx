import { useState, useEffect, useRef, useCallback } from 'react'
import { ZOOM } from '@shared/constants'
import type { ProjectFolder, AgentProfile } from '@shared/types'

declare global {
  interface Window {
    tangentAPI: any
  }
}

type SettingsTab = 'general' | 'projects' | 'agents'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'projects', label: 'Projects' },
  { id: 'agents', label: 'Agents' }
]

interface SettingsPanelProps {
  onClose: () => void
  fontSize: number
  setFontSize: (fn: (prev: number) => number) => void
}

export function SettingsPanel({ onClose, fontSize, setFontSize }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const panelRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState('code')
  const [startFolder, setStartFolder] = useState('')
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null)
  const [agentForm, setAgentForm] = useState({ name: '', command: '', args: '', launchTarget: 'currentTab' as AgentProfile['launchTarget'], cwdPath: '' })

  useEffect(() => {
    window.tangentAPI.config.get().then((config: any) => {
      if (config.editor) setEditor(config.editor)
      if (config.startFolder) setStartFolder(config.startFolder)
    })
    window.tangentAPI.agents.getGroups().then(setFolders)
    const unsub = window.tangentAPI.config.onChanged((config: any) => {
      if (config.editor) setEditor(config.editor)
      if (config.startFolder) setStartFolder(config.startFolder)
    })
    return () => unsub()
  }, [])

  const handleEditorChange = useCallback((value: string) => {
    setEditor(value)
    window.tangentAPI.config.update('editor', value)
  }, [])

  const handleStartFolderChange = useCallback((value: string) => {
    setStartFolder(value)
    window.tangentAPI.config.update('startFolder', value)
  }, [])

  const handleBrowseFolder = useCallback(async () => {
    const folder = await window.tangentAPI.dialog.openFolder()
    if (folder) handleStartFolderChange(folder)
  }, [handleStartFolderChange])

  const handleFontSizeChange = useCallback((value: number) => {
    const clamped = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, value))
    setFontSize(() => clamped)
    window.tangentAPI.config.update('fontSize', clamped)
  }, [setFontSize])

  const handleOpenConfig = useCallback(() => {
    window.tangentAPI.config.openFile()
  }, [])

  const saveFolders = useCallback(async (updated: ProjectFolder[]) => {
    setFolders(updated)
    await window.tangentAPI.agents.saveGroups(updated)
  }, [])

  const handleAddFolder = useCallback(() => {
    const newFolder: ProjectFolder = {
      id: crypto.randomUUID(),
      name: 'New Project',
      agents: []
    }
    const updated = [...folders, newFolder]
    saveFolders(updated)
    setEditingId(newFolder.id)
    setEditingName(newFolder.name)
  }, [folders, saveFolders])

  const handleRename = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) {
      setEditingId(null)
      return
    }
    const updated = folders.map(f => f.id === id ? { ...f, name: trimmed } : f)
    saveFolders(updated)
    setEditingId(null)
  }, [folders, saveFolders])

  const handleDelete = useCallback((id: string) => {
    const updated = folders.filter(f => f.id !== id)
    saveFolders(updated)
    setDeletingId(null)
  }, [folders, saveFolders])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectedFolder = folders.find(f => f.id === selectedFolderId) ?? null

  const handleAddAgent = useCallback(() => {
    if (!selectedFolderId) return
    const newAgent: AgentProfile = {
      id: crypto.randomUUID(),
      name: 'New Agent',
      command: '',
      args: [],
      cwdMode: 'activeSession',
      launchTarget: 'currentTab'
    }
    const updated = folders.map(f =>
      f.id === selectedFolderId ? { ...f, agents: [...f.agents, newAgent] } : f
    )
    saveFolders(updated)
    setEditingAgentId(newAgent.id)
    setAgentForm({ name: newAgent.name, command: '', args: '', launchTarget: 'currentTab', cwdPath: '' })
  }, [selectedFolderId, folders, saveFolders])

  const handleEditAgent = useCallback((agent: AgentProfile) => {
    setEditingAgentId(agent.id)
    setAgentForm({
      name: agent.name,
      command: agent.command,
      args: agent.args.join(' '),
      launchTarget: agent.launchTarget ?? 'currentTab',
      cwdPath: agent.cwdPath ?? ''
    })
  }, [])

  const handleSaveAgent = useCallback(() => {
    if (!selectedFolderId || !editingAgentId) return
    const updated = folders.map(f => {
      if (f.id !== selectedFolderId) return f
      return {
        ...f,
        agents: f.agents.map(a => {
          if (a.id !== editingAgentId) return a
          return {
            ...a,
            name: agentForm.name.trim() || 'Untitled',
            command: agentForm.command,
            args: agentForm.args.trim() ? agentForm.args.trim().split(/\s+/) : [],
            launchTarget: agentForm.launchTarget,
            cwdPath: agentForm.launchTarget === 'path' ? agentForm.cwdPath : undefined
          }
        })
      }
    })
    saveFolders(updated)
    setEditingAgentId(null)
  }, [selectedFolderId, editingAgentId, agentForm, folders, saveFolders])

  const handleDeleteAgent = useCallback((agentId: string) => {
    if (!selectedFolderId) return
    const updated = folders.map(f =>
      f.id === selectedFolderId ? { ...f, agents: f.agents.filter(a => a.id !== agentId) } : f
    )
    saveFolders(updated)
    setDeletingAgentId(null)
    if (editingAgentId === agentId) setEditingAgentId(null)
  }, [selectedFolderId, folders, saveFolders, editingAgentId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-50 flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ background: 'rgba(0, 0, 0, 0.4)' }}
    >
      <div
        ref={panelRef}
        className="h-full w-[420px] max-w-full flex flex-col border-l border-[var(--bg-hover)]"
        style={{ background: 'var(--bg-primary)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[var(--bg-hover)]"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Settings
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded cursor-pointer"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            title="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--bg-hover)]" style={{ background: 'var(--bg-secondary)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 px-3 py-2 text-xs cursor-pointer"
              style={{
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 150ms ease, border-color 150ms ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'general' && (
            <div className="space-y-5">
              {/* Editor Command */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Editor Command
                </label>
                <input
                  type="text"
                  value={editor}
                  onChange={(e) => handleEditorChange(e.target.value)}
                  placeholder="code"
                  className="w-full text-sm px-2.5 py-1.5 rounded"
                  style={{
                    color: 'var(--text-primary)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-hover)',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')}
                />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Command used to open files and folders (e.g. code, cursor, vim)
                </p>
              </div>

              {/* Start Folder */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Start Folder
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={startFolder}
                    onChange={(e) => handleStartFolderChange(e.target.value)}
                    placeholder="Default: home directory"
                    className="flex-1 text-sm px-2.5 py-1.5 rounded"
                    style={{
                      color: 'var(--text-primary)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--bg-hover)',
                      outline: 'none'
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')}
                  />
                  <button
                    onClick={handleBrowseFolder}
                    className="px-3 py-1.5 text-xs rounded shrink-0 cursor-pointer"
                    style={{
                      color: 'var(--text-primary)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--bg-hover)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  >
                    Browse
                  </button>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Default working directory for new terminal sessions
                </p>
              </div>

              {/* Font Size */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Font Size — {fontSize}px
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ZOOM.MIN}</span>
                  <input
                    type="range"
                    min={ZOOM.MIN}
                    max={ZOOM.MAX}
                    step={ZOOM.STEP}
                    value={fontSize}
                    onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                    className="flex-1"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ZOOM.MAX}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Terminal font size (also adjustable with Ctrl+/-)
                </p>
              </div>

              {/* Open Config File */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Configuration File
                </label>
                <button
                  onClick={handleOpenConfig}
                  className="px-3 py-1.5 text-xs rounded cursor-pointer"
                  style={{
                    color: 'var(--text-primary)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-hover)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                >
                  Open Config File
                </button>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Open ~/.tangent/config.json in your editor
                </p>
              </div>
            </div>
          )}
          {activeTab === 'projects' && (
            <div className="space-y-1">
              {folders.map((folder) => (
                <div key={folder.id}>
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded group"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpanded(folder.id)}
                      className="w-4 h-4 flex items-center justify-center shrink-0 cursor-pointer"
                      style={{ color: 'var(--text-muted)', background: 'none', border: 'none', fontSize: '10px' }}
                      title={expandedIds.has(folder.id) ? 'Collapse' : 'Expand'}
                    >
                      {expandedIds.has(folder.id) ? '▾' : '▸'}
                    </button>

                    {/* Name: inline editing or display */}
                    {editingId === folder.id ? (
                      <input
                        autoFocus
                        className="flex-1 text-sm px-1 py-0 rounded"
                        style={{
                          color: 'var(--text-primary)',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--accent)',
                          outline: 'none'
                        }}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(folder.id, editingName)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => handleRename(folder.id, editingName)}
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm cursor-pointer truncate"
                        style={{ color: 'var(--text-primary)' }}
                        onClick={() => { setEditingId(folder.id); setEditingName(folder.name) }}
                        title="Click to rename"
                      >
                        {folder.name}
                      </span>
                    )}

                    {/* Agent count */}
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {folder.agents.length} agent{folder.agents.length !== 1 ? 's' : ''}
                    </span>

                    {/* Delete */}
                    {deletingId === folder.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleDelete(folder.id)}
                          className="text-xs px-1.5 py-0.5 rounded cursor-pointer"
                          style={{ color: '#f85149', background: 'none', border: '1px solid #f85149' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-xs px-1.5 py-0.5 rounded cursor-pointer"
                          style={{ color: 'var(--text-muted)', background: 'none', border: '1px solid var(--bg-hover)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(folder.id)}
                        className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 cursor-pointer"
                        style={{ color: 'var(--text-muted)', background: 'none', border: 'none', transition: 'opacity 150ms' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Delete project"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Expanded agent list */}
                  {expandedIds.has(folder.id) && folder.agents.length > 0 && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {folder.agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="text-xs px-2 py-1 rounded truncate"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {agent.name}
                        </div>
                      ))}
                    </div>
                  )}
                  {expandedIds.has(folder.id) && folder.agents.length === 0 && (
                    <div className="ml-6 mt-0.5 text-xs px-2 py-1" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No agents
                    </div>
                  )}
                </div>
              ))}

              {/* Add Folder button */}
              <button
                onClick={handleAddFolder}
                className="w-full mt-2 px-3 py-1.5 text-xs rounded cursor-pointer"
                style={{
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: '1px dashed var(--bg-hover)',
                  transition: 'color 150ms, border-color 150ms'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--bg-hover)' }}
              >
                + Add Folder
              </button>
            </div>
          )}
          {activeTab === 'agents' && (
            <div className="space-y-4">
              {/* Folder selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Project Folder
                </label>
                <select
                  value={selectedFolderId ?? ''}
                  onChange={(e) => { setSelectedFolderId(e.target.value || null); setEditingAgentId(null); setDeletingAgentId(null) }}
                  className="w-full text-sm px-2.5 py-1.5 rounded"
                  style={{
                    color: 'var(--text-primary)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-hover)',
                    outline: 'none'
                  }}
                >
                  <option value="">Select a folder…</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Agent list */}
              {selectedFolder && (
                <div className="space-y-1">
                  {selectedFolder.agents.map((agent) => (
                    <div key={agent.id}>
                      {editingAgentId === agent.id ? (
                        /* Inline edit form */
                        <div
                          className="rounded p-3 space-y-2"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)' }}
                        >
                          <div className="space-y-1">
                            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>Name</label>
                            <input
                              autoFocus
                              type="text"
                              value={agentForm.name}
                              onChange={(e) => setAgentForm(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full text-sm px-2 py-1 rounded"
                              style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--bg-hover)', outline: 'none' }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>Command</label>
                            <input
                              type="text"
                              value={agentForm.command}
                              onChange={(e) => setAgentForm(prev => ({ ...prev, command: e.target.value }))}
                              placeholder="e.g. copilot-cli"
                              className="w-full text-sm px-2 py-1 rounded"
                              style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--bg-hover)', outline: 'none' }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>Arguments (space-separated)</label>
                            <input
                              type="text"
                              value={agentForm.args}
                              onChange={(e) => setAgentForm(prev => ({ ...prev, args: e.target.value }))}
                              placeholder="e.g. --verbose --no-color"
                              className="w-full text-sm px-2 py-1 rounded"
                              style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--bg-hover)', outline: 'none' }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>Launch Target</label>
                            <select
                              value={agentForm.launchTarget}
                              onChange={(e) => setAgentForm(prev => ({ ...prev, launchTarget: e.target.value as AgentProfile['launchTarget'] }))}
                              className="w-full text-sm px-2 py-1 rounded"
                              style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--bg-hover)', outline: 'none' }}
                            >
                              <option value="currentTab">Current Tab</option>
                              <option value="newTab">New Tab</option>
                              <option value="path">Path</option>
                            </select>
                          </div>
                          {agentForm.launchTarget === 'path' && (
                            <div className="space-y-1">
                              <label className="block text-xs" style={{ color: 'var(--text-muted)' }}>Folder Path</label>
                              <input
                                type="text"
                                value={agentForm.cwdPath}
                                onChange={(e) => setAgentForm(prev => ({ ...prev, cwdPath: e.target.value }))}
                                placeholder="/path/to/folder"
                                className="w-full text-sm px-2 py-1 rounded"
                                style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--bg-hover)', outline: 'none' }}
                                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')}
                              />
                            </div>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={handleSaveAgent}
                              className="px-3 py-1 text-xs rounded cursor-pointer"
                              style={{ color: 'var(--text-primary)', background: 'var(--accent)', border: 'none' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingAgentId(null)}
                              className="px-3 py-1 text-xs rounded cursor-pointer"
                              style={{ color: 'var(--text-muted)', background: 'none', border: '1px solid var(--bg-hover)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Agent row */
                        <div
                          className="flex items-center gap-2 px-2 py-1.5 rounded group"
                          style={{ background: 'var(--bg-secondary)' }}
                        >
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleEditAgent(agent)}>
                            <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                              {agent.name}
                            </div>
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {agent.command}{agent.args.length > 0 ? ` ${agent.args.join(' ')}` : ''}
                            </div>
                          </div>
                          {/* Edit button */}
                          <button
                            onClick={() => handleEditAgent(agent)}
                            className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 cursor-pointer"
                            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', transition: 'opacity 150ms', fontSize: '11px' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                            title="Edit agent"
                          >
                            ✎
                          </button>
                          {/* Delete button */}
                          {deletingAgentId === agent.id ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleDeleteAgent(agent.id)}
                                className="text-xs px-1.5 py-0.5 rounded cursor-pointer"
                                style={{ color: '#f85149', background: 'none', border: '1px solid #f85149' }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeletingAgentId(null)}
                                className="text-xs px-1.5 py-0.5 rounded cursor-pointer"
                                style={{ color: 'var(--text-muted)', background: 'none', border: '1px solid var(--bg-hover)' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingAgentId(agent.id)}
                              className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 cursor-pointer"
                              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', transition: 'opacity 150ms' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                              title="Delete agent"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {selectedFolder.agents.length === 0 && (
                    <p className="text-xs px-2 py-1" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No agents in this folder
                    </p>
                  )}

                  {/* Add Agent button */}
                  <button
                    onClick={handleAddAgent}
                    className="w-full mt-2 px-3 py-1.5 text-xs rounded cursor-pointer"
                    style={{
                      color: 'var(--text-muted)',
                      background: 'none',
                      border: '1px dashed var(--bg-hover)',
                      transition: 'color 150ms, border-color 150ms'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--bg-hover)' }}
                  >
                    + Add Agent
                  </button>
                </div>
              )}

              {!selectedFolderId && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Select a project folder to manage its agents
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
