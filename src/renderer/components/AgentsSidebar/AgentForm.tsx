import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { AgentProfile } from '@shared/types'

interface AgentFormProps {
  initialValues?: AgentProfile
  onSave: (agent: AgentProfile) => void
  onCancel: () => void
}

// Styles defined as plain objects to avoid Griffel strict typing issues
// with CSS custom properties (var(--*)) in shorthand properties
const formStyles = {
  root: { padding: '8px', borderTop: '1px solid var(--bg-hover)', background: 'var(--bg-secondary)' } as const,
  heading: { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px', color: 'var(--text-muted)' },
  field: { marginBottom: '8px' } as const,
  label: { fontSize: '12px', marginBottom: '2px', display: 'block' as const, color: 'var(--text-secondary)' },
  input: { width: '100%', padding: '4px 8px', fontSize: '13px', borderRadius: '4px', outline: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--bg-hover)', transition: 'border-color 200ms' } as React.CSSProperties,
  cwdRow: { display: 'flex', gap: '4px' } as const,
  browseBtn: { padding: '4px 8px', fontSize: '13px', borderRadius: '4px', flexShrink: 0, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--bg-hover)', cursor: 'pointer' } as React.CSSProperties,
  suggestions: { position: 'absolute' as const, left: 0, right: 0, marginTop: '2px', borderRadius: '4px', overflowY: 'auto' as const, zIndex: 50, maxHeight: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' } as React.CSSProperties,
  suggestionItem: { width: '100%', textAlign: 'left' as const, padding: '4px 8px', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block', color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer' } as React.CSSProperties,
  buttons: { display: 'flex', gap: '8px' } as const,
  saveBtn: { flex: 1, padding: '4px 8px', fontSize: '13px', borderRadius: '4px', cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none' } as React.CSSProperties,
  cancelBtn: { flex: 1, padding: '4px 8px', fontSize: '13px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--bg-hover)' } as React.CSSProperties,
}

export function AgentForm({ initialValues, onSave, onCancel }: AgentFormProps) {
  const s = formStyles
  const [name, setName] = useState(initialValues?.name ?? '')
  const [command, setCommand] = useState(initialValues?.command ?? '')
  const [argsStr, setArgsStr] = useState(initialValues?.args.join(' ') ?? '')
  const [cwdPath, setCwdPath] = useState(initialValues?.cwdPath ?? '')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const cwdInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const isMountedRef = useRef(true)

  const handleBrowseFolder = async () => {
    const selected = await (window as any).tangentAPI.dialog.openFolder()
    if (selected) { setCwdPath(selected); setShowSuggestions(false) }
  }

  const handleCwdChange = (value: string) => {
    setCwdPath(value)
    setSelectedSuggestion(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await (window as any).tangentAPI.fs.suggestDirs(value)
          if (!isMountedRef.current) return
          setSuggestions(results)
          setShowSuggestions(results.length > 0)
        } catch {
          if (!isMountedRef.current) return
          setSuggestions([]); setShowSuggestions(false)
        }
      }, 150)
    } else { setSuggestions([]); setShowSuggestions(false) }
  }

  const selectSuggestion = (path: string) => {
    setCwdPath(path); setShowSuggestions(false); setSelectedSuggestion(-1); cwdInputRef.current?.focus()
  }

  const handleCwdKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestion(prev => Math.max(prev - 1, 0)) }
    else if (e.key === 'Enter' && selectedSuggestion >= 0) { e.preventDefault(); selectSuggestion(suggestions[selectedSuggestion]) }
    else if (e.key === 'Tab' && selectedSuggestion >= 0) { e.preventDefault(); const selected = suggestions[selectedSuggestion]; setCwdPath(selected + '\\'); setSelectedSuggestion(-1); handleCwdChange(selected + '\\') }
    else if (e.key === 'Escape') setShowSuggestions(false)
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) && cwdInputRef.current !== e.target) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSave = () => {
    const trimmedName = name.trim()
    const trimmedCommand = command.trim()
    if (!trimmedName || !trimmedCommand) return
    const args = argsStr.trim() ? argsStr.trim().split(/\s+/) : []
    const agent: AgentProfile = {
      id: initialValues?.id ?? uuidv4(),
      name: trimmedName,
      command: trimmedCommand,
      args,
      cwdMode: 'activeSession',
      launchTarget: cwdPath.trim() ? 'path' : 'newTab',
      ...(cwdPath.trim() ? { cwdPath: cwdPath.trim() } : {})
    }
    if (initialValues?.env) agent.env = initialValues.env
    onSave(agent)
  }

  return (
    <div style={s.root}>
      <div style={s.heading}>{initialValues ? 'Edit Agent' : 'New Agent'}</div>
      <div style={s.field}>
        <label style={s.label}>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Copilot CLI" style={s.input} />
      </div>
      <div style={s.field}>
        <label style={s.label}>Command</label>
        <input type="text" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="e.g. copilot" style={s.input} />
      </div>
      <div style={s.field}>
        <label style={s.label}>Arguments (space-separated)</label>
        <input type="text" value={argsStr} onChange={(e) => setArgsStr(e.target.value)} placeholder="e.g. --flag value" style={s.input} />
      </div>
      <div style={{ ...s.field, position: 'relative', marginBottom: '12px' }}>
        <label style={s.label}>Working Directory</label>
        <div style={s.cwdRow}>
          <input
            ref={cwdInputRef}
            type="text"
            value={cwdPath}
            onChange={(e) => handleCwdChange(e.target.value)}
            onKeyDown={handleCwdKeyDown}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
            placeholder="e.g. D:\git\myproject"
            style={{ ...s.input, flex: 1 }}
          />
          <button type="button" onClick={handleBrowseFolder} style={s.browseBtn}>Browse</button>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div ref={suggestionsRef} style={s.suggestions}>
            {suggestions.map((sg, i) => (
              <button
                type="button"
                key={sg}
                style={{ ...s.suggestionItem, background: i === selectedSuggestion ? 'var(--bg-hover)' : 'transparent' }}
                onMouseEnter={() => setSelectedSuggestion(i)}
                onClick={() => selectSuggestion(sg)}
              >
                {sg}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={s.buttons}>
        <button type="button" onClick={handleSave} style={s.saveBtn}>Save</button>
        <button type="button" onClick={onCancel} style={s.cancelBtn}>Cancel</button>
      </div>
    </div>
  )
}
