// RateLimitPanel.tsx — GitHub API rate limit gauge, sparkline, and countdown
import { useState } from 'react'
import type { RateLimitData, RateLimitSample } from '@shared/hub-types'
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis } from 'recharts'
import { RefreshCw, Zap, Clock } from 'lucide-react'

type TimeRange = '1h' | '6h' | 'all'

interface Props {
  data: RateLimitData | null
  history: RateLimitSample[]
  onRefresh: () => void
}

function formatEta(ms: number): string {
  if (ms <= 0) return 'resetting...'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function UsageBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
  const barColor =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : color
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-white/60 w-20 text-right">
        {used.toLocaleString()} / {limit.toLocaleString()}
      </span>
    </div>
  )
}

function filterHistory(samples: RateLimitSample[], range: TimeRange): RateLimitSample[] {
  const now = Date.now()
  if (range === '1h') return samples.filter(s => s.ts >= now - 60 * 60_000)
  if (range === '6h') return samples.filter(s => s.ts >= now - 6 * 60 * 60_000)
  return samples
}

export function RateLimitPanel({ data, history, onRefresh }: Props) {
  const [range, setRange] = useState<TimeRange>('1h')

  if (!data) {
    return (
      <PanelShell title="API Rate Limits" icon={<Zap size={14} />} onRefresh={onRefresh}>
        <div className="text-white/40 text-sm flex items-center justify-center h-24">Loading…</div>
      </PanelShell>
    )
  }

  const { core, search, graphql, codeSearch } = data
  const corePct = Math.round((core.used / core.limit) * 100)

  // Merge in-memory data.history (number[]) with persisted RateLimitSample[] history
  // data.history is just coreUsed values without timestamps — use for live tail only when full history is empty
  const fullHistory = filterHistory(history, range)
  const chartData = fullHistory.length > 1
    ? fullHistory.map(s => ({ ts: s.ts, used: s.coreUsed, label: formatTime(s.ts) }))
    : data.history.map((used, i) => ({ ts: i, used, label: '' }))

  // Tick labels: show every ~10th point to avoid crowding
  const tickInterval = Math.max(1, Math.floor(chartData.length / 6))

  return (
    <PanelShell title="API Rate Limits" icon={<Zap size={14} />} onRefresh={onRefresh}>
      {/* Core gauge + current stats */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-shrink-0 w-20 h-20">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={corePct >= 90 ? '#ef4444' : corePct >= 70 ? '#f59e0b' : '#22c55e'}
              strokeWidth="3"
              strokeDasharray={`${corePct * 0.942} 94.2`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold leading-none">{corePct}%</span>
            <span className="text-[9px] text-white/50 mt-0.5">used</span>
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          <div className="text-xs text-white/50">Core REST</div>
          <UsageBar used={core.used} limit={core.limit} color="bg-blue-500" />
          <div className="text-xs text-white/40">
            {core.remaining.toLocaleString()} remaining · resets in{' '}
            <span className="text-white/70 font-mono">{formatEta(core.resetEtaMs)}</span>
          </div>
          <div className="text-xs text-white/30 flex items-center gap-1">
            <Clock size={9} />
            {core.limit.toLocaleString()} calls/hr · enterprise quota
          </div>
        </div>
      </div>

      {/* History chart with range selector */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] text-white/30">
            Core usage history ({chartData.length} samples)
          </div>
          <div className="flex gap-1">
            {(['1h', '6h', 'all'] as TimeRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${range === r ? 'bg-blue-500/30 text-blue-300' : 'text-white/30 hover:text-white/60'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 1 ? (
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickInterval}
                />
                <Area
                  type="monotone"
                  dataKey="used"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  fill="url(#rateGrad)"
                  dot={false}
                />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 4, fontSize: 11 }}
                  formatter={(v: number) => [`${v.toLocaleString()} used`, '']}
                  labelFormatter={(label) => label || ''}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-8 flex items-center text-[10px] text-white/20">
            Collecting history… (polls every 30s)
          </div>
        )}
      </div>

      {/* Secondary endpoints */}
      <div className="space-y-2 border-t border-white/5 pt-3">
        {[
          { label: 'Search', ep: search, color: 'bg-purple-500' },
          { label: 'GraphQL', ep: graphql, color: 'bg-cyan-500' },
          { label: 'Code Search', ep: codeSearch, color: 'bg-orange-500' },
        ].map(({ label, ep, color }) => (
          <div key={label}>
            <div className="text-[10px] text-white/40 mb-0.5">{label}</div>
            <UsageBar used={ep.used} limit={ep.limit} color={color} />
          </div>
        ))}
      </div>
    </PanelShell>
  )
}

// Shared panel shell
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