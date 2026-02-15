import type { Session } from '@shared/types'
import { mapStatusToUI } from '@shared/statusMapping'

interface SessionsPanelProps {
  sessions: Session[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onCreate: () => void
}

export function SessionsPanel({ sessions, activeId, onSelect, onClose, onCreate }: SessionsPanelProps) {
  return (
    <div
      className="w-[240px] min-w-[240px] h-full border-r border-[var(--bg-hover)] flex flex-col"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <div className="p-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Sessions ({sessions.length})
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {sessions.map(session => {
          const ui = mapStatusToUI(session.status)
          const isActive = session.id === activeId
          return (
            <div
              key={session.id}
              onClick={() => onSelect(session.id)}
              className="relative flex items-center gap-2 px-3 py-2 mb-1 rounded cursor-pointer group"
              style={{
                background: isActive ? ui.bgTintSelected : ui.bgTint,
                borderLeft: ui.barColor ? `3px solid var(${ui.barColor})` : '3px solid transparent',
                transition: 'background 400ms ease, border-color 400ms ease',
                boxShadow: isActive ? ui.glowShadow : 'none'
              }}
            >
              {ui.dotVisible && (
                <span
                  className={`w-2 h-2 rounded-full ${ui.dotAnimation === 'pulse-slow' ? 'animate-pulse-slow' : ui.dotAnimation === 'pulse-fast' ? 'animate-pulse-fast' : ''}`}
                  style={{ background: ui.dotColor ? `var(${ui.dotColor})` : undefined }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {session.name}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {session.lastActivity || session.agentType}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(session.id) }}
                className="opacity-0 group-hover:opacity-100 text-xs px-1 rounded hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <button
        onClick={onCreate}
        className="m-2 p-2 text-sm rounded border border-[var(--bg-hover)] hover:bg-[var(--bg-hover)] transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        + New Session
      </button>
    </div>
  )
}
