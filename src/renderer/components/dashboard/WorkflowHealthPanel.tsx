import { useMemo } from 'react'
import type { ActionRequest, OperationLogEntry } from '@shared/hub-types'
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as ps from './panel-styles'

interface Props {
  entries: OperationLogEntry[]
  actionRequests: ActionRequest[]
  lastUpdated: Date | null
  onRefresh: () => void
}

type WorkflowHealthStatus = 'healthy' | 'degraded' | 'critical' | 'stale' | 'no-data'

export interface WorkflowHealthMetrics {
  status: WorkflowHealthStatus; successfulRuns: number; failedRuns: number; totalRuns: number
  successRate: number; pendingRequests: number; chart: Array<{ hour: string; total: number; failed: number }>
}

const STALE_WINDOW_MS = 5 * 60_000
const CRITICAL_FAILURE_COUNT = 3
const CRITICAL_FAILURE_RATIO = 0.3
const CRITICAL_PENDING_REQUESTS = 10
const TOOLTIP_LABELS: Record<string, string> = { failed: 'Failed', total: 'Total' }

export function buildWorkflowHealthMetrics(entries: OperationLogEntry[], actionRequests: ActionRequest[], now = Date.now(), lastUpdated: Date | null = null): WorkflowHealthMetrics {
  const pendingRequests = actionRequests.filter((r) => r.state === 'pending').length
  const last24hStart = now - 24 * 60 * 60_000
  const recentRuns = entries.filter((e) => { const ts = Date.parse(e.ts); return Number.isFinite(ts) && ts >= last24hStart })
  const successfulRuns = recentRuns.filter((e) => e.result === 'ok').length
  const failedRuns = recentRuns.filter((e) => e.result === 'failed').length
  const totalRuns = successfulRuns + failedRuns
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0

  const chartBuckets = new Map<string, { total: number; failed: number }>()
  for (let i = 5; i >= 0; i--) { const p = new Date(now - i * 60 * 60_000); chartBuckets.set(`${p.getHours().toString().padStart(2, '0')}:00`, { total: 0, failed: 0 }) }
  for (const e of recentRuns) { const ts = Date.parse(e.ts); if (!Number.isFinite(ts) || ts < now - 6 * 60 * 60_000) continue; const p = new Date(ts); const key = `${p.getHours().toString().padStart(2, '0')}:00`; const b = chartBuckets.get(key); if (!b) continue; if (e.result === 'ok' || e.result === 'failed') { b.total += 1; if (e.result === 'failed') b.failed += 1 } }
  const chart = Array.from(chartBuckets.entries()).map(([hour, v]) => ({ hour, total: v.total, failed: v.failed }))

  let status: WorkflowHealthStatus = 'healthy'
  if (!lastUpdated || now - lastUpdated.getTime() > STALE_WINDOW_MS) status = 'stale'
  else if (totalRuns === 0 && pendingRequests === 0) status = 'no-data'
  else if (failedRuns >= CRITICAL_FAILURE_COUNT || (totalRuns > 0 && (failedRuns / totalRuns) >= CRITICAL_FAILURE_RATIO) || pendingRequests >= CRITICAL_PENDING_REQUESTS) status = 'critical'
  else if (failedRuns > 0 || pendingRequests > 0) status = 'degraded'

  return { status, successfulRuns, failedRuns, totalRuns, successRate, pendingRequests, chart }
}

const statusTheme = {
  healthy: { text: 'Healthy', bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7' },
  degraded: { text: 'Degraded', bg: 'rgba(245,158,11,0.15)', color: '#fcd34d' },
  critical: { text: 'Critical', bg: 'rgba(239,68,68,0.15)', color: '#fca5a5' },
  stale: { text: 'Stale', bg: 'rgba(100,116,139,0.2)', color: '#cbd5e1' },
  'no-data': { text: 'Waiting for data', bg: 'rgba(100,116,139,0.2)', color: '#cbd5e1' },
} as const

export function WorkflowHealthPanel({ entries, actionRequests, lastUpdated, onRefresh }: Props) {
  const metrics = useMemo(() => buildWorkflowHealthMetrics(entries, actionRequests, Date.now(), lastUpdated), [entries, actionRequests, lastUpdated])
  const active = statusTheme[metrics.status]

  return (
    <PanelShell title="Workflow Health" icon={<Activity size={14} />} onRefresh={onRefresh}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Last 24h workflow outcomes</div>
        <span style={{ fontSize: '10px', paddingLeft: '8px', paddingRight: '8px', paddingTop: '2px', paddingBottom: '2px', borderRadius: '999px', fontWeight: 500, background: active.bg, color: active.color }}>{active.text}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <StatCard label="Total runs" value={metrics.totalRuns.toString()} />
        <StatCard label="Success rate" value={`${metrics.successRate}%`} />
        <StatCard label="Failures" value={metrics.failedRuns.toString()} tone="danger" />
        <StatCard label="Pending approvals" value={metrics.pendingRequests.toString()} tone="warn" />
      </div>

      <div style={{ height: '112px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metrics.chart} margin={{ top: 5, right: 6, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="workflowTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0.04} /></linearGradient>
              <linearGradient id="workflowFailed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }} tickLine={false} axisLine={false} width={24} />
            <Tooltip contentStyle={{ background: '#111827', border: 'none', borderRadius: 6, fontSize: 11 }} formatter={(value: number, name: string) => [value.toLocaleString(), TOOLTIP_LABELS[name] ?? name]} />
            <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={1.5} fill="url(#workflowTotal)" />
            <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={1.3} fill="url(#workflowFailed)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', ...ps.finePrint }}>
        {metrics.status === 'critical' ? <AlertTriangle size={10} style={{ color: 'rgba(252,165,165,0.8)' }} /> : <CheckCircle2 size={10} style={{ color: 'rgba(110,231,183,0.8)' }} />}
        Real-time status updates from operation and request streams
      </div>
    </PanelShell>
  )
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? '#fca5a5' : tone === 'warn' ? '#fcd34d' : '#fff'
  return (
    <div style={{ borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', paddingLeft: '8px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px' }}>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>{value}</div>
    </div>
  )
}

function PanelShell({ title, icon, onRefresh, children }: { title: string; icon: React.ReactNode; onRefresh: () => void; children: React.ReactNode }) {
  return (
    <div style={ps.panelCardFlex}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ ...ps.flexRow, fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{icon}{title}</div>
        <button type="button" onClick={onRefresh} style={ps.refreshBtn} title="Refresh"><RefreshCw size={12} /></button>
      </div>
      {children}
    </div>
  )
}
