import { useMemo } from 'react'
import type { Session } from '@shared/types'
import { mapStatusToUI } from '@shared/statusMapping'

interface StatusBarProps {
  sessions: Session[]
  activeSession: Session | undefined
}

/** Agent type label mapping */
const AGENT_LABELS: Record<string, string> = {
  'copilot-cli': 'Copilot CLI',
  'claude-code': 'Claude Code',
  shell: 'Shell'
}

/**
 * Truncate a path from the left side if it exceeds maxLen.
 * e.g., "C:\Users\me\very\long\path" -> "...\very\long\path"
 */
function truncatePathLeft(p: string, maxLen: number): string {
  if (p.length <= maxLen) return p
  return '\u2026' + p.slice(p.length - maxLen + 1)
}

/**
 * Truncate text from the right if it exceeds maxLen.
 */
function truncateRight(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '\u2026'
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

export function StatusBar({ sessions, activeSession }: StatusBarProps) {
  const uiStatus = useMemo(
    () => (activeSession ? mapStatusToUI(activeSession.status) : null),
    [activeSession]
  )

  // Count non-running sessions (those that are still alive, i.e., not exited and not shell_ready)
  const nonRunningCount = useMemo(
    () => sessions.filter(s => s.status !== 'exited' && s.status !== 'shell_ready').length,
    [sessions]
  )

  const dotStyle = useMemo(() => {
    if (!uiStatus || !uiStatus.dotVisible || !uiStatus.dotColor) return undefined
    return {
      color: `var(${uiStatus.dotColor})`,
      animation: uiStatus.dotAnimation !== 'none' ? `${uiStatus.dotAnimation} 2s ease-in-out infinite` : undefined
    }
  }, [uiStatus])

  const agentLabel = activeSession
    ? AGENT_LABELS[activeSession.agentType] ?? activeSession.agentType
    : 'No Session'

  const lastActivity = activeSession
    ? truncateRight(activeSession.lastActivity || '', 40)
    : ''

  const cwdPath = activeSession
    ? truncatePathLeft(activeSession.folderPath || '', 50)
    : ''

  return (
    <div
      className="h-6 min-h-6 flex items-center px-3 text-xs border-t border-[var(--bg-hover)]"
      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
    >
      {/* Left section: status dot + session counts */}
      <div className="flex items-center gap-1.5 shrink-0">
        {uiStatus?.dotVisible ? (
          <span style={dotStyle}>{'\u25CF'}</span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>{'\u25CB'}</span>
        )}
        <span>
          {nonRunningCount} active
        </span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span>{sessions.length} total</span>
      </div>

      <span className="mx-2" style={{ color: 'var(--text-muted)' }}>{'\u2502'}</span>

      {/* Center section: agent type + last activity */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink">
        <span style={{ color: 'var(--text-primary)' }}>{agentLabel}</span>
        {lastActivity && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
            <span className="truncate" style={{ color: 'var(--text-muted)' }}>
              {lastActivity}
            </span>
          </>
        )}
      </div>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Right section: Metrics + CWD + keyboard hint */}
      <div className="flex items-center gap-2 shrink-0">
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
            <span className="mx-0.5" style={{ color: 'var(--text-muted)' }}>{'\u2502'}</span>
          </>
        )}
        {cwdPath && (
          <span className="max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }} title={activeSession?.folderPath}>
            {cwdPath}
          </span>
        )}
        <span className="mx-1" style={{ color: 'var(--text-muted)' }}>{'\u2502'}</span>
        <span style={{ color: 'var(--text-muted)' }}>Ctrl+B panels</span>
      </div>
    </div>
  )
}
