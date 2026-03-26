import { useMemo } from 'react'
import type { ActionRequest, OperationLogEntry } from '@shared/hub-types'
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Props {
  entries: OperationLogEntry[]
  actionRequests: ActionRequest[]
  lastUpdated: Date | null
  onRefresh: () => void
}

type WorkflowHealthStatus = 'healthy' | 'degraded' | 'critical' | 'stale' | 'no-data'

export interface WorkflowHealthMetrics {
  status: WorkflowHealthStatus
  successfulRuns: number
  failedRuns: number
  totalRuns: number
  successRate: number
  pendingRequests: number
  chart: Array<{ hour: string; total: number; failed: number }>
}

const STALE_WINDOW_MS = 5 * 60_000

export function buildWorkflowHealthMetrics(
  entries: OperationLogEntry[],
  actionRequests: ActionRequest[],
  now = Date.now(),
  lastUpdated: Date | null = null,
): WorkflowHealthMetrics {
  const pendingRequests = actionRequests.filter((request) => request.state === 'pending').length
  const last24hStart = now - 24 * 60 * 60_000

  const recentRuns = entries.filter((entry) => {
    const ts = Date.parse(entry.ts)
    return Number.isFinite(ts) && ts >= last24hStart
  })

  const successfulRuns = recentRuns.filter((entry) => entry.result === 'ok').length
  const failedRuns = recentRuns.filter((entry) => entry.result === 'failed').length
  const totalRuns = successfulRuns + failedRuns
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0

  const chartBuckets = new Map<string, { total: number; failed: number }>()
  for (let i = 5; i >= 0; i--) {
    const point = new Date(now - i * 60 * 60_000)
    const key = `${point.getHours().toString().padStart(2, '0')}:00`
    chartBuckets.set(key, { total: 0, failed: 0 })
  }

  for (const entry of recentRuns) {
    const ts = Date.parse(entry.ts)
    if (!Number.isFinite(ts) || ts < now - 6 * 60 * 60_000) {
      continue
    }

    const point = new Date(ts)
    const key = `${point.getHours().toString().padStart(2, '0')}:00`
    const bucket = chartBuckets.get(key)
    if (!bucket) {
      continue
    }

    if (entry.result === 'ok' || entry.result === 'failed') {
      bucket.total += 1
      if (entry.result === 'failed') {
        bucket.failed += 1
      }
    }
  }

  const chart = Array.from(chartBuckets.entries()).map(([hour, value]) => ({
    hour,
    total: value.total,
    failed: value.failed,
  }))

  let status: WorkflowHealthStatus = 'healthy'

  if (!lastUpdated || now - lastUpdated.getTime() > STALE_WINDOW_MS) {
    status = 'stale'
  } else if (totalRuns === 0 && pendingRequests === 0) {
    status = 'no-data'
  } else if (failedRuns >= 3 || (totalRuns > 0 && (failedRuns / totalRuns) >= 0.3) || pendingRequests >= 10) {
    status = 'critical'
  } else if (failedRuns > 0 || pendingRequests > 0) {
    status = 'degraded'
  }

  return {
    status,
    successfulRuns,
    failedRuns,
    totalRuns,
    successRate,
    pendingRequests,
    chart,
  }
}

export function WorkflowHealthPanel({ entries, actionRequests, lastUpdated, onRefresh }: Props) {
  const metrics = useMemo(
    () => buildWorkflowHealthMetrics(entries, actionRequests, Date.now(), lastUpdated),
    [entries, actionRequests, lastUpdated],
  )

  const statusTheme = {
    healthy: { text: 'Healthy', className: 'text-emerald-300 bg-emerald-500/15' },
    degraded: { text: 'Degraded', className: 'text-amber-300 bg-amber-500/15' },
    critical: { text: 'Critical', className: 'text-red-300 bg-red-500/15' },
    stale: { text: 'Stale', className: 'text-slate-300 bg-slate-500/20' },
    'no-data': { text: 'Waiting for data', className: 'text-slate-300 bg-slate-500/20' },
  } as const

  const activeTheme = statusTheme[metrics.status]

  return (
    <PanelShell title="Workflow Health" icon={<Activity size={14} />} onRefresh={onRefresh}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-white/50">Last 24h workflow outcomes</div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${activeTheme.className}`}>
          {activeTheme.text}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <StatCard label="Total runs" value={metrics.totalRuns.toString()} />
        <StatCard label="Success rate" value={`${metrics.successRate}%`} />
        <StatCard label="Failures" value={metrics.failedRuns.toString()} tone="danger" />
        <StatCard label="Pending approvals" value={metrics.pendingRequests.toString()} tone="warn" />
      </div>

      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metrics.chart} margin={{ top: 5, right: 6, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="workflowTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="workflowFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={24}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: 'none', borderRadius: 6, fontSize: 11 }}
              formatter={(value: number, name: string) => [value.toLocaleString(), name === 'failed' ? 'Failed' : 'Total']}
            />
            <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={1.5} fill="url(#workflowTotal)" />
            <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={1.3} fill="url(#workflowFailed)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[10px] text-white/25 flex items-center gap-1">
        {metrics.status === 'critical'
          ? <AlertTriangle size={10} className="text-red-300/80" />
          : <CheckCircle2 size={10} className="text-emerald-300/80" />}
        Real-time status updates from operation and request streams
      </div>
    </PanelShell>
  )
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'warn' | 'danger'
}) {
  const toneClass = tone === 'danger'
    ? 'text-red-300'
    : tone === 'warn'
      ? 'text-amber-300'
      : 'text-white'
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
      <div className="text-[10px] text-white/45">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  )
}

function PanelShell({
  title,
  icon,
  onRefresh,
  children,
}: {
  title: string
  icon: React.ReactNode
  onRefresh: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-1 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
          {icon}
          {title}
        </div>
        <button onClick={onRefresh} className="text-white/30 hover:text-white/70 transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>
      {children}
    </div>
  )
}
