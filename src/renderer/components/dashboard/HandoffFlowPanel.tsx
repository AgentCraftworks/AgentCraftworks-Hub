// HandoffFlowPanel.tsx — Agent-to-agent handoff flow visualization
import type { HubHandoffData, HubHandoffEntry, HandoffStatus, HandoffPriority } from '@shared/hub-types'
import { RefreshCw, ArrowRight, GitPullRequest } from 'lucide-react'
import * as ps from './panel-styles'

interface Props {
  data: HubHandoffData | null
  onRefresh: () => void
}

const statusColors: Record<HandoffStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa', label: 'Pending' },
  active: { bg: 'rgba(34,197,94,0.2)', text: '#4ade80', label: 'Active' },
  completed: { bg: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.6)', label: 'Done' },
  failed: { bg: 'rgba(239,68,68,0.2)', text: '#f87171', label: 'Failed' },
}

const priorityColors: Record<HandoffPriority, string> = {
  critical: '#f87171',
  high: '#fbbf24',
  medium: '#60a5fa',
  low: 'rgba(255,255,255,0.4)',
}

function HandoffCard({ handoff }: { handoff: HubHandoffEntry }) {
  const status = statusColors[handoff.status]
  const priColor = priorityColors[handoff.priority]
  const age = handoff.created_at ? `${Math.round((Date.now() - new Date(handoff.created_at).getTime()) / 60000)}m ago` : ''

  return (
    <div style={{ borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: status.bg }} data-testid={`handoff-${handoff.handoff_id}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ ...ps.textPrimary, fontSize: '12px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{handoff.from_agent}</span>
        <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        <span style={{ ...ps.textPrimary, fontSize: '12px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{handoff.to_agent}</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 500, color: status.text }}>{status.label}</span>
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>{handoff.task}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
        <span style={{ color: priColor }}>{handoff.priority}</span>
        <span style={ps.textFaint}>{age}</span>
        {handoff.sla_deadline && <span style={{ color: 'rgba(251,191,36,0.7)' }}>SLA: {new Date(handoff.sla_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        {handoff.failure_reason && <span style={{ color: '#f87171', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{handoff.failure_reason}</span>}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '18px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}</div>
      <div style={ps.statLabel}>{label}</div>
    </div>
  )
}

export function HandoffFlowPanel({ data, onRefresh }: Props) {
  if (!data) {
    return (
      <div style={ps.panelCard} data-testid="hub-handoff-flow">
        <div style={ps.panelHeaderSpaced}>
          <div style={{ ...ps.flexRow, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
            <GitPullRequest size={14} /> Agent Handoffs
          </div>
          <button type="button" onClick={onRefresh} style={ps.refreshBtn}><RefreshCw size={12} /></button>
        </div>
        <div style={{ ...ps.loadingState, paddingTop: '24px', paddingBottom: '24px' }}>No handoff data</div>
      </div>
    )
  }

  const { active, recent, stats } = data
  const avgTime = stats.avgCompletionMs > 0 ? `${Math.round(stats.avgCompletionMs / 60000)}m` : '--'

  return (
    <div style={ps.panelCard} data-testid="hub-handoff-flow">
      <div style={ps.panelHeaderSpaced}>
        <div style={{ ...ps.flexRow, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
          <GitPullRequest size={14} /> Agent Handoffs
        </div>
        <button type="button" onClick={onRefresh} style={ps.refreshBtn}><RefreshCw size={12} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }} data-testid="handoff-stats">
        <StatCard label="Active" value={stats.active} color="#4ade80" />
        <StatCard label="Completed" value={stats.completed} color="rgba(255,255,255,0.8)" />
        <StatCard label="Failed" value={stats.failed} color={stats.failed > 0 ? '#f87171' : 'rgba(255,255,255,0.4)'} />
        <StatCard label="Avg Time" value={avgTime} color="#60a5fa" />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Active ({active.length})</div>
        {active.length === 0 ? (
          <div style={{ ...ps.loadingState, paddingTop: '8px', paddingBottom: '8px' }}>No active handoffs</div>
        ) : (
          <div style={{ ...ps.stackSm, maxHeight: '160px', overflowY: 'auto' }}>
            {active.map((h) => <HandoffCard key={h.handoff_id} handoff={h} />)}
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Recent ({recent.length})</div>
          <div style={{ ...ps.stackSm, gap: '6px', maxHeight: '128px', overflowY: 'auto' }}>
            {recent.slice(0, 5).map((h) => <HandoffCard key={h.handoff_id} handoff={h} />)}
          </div>
        </div>
      )}

      {stats.slaComplianceRate > 0 && (
        <div style={{ marginTop: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
          SLA compliance: <span style={{ color: stats.slaComplianceRate >= 95 ? '#4ade80' : stats.slaComplianceRate >= 80 ? '#fbbf24' : '#f87171' }}>{stats.slaComplianceRate}%</span>
        </div>
      )}
    </div>
  )
}
