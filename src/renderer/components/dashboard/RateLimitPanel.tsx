// RateLimitPanel.tsx — GitHub API rate limit gauge, sparkline, and countdown
import { useState } from 'react'
import type { RateLimitData, RateLimitSample } from '@shared/hub-types'
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis } from 'recharts'
import { RefreshCw, Zap, Clock } from 'lucide-react'
import * as ps from './panel-styles'

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
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : color
  return (
    <div style={{ ...ps.flexRow, fontSize: '12px' }}>
      <div style={{ ...ps.thinBarTrack, flex: 1, height: '6px' }}>
        <div style={{ height: '100%', borderRadius: '999px', transition: 'width 300ms', backgroundColor: barColor, width: `${pct}%` }} />
      </div>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.6)', width: '80px', textAlign: 'right' }}>
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
        <div style={{ ...ps.loadingState, height: '96px' }}>Loading…</div>
      </PanelShell>
    )
  }

  const { core, search, graphql, codeSearch } = data
  const corePct = Math.round((core.used / core.limit) * 100)
  const fullHistory = filterHistory(history, range)
  const chartData = fullHistory.length > 1
    ? fullHistory.map(s => ({ ts: s.ts, used: s.coreUsed, label: formatTime(s.ts) }))
    : data.history.map((used, i) => ({ ts: i, used, label: '' }))
  const tickInterval = Math.max(1, Math.floor(chartData.length / 6))

  return (
    <PanelShell title="API Rate Limits" icon={<Zap size={14} />} onRefresh={onRefresh}>
      {/* Core gauge + stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flexShrink: 0, width: '80px', height: '80px' }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="15" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none"
              stroke={corePct >= 90 ? '#ef4444' : corePct >= 70 ? '#f59e0b' : '#22c55e'}
              strokeWidth="3" strokeDasharray={`${corePct * 0.942} 94.2`} strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1 }}>{corePct}%</span>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>used</span>
          </div>
        </div>
        <div style={{ flex: 1, ...ps.stackSm, gap: '6px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Core REST</div>
          <UsageBar used={core.used} limit={core.limit} color="#3b82f6" />
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            {core.remaining.toLocaleString()} remaining · resets in <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{formatEta(core.resetEtaMs)}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={9} /> {core.limit.toLocaleString()} calls/hr · enterprise quota
          </div>
        </div>
      </div>

      {/* History chart */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={ps.finePrint}>Core usage history ({chartData.length} samples)</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['1h', '6h', 'all'] as TimeRange[]).map(r => (
              <button key={r} type="button" onClick={() => setRange(r)} style={range === r ? ps.tabActive : ps.tabInactive}>{r}</button>
            ))}
          </div>
        </div>
        {chartData.length > 1 ? (
          <div style={{ height: '64px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} tickLine={false} axisLine={false} interval={tickInterval} />
                <Area type="monotone" dataKey="used" stroke="#3b82f6" strokeWidth={1.5} fill="url(#rateGrad)" dot={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 4, fontSize: 11 }} formatter={(v: number) => [`${v.toLocaleString()} used`, '']} labelFormatter={(label) => label || ''} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: '32px', display: 'flex', alignItems: 'center', ...ps.finePrint }}>Collecting history… (polls every 30s)</div>
        )}
      </div>

      {/* Secondary endpoints */}
      <div style={{ ...ps.stackSm, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        {[
          { label: 'Search', ep: search, color: '#a855f7' },
          { label: 'GraphQL', ep: graphql, color: '#06b6d4' },
          { label: 'Code Search', ep: codeSearch, color: '#f97316' },
        ].map(({ label, ep, color }) => (
          <div key={label}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>{label}</div>
            <UsageBar used={ep.used} limit={ep.limit} color={color} />
          </div>
        ))}
      </div>
    </PanelShell>
  )
}

function PanelShell({ title, icon, onRefresh, children }: { title: string; icon: React.ReactNode; onRefresh: () => void; children: React.ReactNode }) {
  return (
    <div style={ps.panelCardFlex}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ ...ps.flexRow, fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{icon}{title}</div>
        <button type="button" onClick={onRefresh} style={ps.refreshBtn}><RefreshCw size={12} /></button>
      </div>
      {children}
    </div>
  )
}
