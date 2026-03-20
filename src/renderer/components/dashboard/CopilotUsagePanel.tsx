// CopilotUsagePanel.tsx — Copilot premium request consumption and model breakdown
import type { CopilotUsageData } from '@shared/hub-types'
import { Bot, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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
        <div className="text-white/30 text-xs flex items-center justify-center h-16">Loading…</div>
      </Panel>
    )
  }

  if (data.error) {
    return (
      <Panel>
        <div className="flex flex-col items-center justify-center h-24 gap-2 text-white/30">
          <AlertTriangle size={18} />
          <p className="text-xs text-center">
            Requires <span className="text-white/60">manage_billing:copilot</span> scope
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
      <div className="grid grid-cols-2 gap-3 mb-4">
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
        <Stat
          label="Plan"
          value={data.planType ?? '—'}
        />
      </div>

      {/* Model breakdown chart */}
      {chartData.length > 0 && (
        <div>
          <div className="text-[10px] text-white/30 mb-2">Suggestions by model (latest day)</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 4, fontSize: 11 }}
                formatter={(v: number, _: string, p: { payload: { fullName: string } }) => [v.toLocaleString(), p.payload.fullName]}
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
    <div className="bg-white/5 rounded-lg px-3 py-2">
      <div className="text-[10px] text-white/40">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${highlight ? 'text-blue-400' : 'text-white/80'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-3">
        <Bot size={14} />
        Copilot Usage
      </div>
      {children}
    </div>
  )
}
