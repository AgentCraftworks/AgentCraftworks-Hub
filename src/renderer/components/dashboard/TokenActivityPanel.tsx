// TokenActivityPanel.tsx — Top API callers + Copilot vs Human hourly chart
import { useState } from 'react'
import type { AuditLogEntry, HourlyBucket } from '@shared/hub-types'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Users, Lock, Bot, User, Cpu } from 'lucide-react'
import * as ps from './panel-styles'

type Window = '1h' | '24h'

interface Props {
  topCallers: AuditLogEntry[]
  topCallers1h: AuditLogEntry[]
  hourlyBuckets: HourlyBucket[]
  auditScope: 'enterprise' | 'org' | null
  error?: string
}

function ActorKindIcon({ kind }: { kind: AuditLogEntry['actorKind'] }) {
  const color = kind === 'Copilot' ? '#a78bfa' : kind === 'Bot' ? '#fbbf24' : '#60a5fa'
  if (kind === 'Copilot') return <Cpu size={10} style={{ color, flexShrink: 0 }} />
  if (kind === 'Bot') return <Bot size={10} style={{ color, flexShrink: 0 }} />
  return <User size={10} style={{ color, flexShrink: 0 }} />
}

function CallerBar({ entry, max }: { entry: AuditLogEntry; max: number }) {
  const pct = max > 0 ? Math.round((entry.count / max) * 100) : 0
  const barColor = entry.actorKind === 'Copilot' ? 'rgba(139,92,246,0.7)' : entry.actorKind === 'Bot' ? 'rgba(245,158,11,0.7)' : 'rgba(59,130,246,0.7)'
  return (
    <div style={{ ...ps.flexRow }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <ActorKindIcon kind={entry.actorKind} />
            <span style={{ fontSize: '12px', fontFamily: 'monospace', ...ps.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{entry.appSlug ?? entry.actor}</span>
          </div>
          <span style={{ fontSize: '10px', ...ps.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: '8px' }}>{entry.count}</span>
        </div>
        <div style={ps.thinBarTrack}>
          <div style={{ height: '100%', borderRadius: '999px', backgroundColor: barColor, width: `${pct}%` }} />
        </div>
      </div>
      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', width: '56px', textAlign: 'right', flexShrink: 0 }}>{entry.tokenType}</span>
    </div>
  )
}

function formatHourLabel(hourUtc: string): string {
  const match = hourUtc.match(/(\d{2}):(\d{2})Z$/)
  return match ? `${match[1]}:${match[2]}` : hourUtc
}

function HourlyChart({ buckets }: { buckets: HourlyBucket[] }) {
  if (buckets.length === 0) {
    return <div style={{ height: '96px', ...ps.loadingState }}>No hourly data yet…</div>
  }
  const chartData = buckets.map((b) => ({ hour: formatHourLabel(b.hourUtc), Copilot: b.copilot, Human: b.human, Bot: b.bot }))
  return (
    <ResponsiveContainer width="100%" height={96}>
      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }} barSize={6}>
        <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <Tooltip contentStyle={{ background: '#1a1d23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }} labelStyle={{ color: 'rgba(255,255,255,0.6)' }} itemStyle={{ color: 'rgba(255,255,255,0.8)' }} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
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
        <div style={{ ...ps.errorState, height: '112px' }}>
          <Lock size={20} />
          <p style={{ ...ps.errorDetail, fontSize: '12px' }}>
            Audit log error: <span style={ps.scopeHighlight}>{error}</span><br />
            <span style={{ ...ps.finePrint, marginTop: '4px', display: 'block' }}>
              Requires <span style={ps.scopeHighlight}>read:audit_log</span> scope + enterprise admin access
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
      <div style={{ marginBottom: '12px' }}>
        <p style={{ ...ps.finePrint, marginBottom: '4px' }}>Copilot vs Human — last 24 h (hourly)</p>
        <HourlyChart buckets={hourlyBuckets} />
      </div>

      <p style={{ ...ps.finePrint, marginBottom: '8px' }}>Top callers — {timeWindow === '1h' ? 'last 1 h' : 'last 24 h'}</p>
      {callers.length === 0 ? (
        <div style={{ ...ps.loadingState, paddingTop: '12px', paddingBottom: '12px' }}>No API activity in this window</div>
      ) : (
        <div style={ps.stackSm}>
          {callers.slice(0, 8).map((entry) => (
            <CallerBar key={entry.actor} entry={entry} max={max} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
        <span style={{ ...ps.flexRow, gap: '4px' }}><Cpu size={9} style={{ color: '#a78bfa' }} /> Copilot</span>
        <span style={{ ...ps.flexRow, gap: '4px' }}><User size={9} style={{ color: '#60a5fa' }} /> Human</span>
        <span style={{ ...ps.flexRow, gap: '4px' }}><Bot size={9} style={{ color: '#fbbf24' }} /> Bot</span>
      </div>
    </Panel>
  )
}

function Panel({ children, auditScope, timeWindow, onWindowChange }: { children: React.ReactNode; auditScope: 'enterprise' | 'org' | null; timeWindow: Window; onWindowChange: (w: Window) => void }) {
  return (
    <div style={ps.panelCard}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ ...ps.flexRow, fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
          <Users size={14} /> Token Activity
          {auditScope === 'org' && (
            <span style={{ fontSize: '9px', fontWeight: 400, color: 'rgba(251,191,36,0.7)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '4px', paddingLeft: '4px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px' }}>org scope</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {(['1h', '24h'] as Window[]).map((w) => (
            <button key={w} type="button" onClick={() => onWindowChange(w)} style={timeWindow === w ? ps.tabActive : ps.tabInactive}>{w}</button>
          ))}
        </div>
      </div>
      {children}
      {auditScope === 'org' && (
        <p style={{ ...ps.finePrint, marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
          Using org-level audit log · add <span style={ps.textMuted}>admin:enterprise</span> scope for full enterprise view
        </p>
      )}
    </div>
  )
}
