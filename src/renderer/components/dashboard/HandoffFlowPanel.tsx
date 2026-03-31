// HandoffFlowPanel.tsx — Agent-to-agent handoff flow visualization
import type { HubHandoffData, HubHandoffEntry, HandoffStatus, HandoffPriority } from '@shared/hub-types'
import { RefreshCw, ArrowRight, GitPullRequest } from 'lucide-react'

interface Props {
  data: HubHandoffData | null
  onRefresh: () => void
}

const statusColors: Record<HandoffStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Pending' },
  active: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Active' },
  completed: { bg: 'bg-white/10', text: 'text-white/60', label: 'Done' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
}

const priorityColors: Record<HandoffPriority, string> = {
  critical: 'text-red-400',
  high: 'text-amber-400',
  medium: 'text-blue-400',
  low: 'text-white/40',
}

function HandoffCard({ handoff }: { handoff: HubHandoffEntry }) {
  const status = statusColors[handoff.status]
  const priColor = priorityColors[handoff.priority]
  const age = handoff.created_at
    ? `${Math.round((Date.now() - new Date(handoff.created_at).getTime()) / 60000)}m ago`
    : ''

  return (
    <div className={`rounded-lg p-3 border border-white/5 ${status.bg}`} data-testid={`handoff-${handoff.handoff_id}`}>
      {/* Agent flow */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-white/80 text-xs font-mono truncate max-w-[100px]">{handoff.from_agent}</span>
        <ArrowRight size={12} className="text-white/30 flex-shrink-0" />
        <span className="text-white/80 text-xs font-mono truncate max-w-[100px]">{handoff.to_agent}</span>
        <span className={`ml-auto text-[10px] font-medium ${status.text}`}>{status.label}</span>
      </div>
      {/* Task + metadata */}
      <div className="text-[11px] text-white/50 truncate mb-1">{handoff.task}</div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className={priColor}>{handoff.priority}</span>
        <span className="text-white/30">{age}</span>
        {handoff.sla_deadline && (
          <span className="text-amber-400/70">SLA: {new Date(handoff.sla_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        )}
        {handoff.failure_reason && (
          <span className="text-red-400 truncate max-w-[120px]">{handoff.failure_reason}</span>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-white/40">{label}</div>
    </div>
  )
}

export function HandoffFlowPanel({ data, onRefresh }: Props) {
  if (!data) {
    return (
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 col-span-2" data-testid="hub-handoff-flow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
            <GitPullRequest size={14} /> Agent Handoffs
          </div>
          <button onClick={onRefresh} className="text-white/40 hover:text-white/80 transition"><RefreshCw size={12} /></button>
        </div>
        <div className="text-white/30 text-xs text-center py-6">No handoff data</div>
      </div>
    )
  }

  const { active, recent, stats } = data
  const avgTime = stats.avgCompletionMs > 0 ? `${Math.round(stats.avgCompletionMs / 60000)}m` : '--'

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 col-span-2" data-testid="hub-handoff-flow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
          <GitPullRequest size={14} /> Agent Handoffs
        </div>
        <button onClick={onRefresh} className="text-white/40 hover:text-white/80 transition"><RefreshCw size={12} /></button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4 p-3 bg-white/5 rounded-lg" data-testid="handoff-stats">
        <StatCard label="Active" value={stats.active} color="text-green-400" />
        <StatCard label="Completed" value={stats.completed} color="text-white/80" />
        <StatCard label="Failed" value={stats.failed} color={stats.failed > 0 ? 'text-red-400' : 'text-white/40'} />
        <StatCard label="Avg Time" value={avgTime} color="text-blue-400" />
      </div>

      {/* Active handoffs */}
      <div className="mb-3">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
          Active ({active.length})
        </div>
        {active.length === 0 ? (
          <div className="text-white/20 text-xs text-center py-2">No active handoffs</div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {active.map((h) => <HandoffCard key={h.handoff_id} handoff={h} />)}
          </div>
        )}
      </div>

      {/* Recent completions */}
      {recent.length > 0 && (
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
            Recent ({recent.length})
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {recent.slice(0, 5).map((h) => <HandoffCard key={h.handoff_id} handoff={h} />)}
          </div>
        </div>
      )}

      {/* SLA compliance */}
      {stats.slaComplianceRate > 0 && (
        <div className="mt-3 text-[10px] text-white/30 text-right">
          SLA compliance: <span className={stats.slaComplianceRate >= 95 ? 'text-green-400' : stats.slaComplianceRate >= 80 ? 'text-amber-400' : 'text-red-400'}>
            {stats.slaComplianceRate}%
          </span>
        </div>
      )}
    </div>
  )
}
