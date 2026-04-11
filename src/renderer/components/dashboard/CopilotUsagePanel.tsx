// CopilotUsagePanel.tsx — Copilot premium request consumption and model breakdown
import type { CopilotUsageData } from '@shared/hub-types'
import { Bot, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import * as ps from './panel-styles'

interface Props {
  data: CopilotUsageData | null
}

const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': '#3b82f6',
  'gpt-4': '#8b5cf6',
  'claude-sonnet': '#f59e0b',
  'claude-opus': '#ef4444',
  default: '#6b7280',
}

function modelColor(model: string): string {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (model.toLowerCase().includes(key)) return color
  }
  return MODEL_COLORS.default
}

export function CopilotUsagePanel({ data }: Props) {
  if (!data) {
    return (
      <Panel>
        <div style={{ ...ps.loadingState, height: '64px' }}>Loading…</div>
      </Panel>
    )
  }

  if (data.error) {
    return (
      <Panel>
        <div style={{ ...ps.errorState, height: '96px' }}>
          <AlertTriangle size={18} />
          <p style={ps.errorDetail}>
            Requires <span style={ps.scopeHighlight}>manage_billing:copilot</span> scope
          </p>
        </div>
      </Panel>
    )
  }

  const chartData = data.modelBreakdown.map(m => ({
    name: m.model.length > 14 ? m.model.slice(0, 12) + '…' : m.model,
    suggestions: m.totalSuggestionsCount,
    fullName: m.model,
  }))

  const seats = data.seatBreakdown

  return (
    <Panel>
      {/* Stats row */}
      <div style={{ ...ps.grid2, marginBottom: '16px' }}>
        {seats ? (
          <>
            <Stat label="Total Seats" value={seats.total} />
            <Stat label="Active This Cycle" value={seats.activeThisCycle} highlight />
            <Stat label="Inactive" value={seats.inactiveThisCycle} />
            <Stat label="Pending Invite" value={seats.pendingInvitation} />
          </>
        ) : (
          <>
            <Stat label="Active Users" value={data.totalActiveUsers} />
            <Stat label="Engaged Users" value={data.totalEngagedUsers} />
          </>
        )}
        <Stat label="Premium Requests" value={data.premiumRequestsUsed} highlight />
        <Stat label="Plan" value={data.planType ?? '—'} />
      </div>

      {/* Model breakdown chart */}
      {chartData.length > 0 && (
        <div>
          <div style={{ ...ps.finePrint, marginBottom: '8px' }}>Suggestions by model (latest day)</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 4, fontSize: 11 }}
                formatter={(v: number, _: string, p: { payload?: { fullName?: string } }) => [v.toLocaleString(), p.payload?.fullName ?? '']}
              />
              <Bar dataKey="suggestions" radius={[2, 2, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.fullName} fill={modelColor(entry.fullName)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div style={ps.statBox}>
      <div style={ps.statLabel}>{label}</div>
      <div style={highlight ? ps.statValueHighlight : ps.statValue}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={ps.panelCard}>
      <div style={ps.panelHeader}>
        <Bot size={14} />
        Copilot Usage
      </div>
      {children}
    </div>
  )
}
