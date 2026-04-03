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

// --- Shared styles ---
const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: '13px', paddingLeft: '10px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px',
  borderRadius: '4px', outline: 'none', color: 'var(--text-primary)', background: 'var(--bg-secondary)', border: '1px solid var(--bg-hover)',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }
const helpText: React.CSSProperties = { fontSize: '12px', color: 'var(--text-muted)' }
const outlineBtn: React.CSSProperties = {
  paddingLeft: '12px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px',
  fontSize: '12px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)',
  background: 'var(--bg-secondary)', border: '1px solid var(--bg-hover)',
}
const fieldGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px' }
const sectionGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' }
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', paddingRight: '8px',
  paddingTop: '6px', paddingBottom: '6px', borderRadius: '4px', background: 'var(--bg-secondary)',
}
const dangerBtn: React.CSSProperties = {
  fontSize: '12px', paddingLeft: '6px', paddingRight: '6px', paddingTop: '2px', paddingBottom: '2px',
  borderRadius: '4px', cursor: 'pointer', color: '#f85149', background: 'none', border: '1px solid #f85149',
}
const cancelBtn: React.CSSProperties = {
  fontSize: '12px', paddingLeft: '6px', paddingRight: '6px', paddingTop: '2px', paddingBottom: '2px',
  borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--bg-hover)',
}
const hoverDeleteBtn: React.CSSProperties = {
  width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)', background: 'none', border: 'none', transition: 'opacity 150ms',
}
const dashedAddBtn: React.CSSProperties = {
  width: '100%', marginTop: '8px', paddingLeft: '12px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px',
  fontSize: '12px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)', background: 'none',
  border: '1px dashed var(--bg-hover)', transition: 'color 150ms, border-color 150ms',
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
  const [agentForm, setAgentForm] = useState({ name: '', command: '', args: '', cwdPath: '' })
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null)

  useEffect(() => {
    setHoveredFolderId(null)
    setHoveredAgentId(null)

    return () => {
      setHoveredFolderId(null)
      setHoveredAgentId(null)
    }
  }, [activeTab, selectedFolderId])

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

  const handleEditorChange = useCallback((value: string) => { setEditor(value); window.tangentAPI.config.update('editor', value) }, [])
  const handleStartFolderChange = useCallback((value: string) => { setStartFolder(value); window.tangentAPI.config.update('startFolder', value) }, [])
  const handleBrowseFolder = useCallback(async () => { const folder = await window.tangentAPI.dialog.openFolder(); if (folder) handleStartFolderChange(folder) }, [handleStartFolderChange])
  const handleFontSizeChange = useCallback((value: number) => { const clamped = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, value)); setFontSize(() => clamped); window.tangentAPI.config.update('fontSize', clamped) }, [setFontSize])
  const handleOpenConfig = useCallback(() => { window.tangentAPI.config.openFile() }, [])

  const saveFolders = useCallback(async (updated: ProjectFolder[]) => { setFolders(updated); await window.tangentAPI.agents.saveGroups(updated) }, [])
  const handleAddFolder = useCallback(() => { const nf: ProjectFolder = { id: crypto.randomUUID(), name: 'New Project', agents: [] }; const u = [...folders, nf]; saveFolders(u); setEditingId(nf.id); setEditingName(nf.name) }, [folders, saveFolders])
  const handleRename = useCallback((id: string, newName: string) => { const t = newName.trim(); if (!t) { setEditingId(null); return }; saveFolders(folders.map(f => f.id === id ? { ...f, name: t } : f)); setEditingId(null) }, [folders, saveFolders])
  const handleDelete = useCallback((id: string) => { saveFolders(folders.filter(f => f.id !== id)); setDeletingId(null) }, [folders, saveFolders])
  const toggleExpanded = useCallback((id: string) => { setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next }) }, [])

  const selectedFolder = folders.find(f => f.id === selectedFolderId) ?? null

  const handleAddAgent = useCallback(() => {
    if (!selectedFolderId) return
    const na: AgentProfile = { id: crypto.randomUUID(), name: 'New Agent', command: '', args: [], cwdMode: 'activeSession', launchTarget: 'newTab' }
    saveFolders(folders.map(f => f.id === selectedFolderId ? { ...f, agents: [...f.agents, na] } : f))
    setEditingAgentId(na.id); setAgentForm({ name: na.name, command: '', args: '', cwdPath: '' })
  }, [selectedFolderId, folders, saveFolders])

  const handleEditAgent = useCallback((agent: AgentProfile) => {
    setEditingAgentId(agent.id); setAgentForm({ name: agent.name, command: agent.command, args: agent.args.join(' '), cwdPath: agent.cwdPath ?? '' })
  }, [])

  const handleSaveAgent = useCallback(() => {
    if (!selectedFolderId || !editingAgentId) return
    saveFolders(folders.map(f => {
      if (f.id !== selectedFolderId) return f
      return { ...f, agents: f.agents.map(a => a.id !== editingAgentId ? a : { ...a, name: agentForm.name.trim() || 'Untitled', command: agentForm.command, args: agentForm.args.trim() ? agentForm.args.trim().split(/\s+/) : [], launchTarget: agentForm.cwdPath.trim() ? 'path' as const : 'newTab' as const, cwdPath: agentForm.cwdPath.trim() || undefined }) }
    }))
    setEditingAgentId(null)
  }, [selectedFolderId, editingAgentId, agentForm, folders, saveFolders])

  const handleDeleteAgent = useCallback((agentId: string) => {
    if (!selectedFolderId) return
    saveFolders(folders.map(f => f.id === selectedFolderId ? { ...f, agents: f.agents.filter(a => a.id !== agentId) } : f))
    setDeletingAgentId(null); if (editingAgentId === agentId) setEditingAgentId(null)
  }, [selectedFolderId, folders, saveFolders, editingAgentId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0, 0, 0, 0.4)' }}
    >
      <div ref={panelRef} style={{ height: '100%', width: '420px', maxWidth: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--bg-hover)', background: 'var(--bg-primary)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '16px', paddingRight: '16px', paddingTop: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--bg-hover)', background: 'var(--bg-secondary)' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Settings</span>
          <button type="button" onClick={onClose} style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)', background: 'none', border: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')} title="Close settings">✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--bg-hover)', background: 'var(--bg-secondary)' }}>
          {TABS.map((tab) => (
            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, paddingLeft: '12px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', fontSize: '12px', cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)', background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent', transition: 'color 150ms ease, border-color 150ms ease',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {activeTab === 'general' && (
            <div style={sectionGroup}>
              {/* Editor */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Editor Command</label>
                <input type="text" value={editor} onChange={(e) => handleEditorChange(e.target.value)} placeholder="code" style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')} onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')} />
                <p style={helpText}>Command used to open files and folders (e.g. code, cursor, vim)</p>
              </div>
              {/* Start Folder */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Start Folder</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={startFolder} onChange={(e) => handleStartFolderChange(e.target.value)} placeholder="Default: home directory" style={{ ...inputStyle, flex: 1 }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')} onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')} />
                  <button type="button" onClick={handleBrowseFolder} style={{ ...outlineBtn, flexShrink: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}>Browse</button>
                </div>
                <p style={helpText}>Default working directory for new terminal sessions</p>
              </div>
              {/* Font Size */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Font Size — {fontSize}px</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={helpText}>{ZOOM.MIN}</span>
                  <input type="range" min={ZOOM.MIN} max={ZOOM.MAX} step={ZOOM.STEP} value={fontSize} onChange={(e) => handleFontSizeChange(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <span style={helpText}>{ZOOM.MAX}</span>
                </div>
                <p style={helpText}>Terminal font size (also adjustable with Ctrl+/-)</p>
              </div>
              {/* Config File */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Configuration File</label>
                <button type="button" onClick={handleOpenConfig} style={outlineBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}>Open Config File</button>
                <p style={helpText}>Open ~/AgentCraftworks/config.json in your editor</p>
              </div>
              {/* Import / Export */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Import / Export</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={async () => {
                    const bundle = await window.tangentAPI.config.exportConfig()
                    const filePath = await window.tangentAPI.dialog.saveFile({ defaultPath: 'tangent-config.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
                    if (!filePath) return; await window.tangentAPI.config.writeExport(filePath, bundle)
                  }} style={outlineBtn} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}>Export Config</button>
                  <button type="button" onClick={async () => {
                    const filePath = await window.tangentAPI.dialog.openFile([{ name: 'JSON', extensions: ['json'] }])
                    if (!filePath) return; const bundle = await window.tangentAPI.config.readImport(filePath); if (!bundle) return
                    const result = await window.tangentAPI.config.importConfig(bundle)
                    if (result.config) { if (result.config.editor) setEditor(result.config.editor); if (result.config.startFolder) setStartFolder(result.config.startFolder); if (result.config.fontSize) handleFontSizeChange(result.config.fontSize) }
                    if (result.agents) setFolders(result.agents)
                  }} style={outlineBtn} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}>Import Config</button>
                </div>
                <p style={helpText}>Export or import config.json and agents.json as a single file</p>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {folders.map((folder) => (
                <div key={folder.id}>
                  <div style={rowStyle} onMouseEnter={() => setHoveredFolderId(folder.id)} onMouseLeave={() => setHoveredFolderId(null)}>
                    <button type="button" onClick={() => toggleExpanded(folder.id)} style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', color: 'var(--text-muted)', background: 'none', border: 'none', fontSize: '10px' }}
                      title={expandedIds.has(folder.id) ? 'Collapse' : 'Expand'}>{expandedIds.has(folder.id) ? '▾' : '▸'}</button>
                    {editingId === folder.id ? (
                      <input autoFocus style={{ ...inputStyle, flex: 1, fontSize: '13px', paddingTop: '0', paddingBottom: '0', background: 'var(--bg-primary)', borderColor: 'var(--accent)' }}
                        value={editingName} onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(folder.id, editingName); if (e.key === 'Escape') setEditingId(null) }}
                        onBlur={() => handleRename(folder.id, editingName)} />
                    ) : (
                      <span style={{ flex: 1, fontSize: '13px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}
                        onClick={() => { setEditingId(folder.id); setEditingName(folder.name) }} title="Click to rename">{folder.name}</span>
                    )}
                    <span style={{ fontSize: '12px', flexShrink: 0, color: 'var(--text-muted)' }}>{folder.agents.length} agent{folder.agents.length !== 1 ? 's' : ''}</span>
                    {deletingId === folder.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button type="button" onClick={() => handleDelete(folder.id)} style={dangerBtn}>Confirm</button>
                        <button type="button" onClick={() => setDeletingId(null)} style={cancelBtn}>Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setDeletingId(folder.id)} style={{ ...hoverDeleteBtn, opacity: hoveredFolderId === folder.id ? 1 : 0 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')} title="Delete project">✕</button>
                    )}
                  </div>
                  {expandedIds.has(folder.id) && folder.agents.length > 0 && (
                    <div style={{ marginLeft: '24px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {folder.agents.map((agent) => (
                        <div key={agent.id} style={{ fontSize: '12px', paddingLeft: '8px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{agent.name}</div>
                      ))}
                    </div>
                  )}
                  {expandedIds.has(folder.id) && folder.agents.length === 0 && (
                    <div style={{ marginLeft: '24px', marginTop: '2px', fontSize: '12px', paddingLeft: '8px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No agents</div>
                  )}
                </div>
              ))}
              <button type="button" onClick={handleAddFolder} style={dashedAddBtn}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--bg-hover)' }}>+ Add Folder</button>
            </div>
          )}

          {activeTab === 'agents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={fieldGroup}>
                <label style={labelStyle}>Project Folder</label>
                <select value={selectedFolderId ?? ''} onChange={(e) => { setSelectedFolderId(e.target.value || null); setEditingAgentId(null); setDeletingAgentId(null) }} style={inputStyle}>
                  <option value="">Select a folder…</option>
                  {folders.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                </select>
              </div>
              {selectedFolder && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selectedFolder.agents.map((agent) => (
                    <div key={agent.id}>
                      {editingAgentId === agent.id ? (
                        <div style={{ borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--accent)' }}>
                          {[{ label: 'Name', key: 'name' as const, ph: '' }, { label: 'Command', key: 'command' as const, ph: 'e.g. copilot-cli' }, { label: 'Arguments (space-separated)', key: 'args' as const, ph: 'e.g. --verbose --no-color' }].map(({ label: lbl, key, ph }) => (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>{lbl}</label>
                              <input autoFocus={key === 'name'} type="text" value={agentForm[key]} onChange={(e) => setAgentForm(prev => ({ ...prev, [key]: e.target.value }))} placeholder={ph}
                                style={{ ...inputStyle, background: 'var(--bg-primary)' }} onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')} onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')} />
                            </div>
                          ))}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Working Directory</label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <input type="text" value={agentForm.cwdPath} onChange={(e) => setAgentForm(prev => ({ ...prev, cwdPath: e.target.value }))} placeholder="e.g. D:\git\myproject"
                                style={{ ...inputStyle, flex: 1, background: 'var(--bg-primary)' }} onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')} onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--bg-hover)')} />
                              <button type="button" onClick={async () => { const s = await (window as any).tangentAPI.dialog.openFolder(); if (s) setAgentForm(prev => ({ ...prev, cwdPath: s })) }}
                                style={{ ...outlineBtn, flexShrink: 0, paddingLeft: '8px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', background: 'none', color: 'var(--text-secondary)' }}>Browse</button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                            <button type="button" onClick={handleSaveAgent} style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '4px', paddingBottom: '4px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)', background: 'var(--accent)', border: 'none' }}>Save</button>
                            <button type="button" onClick={() => setEditingAgentId(null)} style={cancelBtn}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={rowStyle} onMouseEnter={() => setHoveredAgentId(agent.id)} onMouseLeave={() => setHoveredAgentId(null)}>
                          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => handleEditAgent(agent)}>
                            <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{agent.name}</div>
                            <div style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{agent.command}{agent.args.length > 0 ? ` ${agent.args.join(' ')}` : ''}</div>
                          </div>
                          <button type="button" onClick={() => handleEditAgent(agent)} style={{ ...hoverDeleteBtn, opacity: hoveredAgentId === agent.id ? 1 : 0, fontSize: '11px' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')} title="Edit agent">✎</button>
                          {deletingAgentId === agent.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <button type="button" onClick={() => handleDeleteAgent(agent.id)} style={dangerBtn}>Confirm</button>
                              <button type="button" onClick={() => setDeletingAgentId(null)} style={cancelBtn}>Cancel</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setDeletingAgentId(agent.id)} style={{ ...hoverDeleteBtn, opacity: hoveredAgentId === agent.id ? 1 : 0 }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')} title="Delete agent">✕</button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedFolder.agents.length === 0 && (
                    <p style={{ fontSize: '12px', paddingLeft: '8px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No agents in this folder</p>
                  )}
                  <button type="button" onClick={handleAddAgent} style={dashedAddBtn}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--bg-hover)' }}>+ Add Agent</button>
                </div>
              )}
              {!selectedFolderId && <p style={helpText}>Select a project folder to manage its agents</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
