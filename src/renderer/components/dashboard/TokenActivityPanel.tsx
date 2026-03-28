// TokenActivityPanel.tsx — Top API callers + Copilot vs Human hourly chart
import { useState } from 'react'
import type { AuditLogEntry, HourlyBucket } from '@shared/hub-types'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Users, Lock, Bot, User, Cpu } from 'lucide-react'

type Window = '1h' | '24h'

interface Props {
  topCallers: AuditLogEntry[]
  topCallers1h: AuditLogEntry[]
  hourlyBuckets: HourlyBucket[]
  auditScope: 'enterprise' | 'org' | null
  error?: string
}

function ActorKindIcon({ kind }: { kind: AuditLogEntry['actorKind'] }) {
  if (kind === 'Copilot') return <Cpu size={10} className="text-violet-400 flex-shrink-0" />
  if (kind === 'Bot') return <Bot size={10} className="text-amber-400 flex-shrink-0" />
  return <User size={10} className="text-blue-400 flex-shrink-0" />
}

function CallerBar({ entry, max }: { entry: AuditLogEntry; max: number }) {
  const pct = max > 0 ? Math.round((entry.count / max) * 100) : 0
  const barClass =
    entry.actorKind === 'Copilot'
      ? 'bg-violet-500/70'
      : entry.actorKind === 'Bot'
        ? 'bg-amber-500/70'
        : 'bg-blue-500/70'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <ActorKindIcon kind={entry.actorKind} />
            <span className="text-xs font-mono text-white/80 truncate max-w-[130px]">
              {entry.appSlug ?? entry.actor}
            </span>
          </div>
          <span className="text-[10px] text-white/40 tabular-nums ml-2">{entry.count}</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-[9px] text-white/30 w-14 text-right flex-shrink-0">
        {entry.tokenType}
      </span>
    </div>
  )
}

function formatHourLabel(hourUtc: string): string {
  // "2026-03-27 06:00Z" → "06:00"
  const match = hourUtc.match(/(\d{2}):(\d{2})Z$/)
  return match ? `${match[1]}:${match[2]}` : hourUtc
}

function HourlyChart({ buckets }: { buckets: HourlyBucket[] }) {
  if (buckets.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-white/20 text-xs">
        No hourly data yet…
      </div>
    )
  }

  const chartData = buckets.map((b) => ({
    hour: formatHourLabel(b.hourUtc),
    Copilot: b.copilot,
    Human: b.human,
    Bot: b.bot,
  }))

  return (
    <ResponsiveContainer width="100%" height={96}>
      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }} barSize={6}>
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <Tooltip
          contentStyle={{ background: '#1a1d23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
          itemStyle={{ color: 'rgba(255,255,255,0.8)' }}
        />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
        />
        <Bar dataKey="Human" stackId="a" fill="rgba(59,130,246,0.7)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Bot" stackId="a" fill="rgba(245,158,11,0.7)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Copilot" stackId="a" fill="rgba(139,92,246,0.7)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TokenActivityPanel({ topCallers, topCallers1h, hourlyBuckets, auditScope, error }: Props) {
  const [timeWindow, setTimeWindow] = useState<Window>('24h')

  if (error) {
    return (
      <Panel auditScope={auditScope} timeWindow={timeWindow} onWindowChange={setTimeWindow}>
        <div className="flex flex-col items-center justify-center h-28 gap-2 text-white/30">
          <Lock size={20} />
          <p className="text-xs text-center">
            Audit log error: <span className="text-white/50">{error}</span>
            <br />
            <span className="text-white/20 mt-1 block">
              Requires <span className="text-white/60">read:audit_log</span> scope + enterprise admin access
            </span>
          </p>
        </div>
      </Panel>
    )
  }

  const callers = timeWindow === '1h' ? topCallers1h : topCallers
  const max = callers[0]?.count ?? 1

  return (
    <Panel auditScope={auditScope} timeWindow={timeWindow} onWindowChange={setTimeWindow}>
      {/* Copilot vs Human hourly stacked bar chart */}
      <div className="mb-3">
        <p className="text-[10px] text-white/30 mb-1">Copilot vs Human — last 24 h (hourly)</p>
        <HourlyChart buckets={hourlyBuckets} />
      </div>

      {/* Per-actor ranking */}
      <p className="text-[10px] text-white/30 mb-2">
        Top callers — {timeWindow === '1h' ? 'last 1 h' : 'last 24 h'}
      </p>
      {callers.length === 0 ? (
        <div className="text-white/30 text-xs text-center py-3">No API activity in this window</div>
      ) : (
        <div className="space-y-2">
          {callers.slice(0, 8).map((entry) => (
            <CallerBar key={entry.actor} entry={entry} max={max} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[9px] text-white/30">
        <span className="flex items-center gap-1"><Cpu size={9} className="text-violet-400" /> Copilot</span>
        <span className="flex items-center gap-1"><User size={9} className="text-blue-400" /> Human</span>
        <span className="flex items-center gap-1"><Bot size={9} className="text-amber-400" /> Bot</span>
      </div>
    </Panel>
  )
}

function Panel({
  children,
  auditScope,
  timeWindow,
  onWindowChange,
}: {
  children: React.ReactNode
  auditScope: 'enterprise' | 'org' | null
  timeWindow: Window
  onWindowChange: (w: Window) => void
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
          <Users size={14} />
          Token Activity
          {auditScope === 'org' && (
            <span className="text-[9px] font-normal text-amber-400/70 border border-amber-400/30 rounded px-1 py-0.5">
              org scope
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['1h', '24h'] as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => onWindowChange(w)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                timeWindow === w
                  ? 'bg-white/15 text-white/90'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
      {children}
      {auditScope === 'org' && (
        <p className="text-[9px] text-white/20 mt-2 border-t border-white/5 pt-2">
          Using org-level audit log · add{' '}
          <span className="text-white/40">admin:enterprise</span> scope for full enterprise view
        </p>
      )}
    </div>
  )
}
