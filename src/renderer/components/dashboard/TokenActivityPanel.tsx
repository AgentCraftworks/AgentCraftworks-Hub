// TokenActivityPanel.tsx — Top API callers from enterprise audit log
import type { AuditLogEntry } from '@shared/hub-types'
import { Users, Lock } from 'lucide-react'

interface Props {
  topCallers: AuditLogEntry[]
  error?: boolean
}

export function TokenActivityPanel({ topCallers, error }: Props) {
  if (error) {
    return (
      <Panel>
        <div className="flex flex-col items-center justify-center h-28 gap-2 text-white/30">
          <Lock size={20} />
          <p className="text-xs text-center">
            Token Activity requires <span className="text-white/60">read:audit_log</span> scope
            <br />
            (enterprise admin access)
          </p>
        </div>
      </Panel>
    )
  }

  if (topCallers.length === 0) {
    return (
      <Panel>
        <div className="text-white/30 text-sm flex items-center justify-center h-16">
          No audit log data yet…
        </div>
      </Panel>
    )
  }

  const max = topCallers[0]?.count ?? 1

  return (
    <Panel>
      <div className="space-y-2">
        {topCallers.slice(0, 8).map((entry) => {
          const pct = Math.round((entry.count / max) * 100)
          const lastSeen = new Date(entry.lastSeenAt)
          return (
            <div key={entry.actor} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-mono text-white/80 truncate max-w-[140px]">
                    {entry.appSlug ?? entry.actor}
                  </span>
                  <span className="text-[10px] text-white/40 tabular-nums ml-2">{entry.count}</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="text-[9px] text-white/30 w-14 text-right flex-shrink-0">
                {entry.tokenType}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-white/20 mt-3">
        Last 100 audit log events · actors sorted by call count
      </p>
    </Panel>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-3">
        <Users size={14} />
        Token Activity
      </div>
      {children}
    </div>
  )
}
